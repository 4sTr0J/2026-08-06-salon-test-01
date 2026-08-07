import { ai, GEMINI_MODEL } from '../AI Agent/src/config/gemini.config.js';

/**
 * Uses Gemini to perform NLP sentiment analysis and extract pros/cons from review text.
 * @param {string} reviewText 
 * @returns {Promise<{ sentiment: 'Positive'|'Negative'|'Neutral', sentimentScore: number, pros: string[], cons: string[] }>}
 */
export const analyzeReviewNLP = async (reviewText) => {
  try {
    const prompt = `
Analyze the following customer review for a salon. You must return a strict JSON response.
Do not include markdown code block formatting (like \`\`\`json). Just return the raw JSON string.

Review Text: "${reviewText}"

Expected JSON format:
{
  "sentiment": "Positive" | "Negative" | "Neutral",
  "sentimentScore": <number between -1.0 and 1.0 representing negative to positive sentiment>,
  "pros": [<list of short extracted positive things mentioned, or empty array>],
  "cons": [<list of short extracted negative things mentioned, or empty array>]
}
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    const resultText = response.text || '';
    const cleanJSON = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanJSON);
  } catch (error) {
    console.error('⚠️ NLP Pipeline Error:', error.message);
    // Return sensible fallback
    const ratingFallback = {
      sentiment: 'Neutral',
      sentimentScore: 0.0,
      pros: [],
      cons: []
    };
    return ratingFallback;
  }
};
