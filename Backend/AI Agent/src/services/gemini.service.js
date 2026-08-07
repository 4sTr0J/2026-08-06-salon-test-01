import { ai, GEMINI_MODEL } from '../config/gemini.config.js';
import { SYSTEM_PROMPTS } from '../prompts/systemPrompts.js';

/**
 * Generates an AI response given a user message and optional conversation history.
 * @param {string} userMessage - The latest message from the customer.
 * @param {Array<{role: string, content: string}>} history - Previous conversation messages.
 * @param {object} context - Optional context object with services, slots, etc.
 * @returns {Promise<string>} The model's text response.
 */
export const generateAIResponse = async (userMessage, history = [], context = {}) => {
  try {
    // Build system instruction with any dynamic context
    let systemInstruction = SYSTEM_PROMPTS.SALON_ASSISTANT;

    // Append available services to the system prompt if provided
    if (context.services && context.services.length > 0) {
      const serviceList = context.services
        .map(s => `• ${s.name}${s.price ? ` — Rs. ${s.price}` : ''}${s.duration ? ` (${s.duration} mins)` : ''}${s.description ? `: ${s.description}` : ''}`)
        .join('\n');
      systemInstruction += `\n\nCurrent Salon Services:\n${serviceList}`;
    }

    // Append slot availability info if provided
    if (context.slotInfo) {
      systemInstruction += `\n\n${context.slotInfo}`;
    }

    // Convert history to Gemini SDK format
    const formattedHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));

    // Create a chat session with history
    const chat = ai.chats.create({
      model: GEMINI_MODEL,
      history: formattedHistory,
      config: {
        systemInstruction,
        maxOutputTokens: 512,
        temperature: 0.7,
      },
    });

    const response = await chat.sendMessage({ message: userMessage });
    return response.text || 'I\'m sorry, I couldn\'t generate a response. Please try again.';
  } catch (error) {
    console.error('❌ Gemini API Error:', error.message);
    throw new Error(`Gemini API failed: ${error.message}`);
  }
};
