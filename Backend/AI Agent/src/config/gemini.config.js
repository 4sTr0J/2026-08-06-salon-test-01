import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set in .env file!');
}

export const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Default Gemini model to use
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
