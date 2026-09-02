import express from "express";
import { 
    adminLogin,
    verifyAdminSecret,
    getPendingOwners, 
    approveOwner, 
    deleteOwner 
} from "../Admin control/adminController.js";

const router = express.Router();

// Public Admin Login
router.post("/login", adminLogin);

// Protected Admin Endpoints
router.get("/owners", verifyAdminSecret, getPendingOwners);
router.post("/owners/:id/approve", verifyAdminSecret, approveOwner);
router.delete("/owners/:id", verifyAdminSecret, deleteOwner);

export default router;
