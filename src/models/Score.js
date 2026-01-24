import mongoose from "mongoose";

const ScoreSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    tournament: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Tournament", 
        required: true 
    },
    game: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Game", 
        required: true 
    },
    points: { 
        type: Number, 
        required: true 
    },
    proof: {
        type: String, // Para futura validación anti-cheat (hash o token)
        default: ""
    }
}, { timestamps: true });

// Índice para búsquedas rápidas de ranking
ScoreSchema.index({ tournament: 1, points: -1 });

export default mongoose.model("Score", ScoreSchema);