// src/services/whatsappService.js
// ============================================================
// INSTAGRAM MESSAGING API SERVICE
// Handles all communication with Meta's Instagram Messaging API
// ============================================================

const axios = require('axios');

const TOKEN    = (process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '').trim();

// WhatsApp Cloud API: graph.facebook.com  (entry.changes format)
// Instagram DM API:   graph.instagram.com (entry.messaging format)
const WA_API_URL = 'https://graph.facebook.com/v20.0';
const IG_API_URL = 'https://graph.instagram.com/v20.0';

// Platform tracker — set when we parse an incoming message
// so reply functions know which API to use
let _activePlatform = 'whatsapp'; // default

function setActivePlatform(platform) { _activePlatform = platform; }
function getApiBase() {
  return _activePlatform === 'instagram' ? IG_API_URL : WA_API_URL;
}

// ---- SEND TEXT MESSAGE ----
async function sendTextMessage(phoneNumberId, to, text) {
  try {
    const apiBase = getApiBase();
    let payload;
    let url;

    if (_activePlatform === 'instagram') {
      // Instagram Messenger API format
      url = `${apiBase}/${phoneNumberId}/messages?access_token=${TOKEN}`;
      payload = { recipient: { id: to }, message: { text } };
    } else {
      // WhatsApp Cloud API format
      url = `${apiBase}/${phoneNumberId}/messages`;
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
      };
    }

    const response = await axios.post(url, payload, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log(`✅ [${_activePlatform.toUpperCase()}] Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error(`❌ [${_activePlatform.toUpperCase()}] Send error:`, error.response?.data || error.message);
    throw error;
  }
}

// ---- SEND INTERACTIVE BUTTONS ----
async function sendButtonMessage(phoneNumberId, to, bodyText, buttons) {
  try {
    const apiBase = getApiBase();
    let payload;
    let url;

    if (_activePlatform === 'instagram') {
      url = `${apiBase}/${phoneNumberId}/messages?access_token=${TOKEN}`;
      payload = {
        recipient: { id: to },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: bodyText,
              buttons: buttons.map(b => ({ type: 'postback', title: b.title, payload: b.id }))
            }
          }
        }
      };
    } else {
      // WhatsApp Cloud API — interactive reply buttons
      url = `${apiBase}/${phoneNumberId}/messages`;
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.slice(0, 3).map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.substring(0, 20) }
            }))
          }
        }
      };
    }

    const response = await axios.post(url, payload, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log(`✅ [${_activePlatform.toUpperCase()}] Button message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error('Button send failed, falling back to text:', error.message);
    return sendTextMessage(phoneNumberId, to, bodyText);
  }
}

// ---- MARK MESSAGE AS READ ----
async function markAsRead(phoneNumberId, messageId) {
  try {
    const apiBase = getApiBase();
    let payload;
    let url = `${apiBase}/${phoneNumberId}/messages`;

    if (_activePlatform === 'instagram') {
      url += `?access_token=${TOKEN}`;
      payload = { recipient: { id: phoneNumberId }, sender_action: 'mark_seen' };
    } else {
      // WhatsApp Cloud API
      payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      };
    }

    await axios.post(url, payload, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Don't throw — mark-as-read failures are non-critical
    console.error('Mark as read failed (non-critical):', error.response?.data?.error?.message || error.message);
  }
}

// ---- PARSE INCOMING WEBHOOK ----
// Supports two formats:
//   1. WhatsApp Cloud API: entry.changes[0].value.messages[0]
//   2. Instagram Messaging API: entry.messaging[0]
function parseIncomingMessage(webhookBody) {
  try {
    const entry = webhookBody.entry?.[0];

    // ── FORMAT 1: WhatsApp Cloud API ──────────────────────────────
    const change = entry?.changes?.[0];
    const value  = change?.value;
    if (value?.messages?.[0]) {
      const msg         = value.messages[0];
      const phoneNumberId = value.metadata?.phone_number_id;
      const contactName = value.contacts?.[0]?.profile?.name || 'WhatsApp User';

      let text = '';
      let type = 'text';

      if (msg.type === 'text') {
        text = msg.text?.body || '';
      } else if (msg.type === 'interactive') {
        // Button replies & list replies
        text = msg.interactive?.button_reply?.title
            || msg.interactive?.list_reply?.title
            || msg.interactive?.button_reply?.id
            || '[Interactive]';
        type = 'interactive';
      } else if (msg.type === 'image' || msg.type === 'audio' || msg.type === 'video') {
        text = `[${msg.type} attachment]`;
        type = msg.type;
      } else {
        text = `[${msg.type || 'unknown'} message]`;
      }

      setActivePlatform('whatsapp');
      console.log(`📱 [WhatsApp] Parsed message from ${msg.from}: "${text}"`);
      return {
        messageId:    msg.id,
        phoneNumberId,
        customerPhone: msg.from,
        customerName:  contactName,
        text,
        timestamp:    new Date(parseInt(msg.timestamp) * 1000),
        messageType:  type,
      };
    }

    // ── FORMAT 2: Instagram Messaging API ────────────────────────
    const messaging = entry?.messaging?.[0];
    if (!messaging) return null;

    const senderId    = messaging.sender?.id;
    const recipientId = messaging.recipient?.id;
    const message     = messaging.message;
    const postback    = messaging.postback;

    let text      = '';
    let messageId = '';
    let type      = 'text';

    if (message) {
      text      = message.text || '[Attachment]';
      messageId = message.mid;
      if (message.attachments) type = 'image';
    } else if (postback) {
      text      = postback.payload || postback.title;
      messageId = postback.mid || String(Date.now());
      type      = 'interactive';
    } else {
      return null;
    }

    setActivePlatform('instagram');
    console.log(`📱 [Instagram] Parsed message from ${senderId}: "${text}"`);
    return {
      messageId,
      phoneNumberId: recipientId,
      customerPhone: senderId,
      customerName:  'Instagram User',
      text,
      timestamp:    new Date(parseInt(messaging.timestamp)),
      messageType:  type,
    };
  } catch (error) {
    console.error('Webhook parse error:', error.message);
    return null;
  }
}

// ---- SEND TYPING INDICATOR ----
async function sendTypingIndicator(phoneNumberId, to) {
  try {
    const apiBase = getApiBase();
    if (_activePlatform === 'instagram') {
      await axios.post(
        `${apiBase}/${phoneNumberId}/messages?access_token=${TOKEN}`,
        { recipient: { id: to }, sender_action: "typing_on" },
        { headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
      );
    }
    // Note: WhatsApp Cloud API doesn't support an explicit typing indicator via this endpoint in the same way,
    // so we can just skip or handle differently if needed.
  } catch (error) {
    // Ignore errors for typing indicators
  }
}

// ---- SEND IMAGE MESSAGE ----
async function sendImageMessage(phoneNumberId, to, imageUrl, captionText = '') {
  try {
    const apiBase = getApiBase();
    let payload;
    let url;

    if (_activePlatform === 'instagram') {
      url = `${apiBase}/${phoneNumberId}/messages?access_token=${TOKEN}`;
      payload = {
        recipient: { id: to },
        message: {
          attachment: {
            type: "image",
            payload: { url: imageUrl, is_reusable: true }
          }
        }
      };
    } else {
      url = `${apiBase}/${phoneNumberId}/messages`;
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: { link: imageUrl }
      };
      if (captionText) {
        payload.image.caption = captionText;
      }
    }

    const response = await axios.post(url, payload, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
    });
    
    // Send caption as a separate text message for Instagram, since IG image attachment doesn't support a direct caption field
    if (_activePlatform === 'instagram' && captionText) {
      await sendTextMessage(phoneNumberId, to, captionText);
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ [${_activePlatform.toUpperCase()}] Image send error:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendTextMessage,
  sendButtonMessage,
  markAsRead,
  parseIncomingMessage,
  sendTypingIndicator,
  sendImageMessage,
  setActivePlatform,
};
