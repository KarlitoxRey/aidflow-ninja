import express from 'express';
import { register, login, verifyEmail, getMe } from '../controllers/auth.Controller.js';
// Asegúrate de tener un middleware para proteger rutas (si no lo tienes, avísame)
// import { protect } from '../middlewares/authMiddleware.js'; 

const router = express.Router();

// 1. Ruta para Registrarse (POST /api/auth/register)
router.post('/register', register);

// 2. Ruta para Iniciar Sesión (POST /api/auth/login)
router.post('/login', login);

// 3. Ruta para Verificar Email (POST /api/auth/verify)
router.post('/verify', verifyEmail);

// 4. Ruta para obtener perfil (GET /api/auth/me) - Opcional por ahora
// router.get('/me', protect, getMe);

export default router;
