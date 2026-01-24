import express from "express";
import { getTreasuryStats, getPublicStats, confirmDeposit } from "../controllers/finance.controller.js";
// Asegúrate de importar tus middlewares de auth aquí
// import { verifyToken, isAdmin, verifyTokenOptional } from "../middlewares/auth.js"; 

const router = express.Router();

// Ruta privada para el Shogun (Admin)
// router.get("/admin", verifyToken, isAdmin, getTreasuryStats);
router.get("/admin", getTreasuryStats); // (Añade los middlewares cuando integres)

// Ruta para confirmar pagos (Admin)
// router.post("/deposit", verifyToken, isAdmin, confirmDeposit);
router.post("/deposit", confirmDeposit);

// Ruta pública para usuarios (Ver DAO y Premios)
router.get("/public", getPublicStats);

export default router;
