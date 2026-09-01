import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── English Stopwords ──
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenize and normalize text into unigrams & bigrams
 */
function tokenize(text) {
  // Replace punctuation and ellipsis with space, keep alphanumeric
  const clean = text
    .toLowerCase()
    .replace(/[._\-–—,!?/\\()"'’“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').filter(w => w.length > 0);
  const filtered = words.filter(w => !STOPWORDS.has(w) && w.length > 1);
  
  // Extract bigrams for phrases like "not happy", "rude staff", "customer service"
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 1 && words[i + 1].length > 1) {
      bigrams.push(`${words[i]}_${words[i + 1]}`);
    }
  }

  return [...filtered, ...bigrams];
}

// ── Built-in Lexicon Prior Weights ──
const STRONG_POSITIVE_WORDS = new Set([
  'wonderful', 'amazing', 'excellent', 'great', 'awesome', 'fantastic', 'superb',
  'outstanding', 'perfect', 'loved', 'best', 'flawless', 'glossy', 'luxurious',
  'pristine', 'friendly', 'meticulous', 'gentle', 'rejuvenated', 'sanitized',
  'attentive', 'exceptional', 'polite', 'pampering', 'satisfied', 'good', 'happy'
]);

const STRONG_NEGATIVE_WORDS = new Set([
  'bad', 'worst', 'terrible', 'horrible', 'awful', 'poor', 'ruined', 'burned',
  'burn', 'rude', 'unprofessional', 'overpriced', 'unsanitary', 'dirty', 'waste',
  'disappointed', 'dissatisfied', 'scam', 'refused', 'irritation', 'breakage',
  'double_booked', 'late', 'delay', 'cuticles', 'bleeding', 'painful', 'hate'
]);

/**
 * Multinomial Naive Bayes Classifier with Laplace Smoothing & Lexicon Boost
 */
export class SentimentClassifier {
  constructor() {
    this.classes = ['Positive', 'Neutral', 'Negative'];
    this.classDocCounts = { Positive: 0, Neutral: 0, Negative: 0 };
    this.totalDocs = 0;
    this.wordFreqByClass = {
      Positive: {},
      Neutral: {},
      Negative: {}
    };
    this.totalWordsByClass = { Positive: 0, Neutral: 0, Negative: 0 };
    this.vocabulary = new Set();
  }

  /**
   * Train model with review samples
   */
  train(dataset) {
    this.totalDocs = dataset.length;

    dataset.forEach(sample => {
      const { review_text, sentiment } = sample;
      if (!this.classes.includes(sentiment)) return;

      this.classDocCounts[sentiment]++;
      const tokens = tokenize(review_text);

      tokens.forEach(token => {
        this.vocabulary.add(token);
        this.wordFreqByClass[sentiment][token] = (this.wordFreqByClass[sentiment][token] || 0) + 1;
        this.totalWordsByClass[sentiment]++;
      });
    });

    // Ensure all strong lexicon words are in the vocabulary
    STRONG_POSITIVE_WORDS.forEach(w => {
      this.vocabulary.add(w);
      this.wordFreqByClass.Positive[w] = (this.wordFreqByClass.Positive[w] || 0) + 15;
      this.totalWordsByClass.Positive += 15;
    });

    STRONG_NEGATIVE_WORDS.forEach(w => {
      this.vocabulary.add(w);
      this.wordFreqByClass.Negative[w] = (this.wordFreqByClass.Negative[w] || 0) + 15;
      this.totalWordsByClass.Negative += 15;
    });

    console.log(`[Sentiment Trainer] Successfully trained on ${this.totalDocs} samples.`);
    console.log(`[Sentiment Trainer] Vocabulary size: ${this.vocabulary.size} unique tokens.`);
  }

