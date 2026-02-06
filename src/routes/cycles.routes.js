import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

// NOTA DEL SHOGUN:
// Las funciones de "Comprar Nivel" (buyLevel) ahora viven en: economy.routes.js
// Las funciones de "Cosechar/Retirar" (harvest) ahora viven en: payments.routes.js

// Dejamos este archivo limpio por ahora para evitar errores de despliegue.
// Si en el futuro agregas lógica específica de ciclos (ej: ver historial de ciclos), va aquí.

router.get("/", verifyToken, (req, res) => {
    res.json({ message: "Módulo de Ciclos activo. Usa /api/economy para operaciones." });
});

export default router;
