import express from "express";
import { createDuel, acceptDuel, resolveDuel } from "../controllers/duel.controller.js";
// 👇 CORRECCIÓN AQUÍ: Usamos verifyToken
import { verifyToken, isShogun } from "../middlewares/auth.middleware.js"; 

const router = express.Router();

router.post("/create", verifyToken, createDuel);
router.put("/accept/:duelId", verifyToken, acceptDuel);
router.post("/resolve", verifyToken, isShogun, resolveDuel); 

export default router;
