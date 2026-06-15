// src/services/whatsappService.js
// ============================================================
// WHATSAPP CLOUD API SERVICE
// Handles all communication with Meta's WhatsApp Cloud API:
// - Sending text messages
// - Sending interactive buttons
// - Marking messages as read
// - Parsing incoming webhook payloads
// ============================================================

const axios = require('axios');

const WA_API_URL = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.WHATSAPP_TOKEN;

// ---- SEND TEXT MESSAGE ----
async function sendTextMessage(phoneNumberId, to, text) {
  try {
    const response = await axios.post(
      `${WA_API_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: text, preview_url: false }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Message sent to ${to} | Message ID: ${response.data.messages[0].id}`);
    return response.data;
  } catch (error) {
    console.error('❌ WhatsApp send error:', error.response?.data || error.message);
    throw error;
  }
}

// ---- SEND INTERACTIVE BUTTONS (for menus) ----
async function sendButtonMessage(phoneNumberId, to, bodyText, buttons) {
  // buttons = [{ id: 'btn_1', title: 'Track Order' }, ...]
  try {
    const response = await axios.post(
      `${WA_API_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title }
            }))
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Button message sent to ${to}`);
    return response.data;
  } catch (error) {
    // Fallback to text if buttons fail
    console.error('Button send failed, falling back to text:', error.message);
    return sendTextMessage(phoneNumberId, to, bodyText);
  }
}

// ---- MARK MESSAGE AS READ ----
async function markAsRead(phoneNumberId, messageId) {
  try {
    await axios.post(
      `${WA_API_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    // Non-critical, just log
    console.error('Mark as read failed:', error.message);
  }
}

// ---- PARSE INCOMING WEBHOOK ----
// Extracts the useful data from Meta's complex webhook payload
function parseIncomingMessage(webhookBody) {
  try {
    const entry = webhookBody.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Handle different message types
    let text = '';
    if (message.type === 'text') {
      text = message.text.body;
    } else if (message.type === 'interactive') {
      // Button click or list selection
      text = message.interactive?.button_reply?.title ||
             message.interactive?.list_reply?.title ||
             '';
    } else if (message.type === 'image' || message.type === 'document') {
      text = '[Customer sent an image/file]';
    } else if (message.type === 'audio') {
      text = '[Customer sent a voice note]';
    } else {
      text = '[Unsupported message type]';
    }

    return {
      messageId: message.id,
      phoneNumberId: value.metadata.phone_number_id,
      customerPhone: message.from,           // e.g. "919876543210"
      customerName: contact?.profile?.name || 'Customer',
      text: text,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      messageType: message.type,
    };
  } catch (error) {
    console.error('Webhook parse error:', error.message);
    return null;
  }
}

// ---- SEND TYPING INDICATOR ----
// Shows "typing..." to customer while AI generates response
async function sendTypingIndicator(phoneNumberId, to) {
  // WhatsApp Cloud API doesn't have a native typing indicator endpoint yet
  // This is a placeholder for when it's added
  // For now, the "read" receipt serves a similar purpose
  console.log(`Showing typing indicator for ${to}`);
}

// ---- SEND IMAGE MESSAGE ----
async function sendImageMessage(phoneNumberId, to, imageUrl, captionText = '') {
  try {
    const response = await axios.post(
      `${WA_API_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'image',
        image: {
          link: imageUrl,
          caption: captionText || undefined
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Image sent to ${to} | Message ID: ${response.data.messages[0].id}`);
    return response.data;
  } catch (error) {
    console.error('❌ WhatsApp image send error:', error.response?.data || error.message);
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
};
