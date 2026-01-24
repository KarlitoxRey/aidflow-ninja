import mongoose from "mongoose";

const MicropaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  cycle: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle" },
  amount: Number,
  source: {
    type: String,
    enum: ["system", "referral", "game", "dao"],
    default: "system",
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Micropayment", MicropaymentSchema);
