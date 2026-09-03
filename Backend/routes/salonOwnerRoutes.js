import express from "express";
import {
    getSalonProfile,
    updateSalonProfile,
    getSalonAppointments,
    updateSalonAppointmentStatus,
    getSalonEarnings
} from "../salon profile and dashbboard/salonDashboardController.js";
import {
    getOwnerServices,
    addSalonService,
    deleteSalonService
} from "../salon services/serviceController.js";
import authMiddleware from "../authMiddleware.js";

const router = express.Router();

// Apply authMiddleware to protect all owner routes
router.use(authMiddleware);

router.get("/salon", getSalonProfile);
router.put("/salon", updateSalonProfile);
router.get("/services", getOwnerServices);
router.post("/services", addSalonService);
router.delete("/services/:id", deleteSalonService);
router.get("/appointments", getSalonAppointments);
router.put("/appointments/:id/status", updateSalonAppointmentStatus);
router.get("/earnings", getSalonEarnings);

export default router;
