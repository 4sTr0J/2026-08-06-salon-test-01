import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Fetches all active services from the Supabase `services` table.
 * Returns an array of service objects with name, price, duration etc.
 */
export const getSalonServices = async () => {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select('name, price, duration, description, category')
    .eq('is_active', true)
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
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('appointment_time')
    .eq('appointment_date', date)
    .in('booking_status', ['Confirmed', 'Upcoming']);

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
  const { data, error } = await supabaseAdmin
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.warn('⚠️ Could not fetch conversation history:', error.message);
    return [];
  }
  return data || [];
};

/**
 * Saves a new message to the ai_messages table.
 * @param {string} conversationId 
 * @param {'user'|'model'} role 
 * @param {string} content 
 */
export const saveMessage = async (conversationId, role, content) => {
  const { error } = await supabaseAdmin
    .from('ai_messages')
    .insert([{ conversation_id: conversationId, role, content }]);

  if (error) {
    console.warn('⚠️ Could not save message:', error.message);
  }
};

/**
 * Creates or retrieves a conversation for a session.
 * @param {string} sessionId - Unique session/user identifier.
 */
export const getOrCreateConversation = async (sessionId) => {
  // Try to find existing active conversation
  const { data: existing } = await supabaseAdmin
    .from('ai_conversations')
    .select('id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create a new one
  const { data: created, error } = await supabaseAdmin
    .from('ai_conversations')
    .insert([{ session_id: sessionId }])
    .select('id')
    .single();

  if (error) {
    console.warn('⚠️ Could not create conversation:', error.message);
    return null;
  }
  return created?.id || null;
};
