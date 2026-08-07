import express from 'express';
import { handleChat } from '../controllers/ai.controller.js';

const router = express.Router();

/**
 * POST /api/ai/chat
 * Body: { message: string, sessionId?: string, date?: string }
 * Returns: { reply: string, conversationId: string, sessionId: string }
 */
router.post('/chat', handleChat);

/**
 * GET /api/ai/health
 * Health check for the AI agent endpoint.
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'StylePulse AI Agent',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    timestamp: new Date().toISOString(),
  });
});

export default router;
