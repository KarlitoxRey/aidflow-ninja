import { Router } from "express";
import User from "../models/User.js";

// 👇 IMPORTANTE: Verifica que este nombre de archivo coincida con el que tienes en 'src/middlewares/'
// Si tu archivo se llama 'authMiddleware.js', cambia la ruta aquí.
import { verifyToken } from "../middlewares/auth.middleware.js"; 

// 👇 Importamos la lógica de pagos desde el controlador
import { buyPass, withdrawCycle } from "../controllers/payments.controller.js";

const router = Router();

// ==========================================
// 👁️ CONSULTA (GET)
// ==========================================

// Obtener estado del ciclo activo (Lógica rescatada de tu antiguo active.js)
router.get("/active", verifyToken, async (req, res) => {
    try {
        // Buscamos al usuario y rellenamos los datos del ciclo
        const user = await User.findById(req.user.id).populate("activeCycle");
        
        if (!user || !user.activeCycle) {
            return res.status(404).json({ message: "Sin ciclo activo" });
        }
        
        res.json(user.activeCycle);
    } catch (error) {
        console.error("Error obteniendo ciclo:", error);
        res.status(500).json({ message: "Error del servidor al obtener el ciclo" });
    }
});

// ==========================================
// ⚡ ACCIONES (POST)
// ==========================================

// Iniciar Ciclo (Comprar Pase)
router.post("/start", verifyToken, buyPass);

// Retirar Progreso (Micropagos)
router.post("/withdraw", verifyToken, withdrawCycle);

export default router;