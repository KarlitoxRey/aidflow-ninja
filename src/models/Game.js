import mongoose from "mongoose";

const GameSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
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
        enum: ['internal', 'external'], 
        default: 'external' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

export default mongoose.model("Game", GameSchema);