import mongoose from "mongoose";

const CycleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  level: { type: Number, required: true },
  targetAmount: { type: Number, required: true },
  earnedAmount: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "completed"], default: "active" },
  
  // Registro de la distribución inicial según el Manifiesto
  cost: Number,
  daoContribution: Number,
  systemBacking: Number,
  maintenanceFee: Number,
  micropaymentPool: Number,

  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

export default mongoose.model("Cycle", CycleSchema);