import express from "express";
import { getPendingOwners, approveOwner, deleteOwner } from "./adminController.js";

const router = express.Router();

router.get("/owners", getPendingOwners);
router.post("/owners/:id/approve", approveOwner);
router.delete("/owners/:id", deleteOwner);

export default router;
