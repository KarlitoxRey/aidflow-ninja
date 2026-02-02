import express from "express";
import { createDuel, acceptDuel, resolveDuel } from "../controllers/duel.controller.js";
// 👇 AQUÍ ESTABA EL ERROR: Cambiamos 'protect' por 'verifyToken'
import { verifyToken, isShogun } from "../middlewares/auth.middleware.js"; 

const router = express.Router();

// Usamos verifyToken en lugar de protect
router.post("/create", verifyToken, createDuel);
router.put("/accept/:duelId", verifyToken, acceptDuel);
router.post("/resolve", verifyToken, isShogun, resolveDuel); 

export default router;
