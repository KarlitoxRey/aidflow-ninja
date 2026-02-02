import mongoose from "mongoose";

const CycleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  level: { type: Number, required: true },
  targetAmount: { type: Number, required: true },
  earnedAmount: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "completed"], default: "active" },
  
  // Registro de la distribución inicial (Manifiesto 40/30/30 o similar)
  cost: Number,
  daoContribution: Number,
  micropaymentPool: Number,
  maintenanceFee: Number,

  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { 
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true } 
});

// ⛩️ Progreso en tiempo real para el Dashboard
CycleSchema.virtual('progress').get(function() {
  if (this.targetAmount === 0) return 0;
  return Math.min(100, (this.earnedAmount / this.targetAmount) * 100);
});

export default mongoose.model("Cycle", CycleSchema);
