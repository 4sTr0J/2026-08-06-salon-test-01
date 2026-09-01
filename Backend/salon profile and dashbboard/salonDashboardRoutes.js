import express from "express";
import {
    getSalonProfile,
    updateSalonProfile,
    getSalonAppointments,
    updateSalonAppointmentStatus
} from "./salonDashboardController.js";
import authMiddleware from "../authMiddleware.js";

const router = express.Router();

// Apply authMiddleware to protect salon profile and dashboard routes
router.use(authMiddleware);

router.get("/profile", getSalonProfile);
router.put("/profile", updateSalonProfile);
router.get("/appointments", getSalonAppointments);
router.put("/appointments/:id/status", updateSalonAppointmentStatus);

export default router;
