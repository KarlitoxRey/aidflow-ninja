import mongoose from "mongoose";

const MissionSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String 
    },
    reward: { 
        type: Number, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['daily', 'one_time', 'special'], 
        default: 'daily' 
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export default mongoose.model("Mission", MissionSchema);