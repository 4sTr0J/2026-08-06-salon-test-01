import '../../../config/env.js';
import supabase, { supabaseAdmin } from '../../../config/supabase.js';

const db = supabaseAdmin || supabase;

/**
 * Fetches all active services from the Supabase `salon_owner_services` table.
 * Returns an array of service objects with name, price, duration, category.
 */
export const getSalonServices = async () => {
  const { data, error } = await db
    .from('salon_owner_services')
    .select('name, price, duration, category')
    .order('category');

  if (error) {
    console.warn('⚠️ Could not fetch services:', error.message);
    return [];
  }
  return data || [];
};

/**
 * Fetches booked appointment times for a given date.
 * @param {string} date - Date string in 'YYYY-MM-DD' format.
 * @returns {string[]} Array of booked time strings e.g. ['09:00', '10:30']
 */
export const getBookedSlotsForDate = async (date) => {
  const { data, error } = await db
    .from('appointments')
    .select('appointment_time')
    .eq('appointment_date', date)
    .neq('booking_status', 'Cancelled');

  if (error) {
    console.warn('⚠️ Could not fetch booked slots:', error.message);
    return [];
  }
  return (data || []).map(a => a.appointment_time);
};

/**
 * Fetches recent conversation history for context (last N messages).
 * @param {string} conversationId 
 * @param {number} limit 
 */
export const getConversationHistory = async (conversationId, limit = 10) => {
  if (!conversationId) return [];

  const { data, error } = await db
    .from('ai_messages')
    .select('sender, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.warn('⚠️ Could not fetch conversation history:', error.message);
    return [];
  }
  return (data || []).map(m => ({
    role: m.sender === 'model' || m.sender === 'assistant' ? 'model' : 'user',
    content: m.content
  }));
};

/**
 * Saves a new message to the ai_messages table.
 * @param {string} conversationId 
 * @param {'user'|'model'} role 
 * @param {string} content 
 */
export const saveMessage = async (conversationId, role, content) => {
  if (!conversationId || !content) return;

  const sender = role === 'model' || role === 'assistant' ? 'model' : 'user';

  const { error } = await db
    .from('ai_messages')
    .insert([{
      conversation_id: conversationId,
      sender,
      content
    }]);

  if (error) {
    console.warn('⚠️ Could not save message:', error.message);
  }
};

/**
 * Creates or retrieves a conversation for a session.
 * @param {string} sessionId - Unique session/user identifier.
 */
export const getOrCreateConversation = async (sessionId) => {
  if (!sessionId) return null;
  const sessionTitle = `session_${sessionId}`;

  try {
    // Try to find existing conversation by session title
    const { data: existing } = await db
      .from('ai_conversations')
      .select('id')
      .eq('title', sessionTitle)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) return existing.id;

    // Create a new conversation record
    const { data: created, error } = await db
      .from('ai_conversations')
      .insert([{
        title: sessionTitle,
        user_id: '00000000-0000-0000-0000-000000000000'
      }])
      .select('id')
      .single();

    if (error) {
      console.warn('⚠️ Could not create conversation:', error.message);
      return null;
    }
    return created?.id || null;
  } catch (err) {
    console.warn('⚠️ Conversation lookup error:', err.message);
    return null;
  }
};
