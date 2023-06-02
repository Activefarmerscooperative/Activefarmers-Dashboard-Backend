const axios = require('axios');
const { TERMII_API_KEY } = require('../config.js/keys')

exports.Register_OTP = async (phone) => {

    const data = {
        "to": phone,
        "message_type": "NUMERIC",
        "from": "AFC",
        "channel": "generic",
        "pin_attempts": 10,
        "pin_time_to_live": 10,
        "pin_length": 6,
        "pin_placeholder": "< 1234 >",
        "message_text": "Your AFCS Verification pin is < 1234 >",
        "pin_type": "NUMERIC",
        "api_key": TERMII_API_KEY,
    };
    try {
        const response = await axios.post('https://api.ng.termii.com/api/sms/otp/send', data);
        console.log("Message Sent Successfully.");
        return response.data

    } catch (error) {
        console.error(error);
    }
};

exports.Veriify_OTP = async (token,pinId) => {

    var data = {
        "pin_id": pinId,
        "pin": token,
        "api_key": TERMII_API_KEY,
      };
    //   var options = {
    //     'method': 'POST',
    //     'url': "https://api.ng.termii.com/api/sms/otp/verify",
    //     'headers': {
    //       'Content-Type': ['application/json', 'application/json']
    //     },
    //     body: JSON.stringify(data)
    
    //   };
    //   let result;
    //   request(options, function (error, response) {
    //     if (error) throw new Error(error);
    //     console.log(response.body);
    //     result = response.body
    //   });
      try {
        const response = await axios.post('https://api.ng.termii.com/api/sms/otp/verify', data);
        // console.log(response)
        return response.data

    } catch (error) {     
        return error.response.data
    }

};


// Termii SMS API
// const data = {
//     "to": phone,
//     "from": "AFC",
//     "sms": `Hi there,\n ${owner} has asked Qwique to deliver ${package} to you. Use this code to confirm receipt of package.\n token:${token} `,
//     "type": "plain",
//     "api_key": TERMII_API_KEY,
//     "channel": "generic"
// };
// try {
//     const response = await axios.post('https://api.ng.termii.com/api/sms/send', data);
//     console.log("Message Sent Successfully.");
// } catch (error) {
//     console.error(error);
// }