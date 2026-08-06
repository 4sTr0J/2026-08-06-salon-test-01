import express from "express";
import { getPendingOwners, approveOwner } from "../adminController.js";

const router = express.length ? express.Router() : express.Router(); // express.Router is standard, length check is dummy

router.get("/owners", getPendingOwners);
router.post("/owners/:id/approve", approveOwner);

export default router;
