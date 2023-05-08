const mongoose = require("mongoose");

const OTPSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    code: {type: String},
    type: {type: String},
    created_at: {type: Date}
});

module.exports = mongoose.model('OTP', OTPSchema);


