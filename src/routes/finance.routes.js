import express from "express";
import { confirmDeposit, getTreasuryStats } from "../controllers/finance.controller.js";
import { verifyToken, isShogun } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Solo el Shogun puede ver el estado real del tesoro
router.get("/stats", verifyToken, isShogun, getTreasuryStats);

// Confirmación de depósitos (Normalmente llamada por un webhook de pagos o Admin)
router.post("/confirm", verifyToken, isShogun, confirmDeposit);

export default router;
