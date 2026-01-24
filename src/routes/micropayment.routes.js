import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import MicropaymentLog from "../models/MicropaymentLog.js";
import { giveMicropayment } from "../controllers/micropayment.controller.js"; // Asegúrate de haber creado el controller que te pasé antes

const router = express.Router();

/**
 * 💸 EJECUTAR MICROPAGO
 * Esta es la ruta que hace avanzar el ciclo
 */
router.post("/give", protect, giveMicropayment);

/**
 * 🔍 CONSULTAR ESTADO DIARIO
 * Verifica si el Ninja ya cumplió con su aporte hoy
 */
router.get("/status/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentToday = await MicropaymentLog.findOne({
      userId,
      createdAt: { $gte: today }
    });

    res.json({ 
        hasPaidToday: !!paymentToday, 
        lastPayment: paymentToday || null 
    });
  } catch (err) {
    res.status(500).json({ error: "Error verificando micropago diario" });
  }
});

export default router;