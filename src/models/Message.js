import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    tournament: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Tournament", 
        required: true 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    ninjaName: String, // Guardamos el nombre para carga rápida
    content: { 
        type: String, 
        required: true,
        trim: true 
    },
    type: { 
        type: String, 
        enum: ["chat", "system"], 
        default: "chat" 
    }
}, { timestamps: true });

export default mongoose.model("Message", messageSchema);