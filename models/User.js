import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  ninjaName: String,
  level: { type: Number, default: 1 },
  turboUntil: Date,
  activeCycle: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", UserSchema);
