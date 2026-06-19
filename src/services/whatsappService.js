// src/services/whatsappService.js
// ============================================================
// INSTAGRAM MESSAGING API SERVICE
// Handles all communication with Meta's Instagram Messaging API
// Note: File kept as whatsappService.js to avoid import changes
// ============================================================

const axios = require('axios');

const IG_API_URL = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
const pageId = process.env.FACEBOOK_PAGE_ID || '123681666172579';

// ---- SEND TEXT MESSAGE ----
async function sendTextMessage(phoneNumberId, to, text) {
  try {
    const response = await axios.post(
      `${IG_API_URL}/${pageId}/messages`,
      {
        recipient: { id: to },
        message: { text: text }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Message sent to IG ${to} | Message ID: ${response.data.message_id}`);
    return response.data;
  } catch (error) {
    console.error('❌ Instagram send error:', error.response?.data || error.message);
    throw error;
  }
}

// ---- SEND INTERACTIVE BUTTONS ----
async function sendButtonMessage(phoneNumberId, to, bodyText, buttons) {
  // IG supports generic templates for buttons
  try {
    const response = await axios.post(
      `${IG_API_URL}/${pageId}/messages`,
      {
        recipient: { id: to },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: bodyText,
              buttons: buttons.map(b => ({
                type: "postback",
                title: b.title,
                payload: b.id
              }))
            }
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
    console.log(`✅ Button message sent to IG ${to}`);
    return response.data;
  } catch (error) {
    console.error('Button send failed, falling back to text:', error.message);
    return sendTextMessage(phoneNumberId, to, bodyText);
  }
}

// ---- MARK MESSAGE AS READ ----
async function markAsRead(phoneNumberId, messageId) {
  try {
    await axios.post(
      `${IG_API_URL}/${pageId}/messages`,
      {
        recipient: { id: phoneNumberId }, // For IG we pass sender_action
        sender_action: "mark_seen"
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Mark as read failed:', error.message);
  }
}

// ---- PARSE INCOMING WEBHOOK ----
function parseIncomingMessage(webhookBody) {
  try {
    const entry = webhookBody.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging) return null;

    const senderId = messaging.sender?.id;
    const recipientId = messaging.recipient?.id;
    const message = messaging.message;
    const postback = messaging.postback;

    let text = '';
    let messageId = '';
    let type = 'text';

    if (message) {
      text = message.text || '[Attachment]';
      messageId = message.mid;
      if (message.attachments) type = 'image';
    } else if (postback) {
      text = postback.payload || postback.title;
      messageId = postback.mid || String(Date.now());
      type = 'interactive';
    } else {
      return null;
    }

    return {
      messageId: messageId,
      phoneNumberId: recipientId,
      customerPhone: senderId, // This is IG PSID
      customerName: 'Instagram User',
      text: text,
      timestamp: new Date(parseInt(messaging.timestamp)),
      messageType: type,
    };
  } catch (error) {
    console.error('Webhook parse error:', error.message);
    return null;
  }
}

// ---- SEND TYPING INDICATOR ----
async function sendTypingIndicator(phoneNumberId, to) {
  try {
    await axios.post(
      `${IG_API_URL}/${pageId}/messages`,
      {
        recipient: { id: to },
        sender_action: "typing_on"
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    // Ignore errors for typing indicators
  }
}

// ---- SEND IMAGE MESSAGE ----
async function sendImageMessage(phoneNumberId, to, imageUrl, captionText = '') {
  try {
    // For caption + image, we first send the image, then text (or use a generic template)
    // Here we send image as attachment
    const response = await axios.post(
      `${IG_API_URL}/${pageId}/messages`,
      {
        recipient: { id: to },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: imageUrl,
              is_reusable: true
            }
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
    
    if (captionText) {
      await sendTextMessage(phoneNumberId, to, captionText);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Instagram image send error:', error.response?.data || error.message);
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
