import path from 'path';
import { fileURLToPath } from 'url';
import { SentimentClassifier } from './sentimentModel.js';
import { ai, GEMINI_MODEL } from '../AI Agent/src/config/gemini.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize and load trained model
const localModel = new SentimentClassifier();
const modelWeightsPath = path.join(__dirname, 'trained_sentiment_model.json');
let isModelLoaded = localModel.loadModel(modelWeightsPath);

if (!isModelLoaded) {
  console.warn('[NLP Pipeline] Local model weights not found, fallback enabled.');
}

/**
 * Performs Sentiment Analysis and aspect extraction on customer salon reviews.
 * Uses local trained Naive Bayes NLP model with fallback to Gemini.
 * @param {string} reviewText 
 * @returns {Promise<{ sentiment: 'Positive'|'Negative'|'Neutral', sentimentScore: number, pros: string[], cons: string[] }>}
 */
export const analyzeReviewNLP = async (reviewText) => {
  if (!reviewText || typeof reviewText !== 'string') {
    return {
      sentiment: 'Neutral',
      sentimentScore: 0.0,
      pros: [],
      cons: []
    };
  }

  // 1. Primary Engine: High-speed trained local ML classifier
  if (isModelLoaded) {
    try {
      const localResult = localModel.predict(reviewText);
      return {
        sentiment: localResult.sentiment,
        sentimentScore: localResult.sentimentScore,
        pros: localResult.pros,
        cons: localResult.cons
      };
    } catch (localErr) {
      console.warn('[NLP Pipeline] Local inference warning:', localErr.message);
    }
  }

  // 2. Fallback Engine: Gemini Generative AI
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
    return {
      sentiment: 'Neutral',
      sentimentScore: 0.0,
      pros: [],
      cons: []
    };
  }
};

