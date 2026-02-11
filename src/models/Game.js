import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    thumbnail: {
        type: String,
        required: true
    },
    embedUrl: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['practica', 'torneo', 'libre'],
        default: 'practica'
    },
    source: { // 👈 ESTE CAMPO FALTABA
        type: String,
        enum: ['external', 'internal'],
        default: 'external'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default mongoose.model("Game", gameSchema);
