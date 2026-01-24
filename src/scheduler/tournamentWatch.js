import Tournament from "../models/Tournament.js";
// 👇 IMPORTANTE: Ahora importamos la función correcta
import { closeTournamentService } from "../controllers/tournament.controller.js";

export const checkExpiredTournaments = async () => {
    try {
        const now = new Date();
        
        // Buscamos torneos activos cuya fecha de fin ya pasó
        // (Nota: Asegúrate de guardar 'endDate' al crear torneos si quieres usar esto)
        const expiredTournaments = await Tournament.find({
            status: 'active',
            endDate: { $lt: now } 
        });

        if (expiredTournaments.length > 0) {
            console.log(`🔎 Se encontraron ${expiredTournaments.length} torneos expirados.`);
            
            for (const t of expiredTournaments) {
                await closeTournamentService(t._id);
            }
        }
    } catch (error) {
        console.error("⚠️ Error en el vigilante de torneos:", error);
    }
};