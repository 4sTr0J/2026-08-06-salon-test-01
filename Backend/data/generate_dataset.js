import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const services = [
  'Hair Cut & Blow Dry', 'Balayage Hair Color', 'Keratin Smoothing Treatment', 'Bridal Hair & Makeup',
  'Gel Manicure & Nail Art', 'Deluxe Spa Pedicure', 'Hydra Facial Treatment', 'Deep Tissue Body Massage',
  'Beard Grooming & Shave', 'Eyebrow Threading & Tinting', 'Full Body Waxing', 'Scalp Care Therapy',
  'Hair Extensions', 'Skin Rejuvenation Peel', 'Aromatherapy Sauna'
];

const positiveTemplates = [
  { text: 'Outstanding service! The stylist was meticulous, gentle, and the salon ambiance is pristine and luxurious.', pros: ['meticulous stylist', 'gentle handling', 'pristine ambiance', 'luxurious experience'] },
  { text: 'Hands down the best treatment I have ever had. The results exceeded all my expectations.', pros: ['exceeded expectations', 'top quality results', 'skilled therapist'] },
  { text: 'Very welcoming team and peaceful environment. Left feeling completely rejuvenated and refreshed.', pros: ['welcoming team', 'peaceful environment', 'rejuvenating'] },
  { text: 'Impressed with their attention to detail. Tools were sanitized right in front of me.', pros: ['sanitized tools', 'attention to detail', 'high hygiene standards'] },
  { text: 'Flawless styling and long-lasting finish. Worth every single penny spent.', pros: ['flawless finish', 'long lasting', 'great value'] },
  { text: 'Super friendly staff who offered great consultations and customized the service to my skin type.', pros: ['friendly staff', 'personalized consultation', 'customized treatment'] },
  { text: 'Punctual, professional, and courteous. They finished right on time without rushing.', pros: ['punctual', 'professional', 'no rushing'] },
  { text: 'The atmosphere is top tier with complimentary coffee, calming music, and cozy seating.', pros: ['complimentary refreshments', 'calming music', 'cozy seating'] },
  { text: 'My hair feels healthier and glossier than ever before. Highly recommended salon!', pros: ['glossy hair', 'healthy hair texture', 'highly recommended'] },
  { text: 'Masterful work! Exactly matched the photo reference I brought from Instagram.', pros: ['matched photo reference', 'artistic precision', 'masterful work'] },
  { text: 'Top tier precision and cleanliness. My stylist took the time to understand my routine.', pros: ['personalized styling', 'clean equipment', 'attentive staff'] },
  { text: 'Such a relaxing and pampering session. Left feeling energized and confident.', pros: ['pampering session', 'confidence boost', 'skilled treatment'] },
  { text: 'Premium products used throughout. No chemical smell and long lasting results.', pros: ['premium products', 'no harsh smell', 'durable styling'] },
  { text: 'Amazing scalp massage and blow dry. My hair has so much bounce and volume now.', pros: ['relaxing scalp massage', 'voluminous hair', 'great blowout'] },
  { text: 'Exceptional hospitality and modern techniques. Will definitely be a regular client here.', pros: ['exceptional hospitality', 'modern styling', 'repeat client'] }
];

const neutralTemplates = [
  { text: 'Service was acceptable and did the job. Nothing particularly special or memorable, but fair.', pros: ['did the job'], cons: ['unremarkable experience'] },
  { text: 'Decent results overall, though the appointment started about 15 minutes later than scheduled.', pros: ['decent results'], cons: ['15 minute wait time'] },
  { text: 'Average experience. The staff was polite, but the waiting lounge was somewhat congested.', pros: ['polite staff'], cons: ['congested waiting area'] },
  { text: 'The treatment felt okay, but I expected a bit more detailed explanation from the specialist.', pros: ['adequate treatment'], cons: ['lacked detailed explanation'] },
  { text: 'Standard quality for the price paid. Neither disappointed nor overly impressed.', pros: ['fair price'], cons: ['standard quality'] },
  { text: 'Finished the session quickly which was convenient, though it felt slightly mechanical.', pros: ['quick session'], cons: ['felt mechanical'] },
  { text: 'The result was fine, but the room temperature was slightly warmer than comfortable.', pros: ['acceptable result'], cons: ['warm room temperature'] },
  { text: 'Regular salon visit. Basic products used, but customer service was cordial.', pros: ['cordial customer service'], cons: ['basic product selection'] },
  { text: 'Okay service. Color tone turned out slightly darker than expected, but still acceptable.', pros: ['acceptable shade'], cons: ['slightly darker than requested'] },
  { text: 'Clean place and decent staff. Music was a bit modern and upbeat rather than relaxing.', pros: ['clean salon'], cons: ['music not relaxing'] },
  { text: 'Adequate haircut for daily routine. Took slightly longer due to shift changes.', pros: ['adequate haircut'], cons: ['slight delay due to shift changes'] },
  { text: 'Moderate polish selection for nails. Quick turnaround for a busy afternoon.', pros: ['quick turnaround'], cons: ['moderate polish choices'] },
  { text: 'Reasonable price point. Service was standard and met the basic expectations.', pros: ['reasonable price'], cons: ['standard service'] },
  { text: 'Session was fine, but stylist was somewhat quiet and did not offer styling advice.', pros: ['straightforward session'], cons: ['lacked proactive advice'] },
  { text: 'Normal experience. Facilities are clean, but parking outside was limited.', pros: ['clean facilities'], cons: ['limited parking'] }
];

