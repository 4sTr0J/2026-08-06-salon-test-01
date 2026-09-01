import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SentimentClassifier } from './sentimentModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const datasetPath = path.join(__dirname, '../data/salon_reviews_dataset.json');
const modelOutputPath = path.join(__dirname, 'trained_sentiment_model.json');

console.log('🚀 Starting Model Training on Salon Review Dataset...');

if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset not found at ${datasetPath}`);
  process.exit(1);
}

const rawData = fs.readFileSync(datasetPath, 'utf8');
const dataset = JSON.parse(rawData);

console.log(`Loaded ${dataset.length} training records.`);

// Shuffle dataset
const shuffled = [...dataset].sort(() => 0.5 - Math.random());

// 80/20 Train/Test Split
const splitIdx = Math.floor(shuffled.length * 0.8);
const trainSet = shuffled.slice(0, splitIdx);
const testSet = shuffled.slice(splitIdx);

console.log(`Training Set: ${trainSet.length} samples`);
console.log(`Evaluation / Validation Set: ${testSet.length} samples\n`);

const model = new SentimentClassifier();
model.train(trainSet);

// Evaluate model performance on unseen test set
let correct = 0;
const confusionMatrix = {
  Positive: { Positive: 0, Neutral: 0, Negative: 0 },
  Neutral: { Positive: 0, Neutral: 0, Negative: 0 },
  Negative: { Positive: 0, Neutral: 0, Negative: 0 }
};

testSet.forEach(sample => {
  const pred = model.predict(sample.review_text);
  confusionMatrix[sample.sentiment][pred.sentiment]++;
  if (pred.sentiment === sample.sentiment) {
    correct++;
  }
});

const accuracy = ((correct / testSet.length) * 100).toFixed(1);

console.log('\n================ EVALUATION REPORT ================');
console.log(`Model Validation Accuracy: ${accuracy}% (${correct}/${testSet.length} correct)`);
console.log('\nConfusion Matrix (Actual vs Predicted):');
console.log('----------------------------------------------------');
console.log('Actual \\ Predicted | Positive | Neutral | Negative |');
console.log('----------------------------------------------------');
for (const actual of ['Positive', 'Neutral', 'Negative']) {
  const p = String(confusionMatrix[actual]['Positive']).padStart(8, ' ');
  const nu = String(confusionMatrix[actual]['Neutral']).padStart(7, ' ');
  const ng = String(confusionMatrix[actual]['Negative']).padStart(8, ' ');
  console.log(`${actual.padEnd(18, ' ')}|${p} |${nu} |${ng} |`);
}
console.log('----------------------------------------------------\n');

// Train on full dataset for production export
console.log('🔄 Fitting final production weights on full 150 samples...');
const productionModel = new SentimentClassifier();
productionModel.train(dataset);
productionModel.exportModel(modelOutputPath);

// Quick validation inferences
console.log('\n🧪 Running Test Inferences:');
const testSamples = [
  'Stylist was amazing and my balayage looks fabulous with no damage!',
  'Haircut was average. Waiting area was slightly crowded but service was okay.',
  'Terrible experience. They burnt my scalp with bleach and refused to refund me.'
];

testSamples.forEach((t, i) => {
  const result = productionModel.predict(t);
  console.log(`\nSample ${i + 1}: "${t}"`);
  console.log(`➜ Predicted: [${result.sentiment}] (Score: ${result.sentimentScore}, Confidence: ${result.confidence})`);
  console.log(`➜ Pros: ${JSON.stringify(result.pros)}`);
  console.log(`➜ Cons: ${JSON.stringify(result.cons)}`);
});

console.log('\n✅ Sentiment Analysis Model Training Completed Successfully!');
