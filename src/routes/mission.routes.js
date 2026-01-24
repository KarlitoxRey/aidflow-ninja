import { Router } from "express";
import { getMissions, completeMission, createMission } from "../controllers/mission.controller.js";
// 👇 LA CORRECCIÓN CLAVE: 'middlewares' (Plural)
import { verifyToken } from "../middlewares/auth.middleware.js"; 

const router = Router();

// Listar misiones
router.get("/", verifyToken, getMissions);

// Completar misión
router.post("/complete", verifyToken, completeMission);

// Crear misión (Admin)
router.post("/", verifyToken, createMission);

export default router;