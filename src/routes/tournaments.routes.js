import { Router } from "express";
import { 
    getTournaments, 
    getRanking, 
    submitScore, 
    createTournament 
} from "../controllers/tournaments.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js"; // 👈 Corregido a 'middlewares'

const router = Router();

// ==========================================
// 🔓 RUTAS GENERALES (Ninjas Logueados)
// ==========================================

// Listar torneos
router.get("/", verifyToken, getTournaments);

// Obtener Ranking de un torneo específico
router.get("/ranking/:tournamentId", getRanking);

// Registrar Puntaje (Cuando termina un juego)
router.post("/submit-score", verifyToken, submitScore);

// ==========================================
// 🛡️ RUTAS DE SHOGUN (Creación)
// ==========================================

// Crear Torneo (La verificación de Shogun se hace dentro del controlador)
router.post("/", verifyToken, createTournament);

export default router;