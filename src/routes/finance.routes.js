import express from "express";
// 👇 Importamos la nueva función getAdminDashboard
import { confirmDeposit, getTreasuryStats, getAdminDashboard } from "../controllers/finance.controller.js";
import { verifyToken, isShogun } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Rutas existentes...
router.get("/stats", verifyToken, isShogun, getTreasuryStats);
router.post("/confirm", verifyToken, isShogun, confirmDeposit);

// 👇 AGREGAR ESTA RUTA NUEVA 👇
router.get("/dashboard", verifyToken, isShogun, getAdminDashboard);

export default router;
