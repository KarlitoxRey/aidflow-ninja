import mongoose from "mongoose";

const DaoSchema = new mongoose.Schema({
    // --- 🏦 EL TESORO DEL CLAN (Registro Único) ---
    // Usamos esta bandera para encontrar siempre el balance global
    isTreasuryRecord: { type: Boolean, default: false, unique: true, sparse: true },
    
    totalReserve: { type: Number, default: 0 },    // Dinero total en la bóveda
    poolMicropayments: { type: Number, default: 0 }, // Fondo para misiones diarias
    totalDistributed: { type: Number, default: 0 }, // Histórico repartido

    // --- 📜 AUDITORÍA DE MOVIMIENTOS (Registros Individuales) ---
    // Si no es el registro de tesorería, es una transacción
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    amount: { type: Number, default: 0 },
    type: {
        type: String,
        enum: ["payout", "income", "reserve_refill", "maintenance"],
        default: "payout"
    },
    status: { 
        type: String, 
        enum: ["completed", "failed", "pending"], 
        default: "completed" 
    },
    notes: { type: String, default: "" }

}, { timestamps: true });

/**
 * ⚔️ MÉTODO ESTÁTICO: EJECUTAR DISTRIBUCIÓN DE BOTÍN
 * Implementa ACID Transactions para que no se pierda ni un NC.
 */
DaoSchema.statics.executePayout = async function(userId, amount, notes = "Premio de Torneo") {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const User = mongoose.model("User");
        
        // 1. Descontar del Tesoro Global
        const treasury = await this.findOneAndUpdate(
            { isTreasuryRecord: true },
            { 
                $inc: { 
                    totalReserve: -amount, 
                    totalDistributed: amount 
                } 
            },
            { upsert: true, new: true, session }
        );

        if (treasury.totalReserve < 0) {
            throw new Error("Fondos insuficientes en la bóveda del Shogun");
        }

        // 2. Acreditar al Guerrero
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: { balance: amount } },
            { new: true, session }
        );

        // 3. Crear recibo de auditoría
        const log = new this({
            userId,
            amount,
            type: "payout",
            notes
        });
        await log.save({ session });

        await session.commitTransaction();
        return { success: true, newBalance: user.balance };

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export default mongoose.model("Dao", DaoSchema);
