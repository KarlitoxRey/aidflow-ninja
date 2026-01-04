import mongoose from "mongoose";

const CycleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  level: Number,
  totalAmount: Number,
  partsCompleted: { type: Number, default: 0 },
  withdrawnParts: { type: Number, default: 0 },
  progressPercent: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
});

export default mongoose.model("Cycle", CycleSchema);
