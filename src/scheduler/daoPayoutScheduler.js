import cron from "node-cron";
import User from "../models/User.js";
import { executeDAOPayout } from "../models/Dao.js";

/**
 * 🏦 Payout Diario del DAO
 * Se ejecuta automáticamente para premiar la lealtad de todos los Ninjas.
 */
async function payoutDailyDAO() {
    try {
        const users = await User.find({});
        console.log(`Iniciando reparto diario para ${users.length} Ninjas...`);

        for (const user of users) {
            // Usamos la función transaccional que creamos en el modelo Dao.js
            // Esto descuenta del fondo global y suma al balance del usuario de forma segura.
            await executeDAOPayout(user, 10, "Pago diario DAO automático por lealtad");
        }
        
        console.log("💰 Payout diario DAO completado con éxito ✅");
    } catch (error) {
        console.error("❌ Error en el proceso de Payout diario:", error.message);
    }
}

// Configurado para ejecutarse a las 00:00 (Medianoche) todos los días
cron.schedule("0 0 * * *", () => {
    console.log("⏰ Es medianoche en el Dojo. Iniciando protocolos de distribución...");
    payoutDailyDAO();
});

export { payoutDailyDAO };