const negativeTemplates = [
  { text: 'Terrible experience. Had to wait over 45 minutes despite having a confirmed booking, and staff did not care.', pros: [], cons: ['45 minute delay', 'uncaring staff', 'poor time management'] },
  { text: 'Ruined my hair completely! Cut it way shorter than agreed and left uneven patches on the back.', pros: [], cons: ['uneven haircut', 'cut too short', 'damaged styling'] },
  { text: 'The chemical solution burned my skin and caused severe redness and irritation.', pros: [], cons: ['chemical burn', 'skin irritation', 'safety violation'] },
  { text: 'Extremely rude customer service. Receptionist rolled her eyes and refused to answer my questions.', pros: [], cons: ['rude receptionist', 'bad attitude', 'unhelpful staff'] },
  { text: 'Overpriced and poor quality. The styling fell apart within two hours of leaving the salon.', pros: [], cons: ['overpriced', 'styling fell apart quickly', 'poor quality'] },
  { text: 'Unsanitary conditions! Found hair on the brushes and the styling chair was sticky.', pros: [], cons: ['unsanitary equipment', 'unclean chairs', 'hygiene concerns'] },
  { text: 'They charged me extra hidden fees at checkout that were never mentioned during booking.', pros: [], cons: ['hidden fees', 'unexpected charges', 'unclear billing'] },
  { text: 'The technician was completely distracted, constantly texting on her phone during my treatment.', pros: [], cons: ['distracted technician', 'texting on phone', 'unprofessional'] },
  { text: 'Arrived on time only to be told they double-booked my appointment and asked me to reschedule.', pros: [], cons: ['double booking', 'cancelled on arrival', 'unreliable'] },
  { text: 'Product used gave me an allergic breakout on my scalp. Won’t ever return here.', pros: [], cons: ['allergic reaction', 'poor product quality', 'scalp breakout'] },
  { text: 'Rushed through my appointment and skipped several steps mentioned in the package description.', pros: [], cons: ['rushed service', 'skipped steps', 'misleading description'] },
  { text: 'Bleach was left on far too long, causing extreme hair breakage and split ends.', pros: [], cons: ['overprocessed hair', 'hair breakage', 'technician negligence'] },
  { text: 'Nail technician cut multiple cuticles causing bleeding and failed to sanitize properly.', pros: [], cons: ['cut cuticles', 'bleeding', 'poor hygiene'] },
  { text: 'Wax was boiling hot and left burns on my arms. Incompetent staff.', pros: [], cons: ['burns from hot wax', 'incompetent staff', 'painful session'] },
  { text: 'Total lack of cleanliness and communication. Zero customer care.', pros: [], cons: ['dirty salon', 'poor communication', 'lack of customer care'] }
];

const dataset = [];
let id = 1;

// 1. Generate 50 Positive
for (let i = 0; i < 50; i++) {
  const t = positiveTemplates[i % positiveTemplates.length];
  const s = services[i % services.length];
  const score = (0.75 + (i % 25) * 0.01).toFixed(2);
  dataset.push({
    id: id++,
    review_text: `${t.text} ${i % 2 === 0 ? `Would definitely book ${s} again!` : 'Five stars for the exceptional team.'}`,
    service_name: s,
    rating: (i % 5 === 0) ? 4 : 5,
    sentiment: 'Positive',
    sentiment_score: parseFloat(score),
    pros: t.pros,
    cons: []
  });
}

// 2. Generate 50 Neutral
for (let i = 0; i < 50; i++) {
  const t = neutralTemplates[i % neutralTemplates.length];
  const s = services[i % services.length];
  const score = ((-0.08) + (i % 17) * 0.01).toFixed(2);
  dataset.push({
    id: id++,
    review_text: `${t.text} ${i % 2 === 0 ? `Adequate for ${s}.` : 'Might consider them again if nearby.'}`,
    service_name: s,
    rating: 3,
    sentiment: 'Neutral',
    sentiment_score: parseFloat(score),
    pros: t.pros,
    cons: t.cons
  });
}

// 3. Generate 50 Negative
for (let i = 0; i < 50; i++) {
  const t = negativeTemplates[i % negativeTemplates.length];
  const s = services[i % services.length];
  const score = ((-0.95) + (i % 26) * 0.01).toFixed(2);
  dataset.push({
    id: id++,
    review_text: `${t.text} ${i % 2 === 0 ? `Extremely dissatisfied with ${s}.` : 'Total waste of time and money.'}`,
    service_name: s,
    rating: (i % 4 === 0) ? 2 : 1,
    sentiment: 'Negative',
    sentiment_score: parseFloat(score),
    pros: [],
    cons: t.cons
  });
}

const targetJson = path.join(__dirname, 'salon_reviews_dataset.json');
const targetCsv = path.join(__dirname, 'salon_reviews_dataset.csv');

fs.writeFileSync(targetJson, JSON.stringify(dataset, null, 2));

const headers = 'id,review_text,service_name,rating,sentiment,sentiment_score,pros,cons\n';
const csvRows = dataset.map(row => {
  const textEsc = `"${row.review_text.replace(/"/g, '""')}"`;
  const servEsc = `"${row.service_name.replace(/"/g, '""')}"`;
  const prosEsc = `"${row.pros.join('; ')}"`;
  const consEsc = `"${row.cons.join('; ')}"`;
  return [row.id, textEsc, servEsc, row.rating, row.sentiment, row.sentiment_score, prosEsc, consEsc].join(',');
}).join('\n');

fs.writeFileSync(targetCsv, headers + csvRows);

console.log(`Generated ${dataset.length} total reviews (50 Positive, 50 Neutral, 50 Negative) in JSON & CSV.`);
