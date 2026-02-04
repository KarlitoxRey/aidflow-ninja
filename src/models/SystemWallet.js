// models/SystemWallet.js
import mongoose from "mongoose";

const SystemWalletSchema = new mongoose.Schema({
  type: { type: String, default: 'main', unique: true }, 
  daoBalance: { type: Number, default: 0 },    // Fondo Torneos
  adminBalance: { type: Number, default: 0 },  // Mantenimiento
  backupBalance: { type: Number, default: 0 }, // Respaldo
  lastUpdate: { type: Date, default: Date.now }
});

export default mongoose.model("SystemWallet", SystemWalletSchema);
