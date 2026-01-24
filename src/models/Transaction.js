import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    type: { 
        type: String, 
        // Agregamos 'deposit_manual' para diferenciar
        enum: ['deposit', 'withdrawal', 'daily_bonus', 'tournament_fee', 'tournament_prize', 'buy_pass', 'deposit_manual'], 
        required: true 
    },
    amount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'completed', 'failed', 'rejected'], 
        default: 'completed' 
    },
    description: { type: String },
    
    // 👇 CAMPOS NUEVOS PARA EL SISTEMA MANUAL
    referenceId: { type: String }, // El número de comprobante de MP
    adminComment: { type: String }, // Razón de rechazo o nota
    paymentMethod: { type: String, default: 'MercadoPago' }
}, { timestamps: true });

export default mongoose.model("Transaction", TransactionSchema);