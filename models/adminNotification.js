const { default: mongoose } = require("mongoose");

const adminNotificationSchema = mongoose.Schema({

    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    type: { type: String },
}, {
    timestamps: true,
});

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
