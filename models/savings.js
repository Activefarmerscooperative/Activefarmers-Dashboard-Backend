const { default: mongoose } = require("mongoose");

const savingsSchema = mongoose.Schema({
    _id: {type: mongoose.Schema.Types.ObjectId},
    reference: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Savings', savingsSchema);