import express from "express";
import { confirmDeposit, getTreasuryStats, getAdminDashboard } from "../controllers/finance.controller.js";
import { verifyToken, isShogun } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Stats básicos del Tesoro (Legacy)
router.get("/stats", verifyToken, isShogun, getTreasuryStats);

// Confirmación manual (Legacy)
router.post("/confirm", verifyToken, isShogun, confirmDeposit);

// 🔥 NUEVO: Dashboard completo en tiempo real
router.get("/dashboard", verifyToken, isShogun, getAdminDashboard);

export default router;
