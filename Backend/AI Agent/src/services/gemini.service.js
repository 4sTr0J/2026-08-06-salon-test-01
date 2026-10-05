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

    // Candidate models to attempt in order
    const candidateModels = [
      GEMINI_MODEL,
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const chat = ai.chats.create({
          model: modelName,
          history: formattedHistory,
          config: {
            systemInstruction,
            maxOutputTokens: 512,
            temperature: 0.7,
          },
        });

        const response = await chat.sendMessage({ message: userMessage });
        if (response?.text) {
          return response.text;
        }
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Gemini model "${modelName}" failed:`, err.message);
      }
    }

    // If all model attempts failed, log and provide intelligent salon fallback
    console.error('❌ All Gemini API attempts failed:', lastError?.message);

    // Friendly fallback answering salon inquiries
    const serviceList = context.services && context.services.length > 0
      ? "\n\nHere are some of our popular services:\n" +
        context.services.slice(0, 5).map(s => `• ${s.name}${s.price ? ` (Rs. ${s.price})` : ''}`).join('\n')
      : "";

    return `Hello! StylePulse Salon is open Monday through Sunday, 9:00 AM – 7:00 PM.${serviceList}\n\nYou can book any service directly through the Appointment tab on your dashboard! If you need urgent assistance, feel free to call our salon desk directly.`;
  } catch (error) {
    console.error('❌ AI Service Error:', error.message);
    return 'Hello! StylePulse Salon is open Monday to Sunday, 9:00 AM – 7:00 PM. Please browse our services tab or call us directly to book your appointment!';
  }
};
