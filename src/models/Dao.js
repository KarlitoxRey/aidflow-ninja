import mongoose from "mongoose";

const daoSchema = new mongoose.Schema({
    // --- 🏦 VISIÓN DE TESORERÍA (Balance Global) ---
    totalFund: { 
        type: Number, 
        default: 0 
    }, // Dinero actual disponible para pozos y premios
    totalDistributed: { 
        type: Number, 
        default: 0 
    }, // Histórico total de lo repartido a la comunidad
    
    // --- 📜 VISIÓN DE REGISTRO (Transacciones Individuales) ---
    // Si userId existe, es un registro de un pago a un Ninja específico
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        default: null 
    }, 
    amount: { 
        type: Number, 
        default: 0 
    },
    status: { 
        type: String, 
        enum: ["completed", "failed", "pending", "treasury_update"], 
        default: "completed" 
    },
    type: {
        type: String,
        enum: ["payout", "income", "reserve"],
        default: "payout"
    },
    notes: { 
        type: String, 
        default: "" 
    }
}, { timestamps: true });

/**
 * 💸 EJECUTAR PAYOUT DEL DAO AL NINJA
 * Esta función descuenta del fondo global y registra el pago individual.
 */
export const executeDAOPayout = async (user, amount, notes = "Premio de Torneo") => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // 1. Actualizar el balance global del DAO (Tesorería)
        const treasury = await mongoose.model("Dao").findOneAndUpdate(
            { userId: null }, // El registro de tesorería no tiene userId
            { 
                $inc: { totalFund: -amount, totalDistributed: amount },
                $set: { lastPrizeUpdate: new Date() }
            },
            { upsert: true, new: true, session }
        );

        if (treasury.totalFund < 0) {
            throw new Error("Fondos insuficientes en el Tesoro DAO");
        }

        // 2. Registrar la transacción individual para el historial
        const payoutRecord = new (mongoose.model("Dao"))({
            userId: user._id,
            amount: amount,
            status: "completed",
            type: "payout",
            notes: notes
        });
        await payoutRecord.save({ session });

        // 3. Aumentar el balance del Ninja
        user.balance += amount;
        await user.save({ session });

        await session.commitTransaction();
        console.log(`✅ Botín de ${amount} NC entregado a ${user.ninjaName}`);
        return payoutRecord;
    } catch (err) {
        await session.abortTransaction();
        console.error("🚫 Falla en la repartición del botín:", err.message);
        throw err;
    } finally {
        session.endSession();
    }
};

const Dao = mongoose.model("Dao", daoSchema);
export default Dao;