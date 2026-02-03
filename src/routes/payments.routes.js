import { Router } from "express";
import { verifyToken, isShogun } from "../middlewares/auth.middleware.js";
import { 
    getWalletDetails, 
    requestDeposit, 
    requestPayout, 
    buyLevel,        // <--- AQUI ESTABA EL ERROR (Antes decía buyPass)
    harvestEarnings, 
    getPendingTransactions, 
    manageDeposit 
} from "../controllers/payments.controller.js";

const router = Router();

// ==========================================
// 👤 RUTAS DE USUARIO
// ==========================================

// Billetera
router.get("/wallet", verifyToken, getWalletDetails);

// Depósitos y Retiros
router.post("/deposit", verifyToken, requestDeposit);
router.post("/payout", verifyToken, requestPayout);

// JUEGO: Comprar Nivel (Antes buy-pass, ahora buy-level)
router.post("/buy-level", verifyToken, buyLevel);

// JUEGO: Cosechar
router.post("/harvest", verifyToken, harvestEarnings);
router.post("/withdraw", verifyToken, harvestEarnings); // Alias por compatibilidad

// ==========================================
// 🛡️ RUTAS DE ADMIN (TESORERÍA)
// ==========================================

// Ver pendientes
router.get("/pending", verifyToken, isShogun, getPendingTransactions);

// Gestionar (Aprobar/Rechazar)
router.post("/manage", verifyToken, isShogun, manageDeposit);

export default router;
