import express from "express";
import { 
    register, 
    login, 
    logout, 
    getCustomerAppointments, 
    updateCustomerProfile 
} from "./customerController.js";
import authMiddleware from "../authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/appointments", authMiddleware, getCustomerAppointments);
router.put("/profile", authMiddleware, updateCustomerProfile);

export default router;