  /**
   * Predict sentiment label, continuous score, and extracted aspects
   */
  predict(text) {
    const rawLower = (text || '').toLowerCase();
    const tokens = tokenize(text);
    const vocabSize = this.vocabulary.size || 1;
    const logPosteriors = {};

    // Check strong lexicon indicators
    let positiveLexHits = 0;
    let negativeLexHits = 0;

    tokens.forEach(t => {
      if (STRONG_POSITIVE_WORDS.has(t)) positiveLexHits++;
      if (STRONG_NEGATIVE_WORDS.has(t)) negativeLexHits++;
    });

    // Substring fallback for phrases like "too bad", "worst customer service"
    if (rawLower.includes('bad') || rawLower.includes('worst') || rawLower.includes('terrible') || rawLower.includes('rude') || rawLower.includes('ruined') || rawLower.includes('poor')) {
      negativeLexHits += 2;
    }
    if (rawLower.includes('wonderful') || rawLower.includes('amazing') || rawLower.includes('outstanding') || rawLower.includes('excellent') || rawLower.includes('best') || rawLower.includes('great')) {
      positiveLexHits += 2;
    }

    this.classes.forEach(c => {
      const prior = Math.log((this.classDocCounts[c] || 1) / (this.totalDocs || 3));
      let logLikelihood = 0;

      tokens.forEach(token => {
        const count = (this.wordFreqByClass[c] && this.wordFreqByClass[c][token]) || 0;
        // Laplace smoothing
        const probWord = (count + 1) / ((this.totalWordsByClass[c] || 100) + vocabSize);
        logLikelihood += Math.log(probWord);
      });

      // Apply lexicon prior boost
      if (c === 'Positive' && positiveLexHits > 0) {
        logLikelihood += (positiveLexHits * 3.5);
      } else if (c === 'Negative' && negativeLexHits > 0) {
        logLikelihood += (negativeLexHits * 3.5);
      }

      logPosteriors[c] = prior + logLikelihood;
    });

    // Softmax normalization
    const maxLog = Math.max(...Object.values(logPosteriors));
    const expScores = {};
    let sumExp = 0;

    this.classes.forEach(c => {
      expScores[c] = Math.exp(logPosteriors[c] - maxLog);
      sumExp += expScores[c];
    });

    const probabilities = {};
    this.classes.forEach(c => {
      probabilities[c] = expScores[c] / sumExp;
    });

    // Determine winning class
    let predictedClass = 'Neutral';
    let maxProb = 0;
    for (const [c, prob] of Object.entries(probabilities)) {
      if (prob > maxProb) {
        maxProb = prob;
        predictedClass = c;
      }
    }

    // Explicit override if strong polarity is detected
    if (negativeLexHits > positiveLexHits && predictedClass !== 'Negative') {
      predictedClass = 'Negative';
      probabilities['Negative'] = Math.max(probabilities['Negative'], 0.85);
    } else if (positiveLexHits > negativeLexHits && predictedClass !== 'Positive') {
      predictedClass = 'Positive';
      probabilities['Positive'] = Math.max(probabilities['Positive'], 0.85);
    }

    // Sentiment Polarity Score [-1.0 to +1.0]
    let sentimentScore = parseFloat((probabilities['Positive'] - probabilities['Negative']).toFixed(2));
    if (predictedClass === 'Negative' && sentimentScore > -0.5) sentimentScore = -0.85;
    if (predictedClass === 'Positive' && sentimentScore < 0.5) sentimentScore = 0.85;

    // Aspect Extraction
    const lower = text.toLowerCase();
    const pros = [];
    const cons = [];

    // Extract pros
    if (predictedClass !== 'Negative') {
      if (lower.includes('clean') || lower.includes('sanitized') || lower.includes('sterile')) pros.push('Clean & sterile equipment');
      if (lower.includes('relax') || lower.includes('peaceful') || lower.includes('ambiance') || lower.includes('tea') || lower.includes('coffee')) pros.push('Relaxing atmosphere');
      if (lower.includes('gentle') || lower.includes('friendly') || lower.includes('attentive') || lower.includes('polite') || lower.includes('wonderful') || lower.includes('great service')) pros.push('Attentive & friendly staff');
      if (lower.includes('smooth') || lower.includes('glossy') || lower.includes('flawless') || lower.includes('silky') || lower.includes('lasted') || lower.includes('wonderful') || lower.includes('amazing')) pros.push('High quality results');
      if (lower.includes('punctual') || lower.includes('on time') || lower.includes('quick')) pros.push('Punctual service');
      if (lower.includes('fair') || lower.includes('worth') || lower.includes('value')) pros.push('Great value for money');
    }

    // Extract cons
    if (predictedClass !== 'Positive') {
      if (lower.includes('wait') || lower.includes('delay') || lower.includes('late') || lower.includes('double')) cons.push('Wait time / scheduling delay');
      if (lower.includes('rude') || lower.includes('attitude') || lower.includes('texting') || lower.includes('distracted') || lower.includes('phone') || lower.includes('worst customer service') || lower.includes('customer service') || lower.includes('bad service')) cons.push('Unprofessional customer service');
      if (lower.includes('burn') || lower.includes('cuticle') || lower.includes('breakage') || lower.includes('irritation') || lower.includes('allergic')) cons.push('Safety / treatment discomfort');
      if (lower.includes('uneven') || lower.includes('frizz') || lower.includes('short') || lower.includes('patchy') || lower.includes('fell flat') || lower.includes('bad') || lower.includes('worst')) cons.push('Subpar styling outcome');
      if (lower.includes('expensive') || lower.includes('hidden') || lower.includes('overpriced') || lower.includes('charge')) cons.push('Pricing / unexpected fees');
      if (lower.includes('dirty') || lower.includes('dusty') || lower.includes('sticky') || lower.includes('hygiene')) cons.push('Hygiene concerns');
      if (lower.includes('loud') || lower.includes('congested') || lower.includes('warm') || lower.includes('humid')) cons.push('Atmosphere / lounge comfort');
    }

    return {
      sentiment: predictedClass,
      sentimentScore,
      confidence: parseFloat(maxProb.toFixed(3)),
      probabilities,
      pros: [...new Set(pros)],
      cons: [...new Set(cons)]
    };
  }

  /**
   * Save model weights to JSON artifact
   */
  exportModel(filePath) {
    const modelData = {
      classes: this.classes,
      classDocCounts: this.classDocCounts,
      totalDocs: this.totalDocs,
      totalWordsByClass: this.totalWordsByClass,
      wordFreqByClass: this.wordFreqByClass,
      vocabulary: Array.from(this.vocabulary),
      trainedAt: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2));
    console.log(`[Sentiment Trainer] Saved trained model to ${filePath}`);
  }

  /**
   * Load pre-trained weights from JSON artifact
   */
  loadModel(filePath) {
    if (!fs.existsSync(filePath)) return false;
    const modelData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    this.classes = modelData.classes;
    this.classDocCounts = modelData.classDocCounts;
    this.totalDocs = modelData.totalDocs;
    this.totalWordsByClass = modelData.totalWordsByClass;
    this.wordFreqByClass = modelData.wordFreqByClass;
    this.vocabulary = new Set(modelData.vocabulary);
    return true;
  }
}
