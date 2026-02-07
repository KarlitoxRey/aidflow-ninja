import mongoose from "mongoose";

const systemWalletSchema = new mongoose.Schema({
    type: { 
        type: String, 
        default: 'main', 
        unique: true 
    },
    // Pozo del Shogun (Mantenimiento/Admin)
    adminBalance: { 
        type: Number, 
        default: 0 
    },
    // Pozo del DAO (Para repartir a la comunidad)
    daoBalance: { 
        type: Number, 
        default: 0 
    },
    // Pozo de Respaldo (Fondo de emergencia)
    backupBalance: { 
        type: Number, 
        default: 0 
    },
    // Registro histórico de todo lo ingresado
    totalIncome: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

export default mongoose.model("SystemWallet", systemWalletSchema);
