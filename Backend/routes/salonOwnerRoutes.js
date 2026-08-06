import express from "express";
import {
    getSalonDetails,
    updateSalonDetails,
    getServices,
    addService,
    deleteService,
    getAppointments
} from "../salonOwnerController.js";
import authMiddleware from "../authMiddleware.js";

const router = express.Router();

// Apply authMiddleware to protect all owner routes
router.use(authMiddleware);

router.get("/salon", getSalonDetails);
router.put("/salon", updateSalonDetails);
router.get("/services", getServices);
router.post("/services", addService);
router.delete("/services/:id", deleteService);
router.get("/appointments", getAppointments);

export default router;
