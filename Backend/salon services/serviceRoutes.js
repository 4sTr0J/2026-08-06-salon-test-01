import express from "express";
import {
    getApprovedSalons,
    getSalonServices,
    getOwnerServices,
    addSalonService,
    deleteSalonService
} from "./serviceController.js";
import authMiddleware from "../authMiddleware.js";

const router = express.Router();

// Public / Customer exploration routes
router.get("/", getApprovedSalons);
router.get("/salons", getApprovedSalons);
router.get("/salons/:id/services", getSalonServices);
router.get("/:id/services", getSalonServices);

// Owner protected service catalog routes
router.get("/services", authMiddleware, getOwnerServices);
router.post("/services", authMiddleware, addSalonService);
router.delete("/services/:id", authMiddleware, deleteSalonService);

export default router;
