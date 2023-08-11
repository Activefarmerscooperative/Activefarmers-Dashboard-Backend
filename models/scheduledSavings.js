const { default: mongoose } = require("mongoose");

const scheduledSavingsSchema = mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    card: { type: mongoose.Schema.Types.ObjectId, required: false, ref: 'SavingsCard' },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    status: {
        type: String,
        enum: ["Processing", 'Active', "Cancelled"],
        default: "Processing"

    },

    savings: [{ type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Savings' }],

    scheduledDate: {
        type: Number,
    },
    cronStatus: {
        type: String,
        enum: ["Initiated", "Failed", "Successful"]
    },
});

exports.ScheduledSavings = mongoose.model('ScheduledSavings', scheduledSavingsSchema);

