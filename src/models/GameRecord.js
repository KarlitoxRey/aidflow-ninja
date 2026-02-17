import mongoose from 'mongoose';

const gameRecordSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    game: { type: String, default: 'ninja-waves' },
    maxDistance: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});

export default mongoose.model('GameRecord', gameRecordSchema);