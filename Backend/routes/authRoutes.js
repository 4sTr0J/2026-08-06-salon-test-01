import express from "express";
import { 
    register, 
    login, 
    logout, 
    getCustomerAppointments 
} from "../Customer profile management/customerController.js";
import { 
    getApprovedSalons, 
    getSalonServices 
} from "../salon services/serviceController.js";
import authMiddleware from "../authMiddleware.js";
import { handleCreateAppointment } from "../Appointments and notification/controllers/appointmentController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/salons", getApprovedSalons);
router.get("/salons/:id/services", getSalonServices);
router.post("/appointments", authMiddleware, handleCreateAppointment);
router.get("/appointments", authMiddleware, getCustomerAppointments);

export default router;