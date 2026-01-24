import mongoose from "mongoose";

const TreasurySchema = new mongoose.Schema({
    identifier: { type: String, default: "MASTER_VAULT", unique: true },
    
    // 💵 CAPA FIAT (Distribución de los $10 USD)
    funds: {
        profit: { type: Number, default: 0 },      // Tu ganancia y mantenimiento (30%)
        dao: { type: Number, default: 0 },         // Fondo Comunitario (10%)
        microBudget: { type: Number, default: 0 }, // Presupuesto para pagos diarios (30%)
        prizePool: { type: Number, default: 0 }    // Pozo para premios de torneos (30%)
    },

    // 🪙 CAPA ECONOMÍA INTERNA
    circulatingSupply: { type: Number, default: 0 }, // Total de Ninja Coins emitidas

    lastUpdated: { type: Date, default: Date.now }
});

export default mongoose.model("Treasury", TreasurySchema);