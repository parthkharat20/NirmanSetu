import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

/**
 * Transcription Service
 * Converts audio messages (voice notes, audio files) to text using OpenAI Whisper.
 * Handles Hindi, English, and mixed-language (Hinglish) audio.
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

/**
 * Transcribe an audio buffer to text using Whisper
 * @param {Buffer} audioBuffer - The raw audio data
 * @param {string} mimeType - The MIME type (audio/ogg, audio/mpeg, etc.)
 * @returns {Promise<{text: string, language: string}>}
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
  const client = getClient();

  // Whisper accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
  const extension = mimeTypeToExtension(mimeType);
  const tempPath = path.join(process.cwd(), 'uploads', `temp_${Date.now()}.${extension}`);

  try {
    // Write buffer to temp file (Whisper API needs a file)
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    fs.writeFileSync(tempPath, audioBuffer);

    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-large-v3',
      language: 'hi', // Primary: Hindi (also handles English/Hinglish well)
      response_format: 'verbose_json',
      prompt: 'Construction site report. Cement, steel, sand, bricks, TMT bar, mistri, mazdoor, helper, plumber, electrician. Hajri, attendance, kharcha, expense, saamaan, material, peshi, advance.',
    });

    return {
      text: transcription.text,
      language: transcription.language || 'hi',
      duration: transcription.duration,
    };
  } catch (err) {
    console.error('❌ Whisper transcription failed:', err.message);
    throw new Error(`Transcription failed: ${err.message}`);
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

/**
 * Convert MIME type to file extension for Whisper
 */
function mimeTypeToExtension(mimeType) {
  const map = {
    'audio/ogg': 'ogg',
    'audio/ogg; codecs=opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/amr': 'amr',
    'audio/aac': 'aac',
  };
  return map[mimeType] || 'ogg';
}

export default { transcribeAudio };
