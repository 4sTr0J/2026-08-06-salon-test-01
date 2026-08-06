import express from "express";
import { register, login, logout, getApprovedSalons, getSalonServices } from "../authController.js";
import authMiddleware from "../authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/salons", authMiddleware, getApprovedSalons);
router.get("/salons/:id/services", authMiddleware, getSalonServices);

export default router;