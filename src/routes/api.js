// src/routes/api.js
// ============================================================
// WEB CLIENT REST API ROUTER
// - GET /api/brands       : Lists all active and custom brands
// - POST/PUT /api/brands  : Adds or updates dynamic brand config
// - DELETE /api/brands/:id: Deletes a dynamic brand config
// - POST /api/chat        : Bypasses WhatsApp webhook/API for live web demo chat
// ============================================================

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { brands, addOrUpdateCustomBrand, removeCustomBrand } = require('../config/brands');
const { handleWebChatMessage } = require('../services/messageHandler');

// ---- GET FREE MODELS FROM OPENROUTER ----
router.get('/models', async (req, res) => {
  try {
    const apiKey = req.headers['x-openrouter-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || process.env.OPENROUTER_API_KEY || '';
    const headers = {};
    if (apiKey && apiKey !== 'sk-or-v1-paste-your-key-here') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await axios.get('https://openrouter.ai/api/v1/models', { headers });
    
    // Filter only free models (pricing prompt == 0 && completion == 0)
    const freeModels = response.data.data.filter(m =>
      parseFloat(m.pricing?.prompt || 1) === 0 &&
      parseFloat(m.pricing?.completion || 1) === 0
    );

    res.json({ success: true, models: freeModels });
  } catch (error) {
    console.error('Error fetching models from OpenRouter:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- GET ALL BRANDS ----
router.get('/brands', (req, res) => {
  try {
    const brandList = Object.entries(brands)
      .filter(([id]) => id !== 'template')
      .map(([id, brand]) => brand);
    res.json({ success: true, brands: brandList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- CREATE NEW CUSTOM BRAND ----
router.post('/brands', (req, res) => {
  try {
    const brandData = req.body;
    if (!brandData.id || !brandData.name) {
      return res.status(400).json({ success: false, error: 'id and name are required' });
    }
    const brand = addOrUpdateCustomBrand(brandData);
    res.json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- UPDATE EXISTING BRAND ----
router.put('/brands/:id', (req, res) => {
  try {
    const { id } = req.params;
    const brandData = { ...req.body, id };
    const brand = addOrUpdateCustomBrand(brandData);
    res.json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- DELETE CUSTOM BRAND ----
router.delete('/brands/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'demo') {
      return res.status(400).json({ success: false, error: 'Cannot delete default demo brand' });
    }
    removeCustomBrand(id);
    res.json({ success: true, message: `Brand ${id} deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- WEB CHAT CHANNELS ENDPOINT ----
router.post('/chat', async (req, res) => {
  try {
    const { brandId, customerPhone, customerName, text, provider, apiKey } = req.body;
    if (!brandId || !text) {
      return res.status(400).json({ success: false, error: 'brandId and text are required' });
    }

    const phone = customerPhone || '9999988888';
    const name = customerName || 'Demo User';
    
    const activeApiKey = apiKey || 
                         req.headers['x-openrouter-api-key'] || 
                         req.headers['authorization']?.replace('Bearer ', '') || 
                         null;
                         
    const activeProvider = provider || 'openrouter';

    const chatResponse = await handleWebChatMessage(brandId, phone, name, text, activeApiKey, activeProvider);
    res.json({ success: true, data: chatResponse });
  } catch (error) {
    console.error('Web Chat controller error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
