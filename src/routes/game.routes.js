import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import User from '../models/User.js';
import GameRecord from '../models/GameRecord.js';

const router = express.Router();

// 💰 ENDPOINT: COBRAR RE-COMPRA (CONTINUE)
router.post('/continue', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Costo de 1 ficha (ajusta según tu lógica de créditos)
        if (user.balance < 1) {
            return res.status(403).json({ error: "Saldo insuficiente en el Dojo." });
        }

        user.balance -= 1;
        await user.save();

        res.json({ success: true, newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ error: "Error al procesar el tributo." });
    }
});

// 🏆 ENDPOINT: GUARDAR RÉCORD
router.post('/save-score', authMiddleware, async (req, res) => {
    const { score } = req.body;
    try {
        const newRecord = new GameRecord({
            user: req.user.id,
            maxDistance: score
        });
        await newRecord.save();
        res.json({ success: true, message: "Récord inmortalizado." });
    } catch (err) {
        res.status(500).json({ error: "Fallo al escribir en el pergamino." });
    }
});

export default router;