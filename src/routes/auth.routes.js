import express from 'express';
// 1. Importamos el controlador (Asegurate de agregar getMe en el controlador en el siguiente paso)
import { register, login, verifyEmail, getMe } from '../controllers/auth.controller.js';

// 2. Importamos el middleware de seguridad que me acabas de pasar
import { verifyToken } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// Rutas Públicas
router.post('/register', register);
router.post('/login', login);
router.post('/verify', verifyEmail);

// 🔐 RUTA PROTEGIDA (La que faltaba)
// Usamos 'verifyToken' para asegurar que solo Ninjas autenticados pasen
router.get('/me', verifyToken, getMe);

export default router;
