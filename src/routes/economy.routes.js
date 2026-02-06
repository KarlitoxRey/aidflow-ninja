import { Router } from "express";
import { processNinjaEntry } from "../controllers/economy.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

// ESTA ES LA NUEVA RUTA PARA "COMPRAR NIVEL"
// El frontend llama a: /api/economy/entry
router.post("/entry", verifyToken, processNinjaEntry);

export default router;
