import { Router } from "express";
import { verifyToken, isShogun } from "../middlewares/auth.middleware.js";
import { 
    getWalletDetails, 
    requestDeposit, 
    requestPayout, 
    getPendingTransactions, 
    manageDeposit 
} from "../controllers/payments.controller.js";

const router = Router();

// ==========================================
// 👤 RUTAS DE USUARIO
// ==========================================

// Ver Billetera y Movimientos
router.get("/wallet", verifyToken, getWalletDetails);

// Solicitar Depósito (Subir comprobante)
router.post("/deposit", verifyToken, requestDeposit);

// Solicitar Retiro
router.post("/payout", verifyToken, requestPayout);

// NOTA: 'buyLevel' se eliminó de aquí porque ahora se maneja en 'economy.routes.js'
// NOTA: 'harvestEarnings' se eliminó porque el retiro es 'payout'

// ==========================================
// 🛡️ RUTAS DE ADMIN (TESORERÍA)
// ==========================================

// Ver transacciones pendientes
router.get("/pending", verifyToken, isShogun, getPendingTransactions);

// Gestionar Depósitos (Aprobar/Rechazar)
router.post("/manage", verifyToken, isShogun, manageDeposit);

export default router;
