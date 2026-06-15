// src/routes/dashboard.js
// ============================================================
// DASHBOARD API ROUTES
// Simple REST API for the brand owner dashboard
// Shows: ticket count, resolution rate, escalations, recent chats
// ============================================================

const express = require('express');
const router = express.Router();
const { getAnalytics, getEscalationQueue } = require('../services/messageHandler');
const { brands } = require('../config/brands');

// GET /api/dashboard — Overview stats
router.get('/', (req, res) => {
  const analytics = getAnalytics();
  const escalations = getEscalationQueue();

  res.json({
    status: 'live',
    stats: {
      totalTickets: analytics.total,
      aiResolved: analytics.aiResolved,
      escalated: analytics.escalated,
      resolutionRate: `${analytics.resolutionRate}%`,
      avgResponseTime: `${analytics.avgResponseTimeMs}ms`,
    },
    intentBreakdown: analytics.intentBreakdown,
    pendingEscalations: escalations.filter(e => e.status === 'pending').length,
    recentInteractions: analytics.recentInteractions,
  });
});

// GET /api/dashboard/escalations — Pending human handoffs
router.get('/escalations', (req, res) => {
  const queue = getEscalationQueue();
  res.json({
    count: queue.length,
    escalations: queue,
  });
});

// GET /api/dashboard/brands — List all configured brands
router.get('/brands', (req, res) => {
  const brandList = Object.entries(brands)
    .filter(([id]) => id !== 'template')
    .map(([id, brand]) => ({
      id,
      name: brand.name,
      category: brand.category,
      language: brand.language,
      productCount: brand.products?.length || 0,
    }));

  res.json({ brands: brandList });
});

// GET /api/dashboard/health — Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()) + 's',
    environment: process.env.NODE_ENV,
    openrouterConfigured: !!process.env.OPENROUTER_API_KEY,
    whatsappConfigured: !!process.env.WHATSAPP_TOKEN,
  });
});

module.exports = router;
