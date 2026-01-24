import mongoose from "mongoose";

const tournamentSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    game: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Game", 
        required: true 
    },
    entryFee: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    prize: { 
        type: Number, 
        required: true, 
        min: 0 
    },
    startDate: { 
        type: Date, 
        required: true 
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'active', 'paused', 'finished'], 
        default: 'active' 
    },
    players: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }],
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User"
    }
}, { timestamps: true });

export default mongoose.model("Tournament", tournamentSchema);