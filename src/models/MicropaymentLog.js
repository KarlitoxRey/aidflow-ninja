import mongoose from "mongoose";

const MicropaymentLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  eventType: {
    type: String,
    enum: ["duelo", "torneo", "DAO_payout"],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  notes: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    default: "completed"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("MicropaymentLog", MicropaymentLogSchema);
