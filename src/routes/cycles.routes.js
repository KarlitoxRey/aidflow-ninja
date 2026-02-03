import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
// IMPORTAMOS LOS NOMBRES NUEVOS DEL CONTROLADOR
import { buyLevel, harvestEarnings } from "../controllers/payments.controller.js";

const router = Router();

// ==========================================
// 🔄 RUTAS DE CICLOS (NIVELES)
// ==========================================

// Iniciar un ciclo (Comprar Nivel)
// Antes: buyPass -> Ahora: buyLevel
router.post("/start", verifyToken, buyLevel);

// Retirar ganancias del ciclo
// Antes: withdrawCycle -> Ahora: harvestEarnings
router.post("/withdraw", verifyToken, harvestEarnings);

// Estado del ciclo actual (Opcional, si no usas getWalletDetails)
// router.get("/status", verifyToken, getCycleStatus); 

export default router;
