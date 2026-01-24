import mongoose from "mongoose";
import { registerMicropayment } from "../utils/micropayment.js";

const duelSchema = new mongoose.Schema({
  playerOne: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  playerTwo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  betAmount: { type: Number, required: true },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  status: { type: String, enum: ["pending", "active", "finished"], default: "pending" },
}, { timestamps: true });

async function payDuelEntry(user, duel) {
  try {
    const micropayment = await registerMicropayment({
      userId: user._id,
      amount: 10,
      eventType: "duelo",
      referenceId: duel._id.toString(),
      notes: "Entrada duelo diario"
    });
    console.log(micropayment ? "Micropago registrado ✅" : "Ya registró su micropago diario. Participación permitida.");
  } catch (err) { throw err; }
}

const Duel = mongoose.model("Duel", duelSchema);
export default Duel;
export { payDuelEntry };
