import express from "express";
import { createPayment, getPaymentByAppointment } from "./paymentController.js";
import authMiddleware from "../authMiddleware.js";

const router = express.Router();

// Public healthcheck
router.get("/health", (req, res) => res.json({ success: true, message: "Payment policies system active." }));

// Customer Payment endpoints
router.post("/create", authMiddleware, createPayment);
router.get("/:appointmentId", authMiddleware, getPaymentByAppointment);

export default router;
