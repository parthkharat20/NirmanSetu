import axios from 'axios';

/**
 * WhatsApp Cloud API Client
 * Handles all outgoing messages to WhatsApp via Meta's Cloud API
 * 
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_API_VERSION = 'v18.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function getPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

/**
 * Send a plain text message
 */
export async function sendTextMessage(to, text) {
  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };

  try {
    const res = await axios.post(url, payload, { headers: getHeaders() });
    return res.data;
  } catch (err) {
    console.error('❌ WhatsApp sendText error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Send an interactive message with quick-reply buttons (max 3 buttons)
 */
export async function sendButtonMessage(to, bodyText, buttons) {
  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn, i) => ({
          type: 'reply',
          reply: {
            id: btn.id || `btn_${i}`,
            title: btn.title.substring(0, 20), // WhatsApp limit: 20 chars
          },
        })),
      },
    },
  };

  try {
    const res = await axios.post(url, payload, { headers: getHeaders() });
    return res.data;
  } catch (err) {
    console.error('❌ WhatsApp sendButton error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Send an interactive list message (up to 10 items per section, up to 10 sections)
 * Ideal for attendance marking, material selection, etc.
 */
export async function sendListMessage(to, headerText, bodyText, buttonText, sections) {
  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: headerText },
      body: { text: bodyText },
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.map(section => ({
          title: section.title.substring(0, 24),
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title.substring(0, 24),
            description: row.description?.substring(0, 72) || '',
          })),
        })),
      },
    },
  };

  try {
    const res = await axios.post(url, payload, { headers: getHeaders() });
    return res.data;
  } catch (err) {
    console.error('❌ WhatsApp sendList error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Send a template message (for proactive/scheduled messages like morning attendance reminder)
 */
export async function sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  try {
    const res = await axios.post(url, payload, { headers: getHeaders() });
    return res.data;
  } catch (err) {
    console.error('❌ WhatsApp sendTemplate error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Download media (photos of challans, bills, progress) from WhatsApp
 */
export async function downloadMedia(mediaId) {
  // Step 1: Get the media URL
  const metaUrl = `${BASE_URL}/${mediaId}`;
  const metaRes = await axios.get(metaUrl, { headers: getHeaders() });
  const mediaUrl = metaRes.data.url;

  // Step 2: Download the actual file
  const fileRes = await axios.get(mediaUrl, {
    headers: getHeaders(),
    responseType: 'arraybuffer',
  });

  return {
    buffer: fileRes.data,
    mimeType: metaRes.data.mime_type,
    sha256: metaRes.data.sha256,
    fileSize: metaRes.data.file_size,
  };
}

/**
 * Mark a message as read (blue ticks)
 */
export async function markAsRead(messageId) {
  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };

  try {
    await axios.post(url, payload, { headers: getHeaders() });
  } catch (err) {
    // Non-critical, don't throw
    console.warn('⚠️ Could not mark message as read:', err.message);
  }
}

/**
 * Send a reaction emoji to a message
 */
export async function sendReaction(to, messageId, emoji) {
  const url = `${BASE_URL}/${getPhoneNumberId()}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji,
    },
  };

  try {
    await axios.post(url, payload, { headers: getHeaders() });
  } catch (err) {
    console.warn('⚠️ Could not send reaction:', err.message);
  }
}

export default {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  sendTemplateMessage,
  downloadMedia,
  markAsRead,
  sendReaction,
};
