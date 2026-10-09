import OpenAI from 'openai';

/**
 * LLM Extraction Service — Production Hardened
 * Takes unstructured text (Hindi/English/Hinglish) from a construction supervisor
 * and extracts structured JSON entities for database insertion.
 * 
 * Features:
 * - Exponential backoff retry (3 attempts)
 * - Model fallback chain
 * - Enhanced system prompt for complex multi-intent messages
 */

let groq;

function getClient() {
  if (!groq) {
    groq = new OpenAI({ 
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }
  return groq;
}

// ── Model Fallback Chain ──
const MODEL_CHAIN = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'allam-2-7b',
];

// ── The System Prompt — the heart of the extraction engine ──
const SYSTEM_PROMPT = `You are an AI assistant for a construction site management system in India. 
Your job is to parse unstructured messages from site supervisors (in Hindi, English, or Hinglish) 
and extract structured data.

The supervisor can report ANY of the following in a SINGLE message:

1. **attendance** — Marking workers present/absent/half-day
   - Extract: worker names, status (present/absent/half_day), and the date (default: today)
   - "Sab hajir" means ALL workers are present
   - "Ramesh absent, baaki sab hajir" means Ramesh absent, everyone else present
   
2. **material_receipt** — Material arrived at site (GRN)
   - Extract: item name, quantity, unit, vendor name (if mentioned), invoice amount (if mentioned)
   - Common items: cement (bags), steel/TMT (kg), sand (brass/cubic ft), bricks (nos), 
     crush/aggregate (brass), binding wire (kg), plywood (sheets), pipes, paint (litres)
   - "50 bag cement aaya" → material_receipt with item=cement, quantity=50, unit=bags

3. **material_request** — Supervisor needs material sent to site (indent)
   - Extract: item name, quantity, unit, urgency (normal/urgent/critical), needed_by date
   
4. **material_consumption** — Material used today on site
   - Extract: item name, quantity_used, unit

5. **expense** — Petty cash / miscellaneous expense
   - Extract: amount, category, description
   - Categories: tea_snacks, transport, hardware, medical, fuel, food, tools, misc
   - "500 rupaye chai nashta" → expense with amount=500, category=tea_snacks

6. **advance** — Cash advance/peshi given to a worker
   - Extract: worker_name, amount, purpose
   - "Rajesh ko 2000 peshi diya" → advance with worker_name=Rajesh, amount=2000

7. **daily_report** — Progress summary of work done
   - Extract: summary of work done, weather (if mentioned)

8. **subcontractor_work** — Piece-rate work logged for a subcontractor
   - Extract: subcontractor_name, description, quantity, unit, rate

IMPORTANT RULES:
- A single message can contain MULTIPLE updates of DIFFERENT types. Extract ALL of them.
- Normalize material names to standard forms (e.g., "sement" → "cement", "sariya" → "TMT Steel", "bajri" → "sand", "reti" → "sand", "gitti" → "crush")
- For amounts, parse Indian number formats (e.g., "paanch sau" → 500, "ek hazar" → 1000, "2.5K" → 2500, "do hazar" → 2000)
- Default date is today unless explicitly stated otherwise
- "kal" means yesterday if talking about past events, tomorrow if talking about future needs
- If you CANNOT confidently parse the intent, return status "unclear" with a helpful Hindi question
- NEVER hallucinate worker names — only use names from the "Known workers" list provided
- If a worker name doesn't match any known worker, still include it but mark it as-is (the system will fuzzy-match)

Respond ONLY with valid JSON in this exact schema:

{
  "status": "success" | "unclear",
  "message": "Brief confirmation in Hindi/English mix",
  "clarification_needed": "Question to ask if status is unclear (in Hindi/English)",
  "updates": [
    {
      "type": "attendance",
      "workers": [{"name": "string", "status": "present|absent|half_day"}],
      "date": "YYYY-MM-DD"
    },
    {
      "type": "material_receipt",
      "item": "string (normalized name)",
      "quantity": number,
      "unit": "string",
      "vendor": "string | null",
      "invoice_amount": number | null
    },
    {
      "type": "material_request",
      "item": "string",
      "quantity": number,
      "unit": "string",
      "urgency": "normal|urgent|critical",
      "needed_by": "YYYY-MM-DD | null"
    },
    {
      "type": "material_consumption",
      "item": "string",
      "quantity_used": number,
      "unit": "string"
    },
    {
      "type": "expense",
      "amount": number,
      "category": "string",
      "description": "string"
    },
    {
      "type": "advance",
      "worker_name": "string",
      "amount": number,
      "purpose": "string | null"
    },
    {
      "type": "daily_report",
      "summary": "string",
      "weather": "string | null"
    },
    {
      "type": "subcontractor_work",
      "subcontractor_name": "string",
      "description": "string",
      "quantity": number,
      "unit": "string",
      "rate": number | null
    }
  ]
}

Only include the update types that are actually present in the message. 
The "updates" array should ONLY contain the types detected.
Do NOT include any thinking, explanation, or text outside the JSON object.`;

/**
 * Retry a function with exponential backoff
 */
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 429 || err.status === 503 || err.status === 500 || err.code === 'ECONNRESET';
      if (!isRetryable || attempt === maxRetries - 1) throw err;
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Extract structured entities from unstructured text
 * Uses model fallback chain if primary model fails
 */
export async function extractEntities(text, context = {}) {
  const client = getClient();

  // Build context-aware user message
  let userMessage = `Today's date: ${new Date().toISOString().split('T')[0]}\n`;
  
  if (context.siteName) {
    userMessage += `Site: ${context.siteName}\n`;
  }
  
  if (context.workerNames && context.workerNames.length > 0) {
    userMessage += `Known workers on this site: ${context.workerNames.join(', ')}\n`;
  }

  if (context.materialTypes && context.materialTypes.length > 0) {
    userMessage += `Known materials: ${context.materialTypes.join(', ')}\n`;
  }

  userMessage += `\nSupervisor's message:\n"${text}"`;

  // Try each model in the fallback chain
  for (const model of MODEL_CHAIN) {
    try {
      const result = await withRetry(async () => {
        const response = await client.chat.completions.create({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 2000,
        });
        return response;
      });

      const content = result.choices[0].message.content;
      const parsed = JSON.parse(content);

      // Validate the response structure
      if (!parsed.status || !Array.isArray(parsed.updates)) {
        return {
          status: 'unclear',
          message: 'Could not parse the response properly.',
          clarification_needed: 'Kya aap dobara bata sakte hain? (Can you say that again?)',
          updates: [],
        };
      }

      console.log(`✅ Extraction successful via ${model}: ${parsed.updates.length} updates`);
      return parsed;

    } catch (err) {
      console.warn(`⚠️ Model ${model} failed: ${err.message}`);
      // Continue to next model in chain
      continue;
    }
  }

  // All models failed
  console.error('❌ All models in fallback chain failed');
  return {
    status: 'error',
    message: 'AI processing failed after all retries. Please try again.',
    clarification_needed: null,
    updates: [],
  };
}

/**
 * Get context for a site to improve extraction accuracy
 * Pulls worker names and material types from the database
 */
export function getSiteContext(db, siteId) {
  const site = db.prepare('SELECT name FROM sites WHERE id = ?').get(siteId);
  
  const workers = db.prepare(
    'SELECT name FROM workers WHERE site_id = ? AND status = ?'
  ).all(siteId, 'active').map(w => w.name);

  const materials = db.prepare(
    'SELECT name FROM material_types'
  ).all().map(m => m.name);

  return {
    siteName: site?.name || 'Unknown',
    workerNames: workers,
    materialTypes: materials,
  };
}

export default { extractEntities, getSiteContext };
