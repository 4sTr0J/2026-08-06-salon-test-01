import express from 'express';
import {
    getActiveCancellationPolicy,
    getAllCancellationPolicies,
    createCancellationPolicy,
    updateCancellationPolicy,
    deleteCancellationPolicy,
} from './cancellationPolicyController.js';

const router = express.Router();

// GET  /cancellation-policy/active?salon_id=<uuid>  — get active policy for a salon
router.get('/active', getActiveCancellationPolicy);

// GET  /cancellation-policy?salon_id=<uuid>          — get all policies for a salon
router.get('/', getAllCancellationPolicies);

// POST /cancellation-policy                           — create a new policy
router.post('/', createCancellationPolicy);

// PUT  /cancellation-policy/:id                       — update a policy by ID
router.put('/:id', updateCancellationPolicy);

// DELETE /cancellation-policy/:id                     — delete a policy by ID
router.delete('/:id', deleteCancellationPolicy);

export default router;
