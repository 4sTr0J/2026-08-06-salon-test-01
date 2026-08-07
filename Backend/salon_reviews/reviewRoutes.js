import express from 'express';
import { handleCreateReview, handleGetSalonReviews, handleGetSalonNLPSummary } from './reviewController.js';
import authMiddleware from '../authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/salon/:salonId', handleGetSalonReviews);
router.get('/salon/:salonId/summary', handleGetSalonNLPSummary);

// Protected routes (Only logged in customers can post reviews)
router.post('/', authMiddleware, handleCreateReview);

export default router;
