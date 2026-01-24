import { Router } from "express";
import { 
    getWalletDetails, 
    buyPass, 
    requestDeposit, 
    manageDeposit, 
    getPendingTransactions 
} from "../controllers/payments.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js"; 

const router = Router();

// --- RUTAS DE USUARIO ---
router.get("/wallet", verifyToken, getWalletDetails);
router.post("/buy-pass", verifyToken, buyPass);

// 🏦 Solicitud de Depósito Manual
router.post("/deposit", verifyToken, requestDeposit);

// --- RUTAS DE SHOGUN (ADMIN) ---
// Aprobar/Rechazar depósitos
router.post("/manage", verifyToken, manageDeposit);
// Ver lista de espera
router.get("/pending", verifyToken, getPendingTransactions);

export default router;