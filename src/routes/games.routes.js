import { Router } from "express";
import { getGames, createGame, deleteGame } from "../controllers/games.controller.js";
// 👇 AQUÍ ESTABA EL ERROR: Agregamos la 's' a 'middlewares'
import { verifyToken } from "../middlewares/auth.middleware.js"; 

const router = Router();

// Obtener juegos (Público)
router.get("/", getGames);

// Crear juego (Solo Shogun/Admin)
router.post("/", verifyToken, createGame);

// Eliminar juego (Solo Shogun/Admin)
router.delete("/:id", verifyToken, deleteGame);

export default router;