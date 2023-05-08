const mongoose = require('mongoose');

const countrySchema = mongoose.Schema({
    _id: {type: mongoose.Schema.Types.ObjectId},
    name: {type: String, required: true},
    dial_code:{type: String, required: true},
    code:{type: String, upperCase: true}
});        

module.exports = mongoose.model('Country', countrySchema);