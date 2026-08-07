import { db } from '../Appointments and notification/services/appointmentService.js';
import { analyzeReviewNLP } from './nlpPipeline.js';

/**
 * POST /api/reviews
 * Body: { salonId, appointmentId, rating, reviewText }
 */
export const handleCreateReview = async (req, res) => {
  try {
    const { salonId, appointmentId, rating, reviewText } = req.body;
    const customer_name = req.user?.fullName || req.user?.name || req.user?.email?.split('@')[0] || 'Customer';
    const customer_email = req.user?.email;

    if (!salonId || !rating || !reviewText) {
      return res.status(400).json({ success: false, message: 'salonId, rating, and reviewText are required.' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    // 1. Run the review through our Gemini NLP pipeline
    const nlpResult = await analyzeReviewNLP(reviewText);

    // 2. Save the review details with NLP analytics into Supabase
    const { data, error } = await db
      .from('salon_reviews')
      .insert({
        salon_id: salonId,
        appointment_id: appointmentId || null,
        customer_name,
        customer_email,
        rating: parseInt(rating),
        review_text: reviewText,
        sentiment: nlpResult.sentiment || 'Neutral',
        sentiment_score: nlpResult.sentimentScore !== undefined ? nlpResult.sentimentScore : 0.0,
        pros: nlpResult.pros || [],
        cons: nlpResult.cons || []
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! Your review has been submitted and analyzed.',
      review: data
    });
  } catch (error) {
    console.error('❌ Create Review Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reviews/salon/:salonId
 */
export const handleGetSalonReviews = async (req, res) => {
  try {
    const { salonId } = req.params;

    const { data, error } = await db
      .from('salon_reviews')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ success: true, reviews: data });
  } catch (error) {
    console.error('❌ Get Reviews Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/reviews/salon/:salonId/summary
 * Returns aggregated NLP statistics for the salon (pros/cons count, avg rating)
 */
export const handleGetSalonNLPSummary = async (req, res) => {
  try {
    const { salonId } = req.params;

    const { data: reviews, error } = await db
      .from('salon_reviews')
      .select('rating, sentiment_score, pros, cons')
      .eq('salon_id', salonId);

    if (error) throw error;

    if (!reviews || reviews.length === 0) {
      return res.status(200).json({
        success: true,
        averageRating: 0.0,
        averageSentiment: 0.0,
        pros: [],
        cons: [],
        reviewCount: 0
      });
    }

    let totalRating = 0;
    let totalSentiment = 0;
    const prosFreq = {};
    const consFreq = {};

    reviews.forEach(r => {
      totalRating += r.rating;
      totalSentiment += parseFloat(r.sentiment_score || 0);

      // Aggregate pros/cons frequencies
      const prosList = Array.isArray(r.pros) ? r.pros : [];
      const consList = Array.isArray(r.cons) ? r.cons : [];

      prosList.forEach(p => {
        const key = p.toLowerCase().trim();
        prosFreq[key] = (prosFreq[key] || 0) + 1;
      });

      consList.forEach(c => {
        const key = c.toLowerCase().trim();
        consFreq[key] = (consFreq[key] || 0) + 1;
      });
    });

    const topPros = Object.entries(prosFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    const topCons = Object.entries(consFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);

    return res.status(200).json({
      success: true,
      averageRating: parseFloat((totalRating / reviews.length).toFixed(2)),
      averageSentiment: parseFloat((totalSentiment / reviews.length).toFixed(2)),
      pros: topPros,
      cons: topCons,
      reviewCount: reviews.length
    });
  } catch (error) {
    console.error('❌ Get NLP Summary Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};
