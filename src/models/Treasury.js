
import mongoose from "mongoose";

const TreasurySchema = new mongoose.Schema({
    identifier: { type: String, default: "MASTER_VAULT", unique: true },
     
    // 💵 CAPA FIAT (Distribución de los $10 USD)
    funds: {
        profit: { type: Number, default: 0 },       // 30% Mantenimiento
        dao: { type: Number, default: 0 },          // 10% DAO
        microBudget: { type: Number, default: 0 },  // 30% Micropagos
        prizePool: { type: Number, default: 0 }     // 30% Premios
    },
    circulatingSupply: { type: Number, default: 0 }, // Total de NC en manos de ninjas
    lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model("Treasury", TreasurySchema);
