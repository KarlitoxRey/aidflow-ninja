import mongoose from "mongoose";

const DuelSchema = new mongoose.Schema({
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    opponent: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Se llena al aceptar
    betAmount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ["waiting", "active", "completed", "cancelled"], 
        default: "waiting" 
    },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    roomCode: { type: String, unique: true }, // Para vincular el socket del juego
    feeAmount: { type: Number, default: 0 }    // Lo que se quedó el Clan
}, { timestamps: true });

export default mongoose.model("Duel", DuelSchema);
