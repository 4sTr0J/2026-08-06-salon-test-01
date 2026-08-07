import { generateAIResponse } from '../services/gemini.service.js';
import {
  getSalonServices,
  getBookedSlotsForDate,
  getOrCreateConversation,
  getConversationHistory,
  saveMessage,
} from '../services/aiDatabase.service.js';
import { SYSTEM_PROMPTS } from '../prompts/systemPrompts.js';

// All possible time slots (salon operating hours 9am-7pm, every 30 mins)
const ALL_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30',
];

/**
 * POST /api/ai/chat
 * Body: { message: string, sessionId?: string, date?: string }
 */
export const handleChat = async (req, res) => {
  try {
    const { message, sessionId = 'anonymous', date } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message is required and must be a non-empty string.' });
    }

    // 1. Fetch salon services for context
    const services = await getSalonServices();

    // 2. Build slot context if a date was mentioned or provided
    let slotInfo = null;
    let detectedDate = date;

    // Simple date extraction from message (YYYY-MM-DD pattern)
    if (!detectedDate) {
      const dateMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      if (dateMatch) detectedDate = dateMatch[1];
    }

    if (detectedDate) {
      const bookedSlots = await getBookedSlotsForDate(detectedDate);
      slotInfo = SYSTEM_PROMPTS.SLOT_CHECK_PROMPT(detectedDate, bookedSlots, ALL_SLOTS);
    }

    // 3. Get or create conversation, then fetch history
    const conversationId = await getOrCreateConversation(sessionId);
    let history = [];
    if (conversationId) {
      const rawHistory = await getConversationHistory(conversationId, 10);
      history = rawHistory.map(msg => ({ role: msg.role, content: msg.content }));
    }

    // 4. Generate AI response
    const reply = await generateAIResponse(message.trim(), history, { services, slotInfo });

    // 5. Save both user message and AI reply to history
    if (conversationId) {
      await saveMessage(conversationId, 'user', message.trim());
      await saveMessage(conversationId, 'model', reply);
    }

    let availableSlotsForDate = undefined;
    if (detectedDate) {
      const booked = await getBookedSlotsForDate(detectedDate);
      availableSlotsForDate = ALL_SLOTS.filter(s => !booked.includes(s));
    }

    return res.status(200).json({
      reply,
      conversationId,
      sessionId,
      availableSlots: availableSlotsForDate,
    });
  } catch (error) {
    console.error('❌ AI Chat Error:', error.message);
    return res.status(500).json({
      error: 'The AI assistant is temporarily unavailable. Please try again shortly.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
