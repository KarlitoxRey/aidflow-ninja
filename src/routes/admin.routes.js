import express from 'express';
// Importamos los middlewares de seguridad
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';

// 👇 CORRECCIÓN: Importamos 'updateStatus' en lugar de las funciones viejas
import { createTournament, updateStatus } from '../controllers/tournament.controller.js';

const router = express.Router();

// 🛡️ RUTAS PROTEGIDAS (Solo Shogun)

// 1. Crear Torneo
router.post('/tournament', authMiddleware, adminMiddleware, createTournament);

// 2. Actualizar Estado (Activar / Pausar / Cerrar)
// Usamos PATCH y la función genérica 'updateStatus'
router.patch('/tournament/:id', authMiddleware, adminMiddleware, updateStatus);

export default router;