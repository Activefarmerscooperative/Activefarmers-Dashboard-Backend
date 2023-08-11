const { default: mongoose } = require("mongoose");

const cronJobSchema = mongoose.Schema({

    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    type: { type: String, enum: ['LoanDeduction', "SavingsDeduction"] },
    status: { type: String, default: "Pending", enum: ["Pending", "Initiated", "Successful", "Failed"] },
    message: { type: String, },
    amount: {type:Number},
    payment_method: {type: String},
    reference: {type: String},
    item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'checkModel' },
    checkModel: {
        type: String,
        enum: ['ScheduledSavings', "Loan"],
        // required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CronJob', cronJobSchema);
