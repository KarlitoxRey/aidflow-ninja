import { Router } from "express";
import { 
    getWalletDetails, 
    buyPass,         // <--- Asegurate que coincida con el controller
    requestDeposit, 
    manageDeposit, 
    withdrawCycle,   // <--- Agregué esta que faltaba en tu router anterior
    getPendingTransactions 
} from "../controllers/payments.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js"; 

const router = Router();

// --- RUTAS DE USUARIO ---
router.get("/wallet", verifyToken, getWalletDetails);
router.post("/buy-pass", verifyToken, buyPass);
router.post("/withdraw", verifyToken, withdrawCycle);
router.post("/deposit", verifyToken, requestDeposit);

// --- RUTAS DE SHOGUN (ADMIN) ---
router.post("/manage", verifyToken, manageDeposit);
router.get("/pending", verifyToken, getPendingTransactions);

export default router;
