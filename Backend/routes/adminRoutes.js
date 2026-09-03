import express from "express";
import { 
    adminLogin,
    verifyAdminSecret,
    getPendingOwners, 
    approveOwner, 
    deleteOwner 
} from "../Admin control/adminController.js";
import {
    getPlatformRevenueSummary,
    getRecentPayments,
    releaseSalonPayout,
    getRefundRequests,
    markRefundCompleted
} from "../payment policies/adminRevenueController.js";

const router = express.Router();

// Public Admin Login
router.post("/login", adminLogin);

// Protected Admin Endpoints
router.get("/owners", verifyAdminSecret, getPendingOwners);
router.post("/owners/:id/approve", verifyAdminSecret, approveOwner);
router.delete("/owners/:id", verifyAdminSecret, deleteOwner);

// Admin Income & Revenue Ledger Endpoints
router.get("/revenue", verifyAdminSecret, getPlatformRevenueSummary);
router.get("/payments", verifyAdminSecret, getRecentPayments);
router.post("/payments/:paymentId/release-payout", verifyAdminSecret, releaseSalonPayout);

// Admin Cancellation Refunds & Bank Transfer Endpoints
router.get("/refunds", verifyAdminSecret, getRefundRequests);
router.post("/refunds/:refundId/complete", verifyAdminSecret, markRefundCompleted);

export default router;
