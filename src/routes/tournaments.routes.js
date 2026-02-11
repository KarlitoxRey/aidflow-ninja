import { Router } from "express";
import { 
    getTournaments, 
    getRanking, 
    submitScore, 
    createTournament,
    deleteTournament
} from "../controllers/tournaments.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

// ==========================================
// 🔓 RUTAS GENERALES (Ninjas Logueados)
// ==========================================

// Listar torneos
router.get("/", verifyToken, getTournaments);

// Obtener Ranking de un torneo específico
router.get("/ranking/:tournamentId", verifyToken, getRanking);

// Registrar Puntaje (Cuando termina un juego)
router.post("/submit-score", verifyToken, submitScore);

// ==========================================
// 🛡️ RUTAS DE SHOGUN (Creación / Eliminación)
// ==========================================

// Crear Torneo (La verificación de Shogun se hace dentro del controlador)
router.post("/", verifyToken, createTournament);

// Eliminar Torneo
router.delete("/:id", verifyToken, deleteTournament);

export default router;
