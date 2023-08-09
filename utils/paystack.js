const dotenv = require("dotenv");
const {PAYSTACK_SECRET_KEY } = require('../config.js/keys')
dotenv.config();

const paystack = require("paystack")(PAYSTACK_SECRET_KEY);
const paystack_api = require("paystack-api")(PAYSTACK_SECRET_KEY);

exports.initiatePaystackPayment = async (amount, email, name, savings) => {
  const params = {
    amount: amount * 100,
    email: email,
    name: name,
    // channels:['card','bank'],
    metadata: {
      savings: savings
    }
  };

  const data = await paystack.transaction.initialize(params);

  return data;
};

//Validate users card for Loan application.
exports.initiatePaystackCardValidation = async (amount, email, name, savings) => {
  const params = {
    amount: amount * 100,
    email: email,
    name: name,
    channels:['card'],
    metadata: {
      type:"Validate Card",
      savings,
      
    }
  };

  const data = await paystack.transaction.initialize(params);

  return data;
};

//Validate users card for Loan application.
exports.initiatePaystackScheduledCardValidation = async (amount, email, name, savings,scheduledSavings) => {
  const params = {
    amount: amount * 100,
    email: email,
    name: name,
    channels:['card'],
    metadata: {
      type:"Scheduled Savings Card",
      scheduledSavings,
      savings,
      
    }
  };

  const data = await paystack.transaction.initialize(params);

  return data;
};
//Charge a user saved card.
exports.charge_authorization = async (amount, email, authorization_code) => {
  const params = {
    amount: amount * 100,
    email: email,
    authorization_code
  };

  const data = await paystack.transaction.charge(params);

  return data;
};

exports.validatePaystackPayment = async (reference) => {
  const data = await paystack.transaction.verify(reference);

  return data;
};

// initiating paystack transfer/ withdrawal
exports.initiatePaystackWithdrawal = async (
  amount,
  source,
  recipient,
  reason
) => {
  const params = {
    source: source,
    reason: reason,
    amount: amount,
    recipient: recipient,
  };

  const data = await paystack.transfer.create(params);

  return data;
};

exports.verifyAccount = async (account_number, bank_code) => {

try {
  const params = {
    account_number,
    bank_code
  }
  const data = await paystack_api.verification.resolveAccount(params);
  // console.log({params:data});

  return data;
} catch (error) {
  return error.error
}

};


exports.createTransferRecip = async (account_name, account_number, bank_code) => {
  const params = {
    type: "nuban",
    name: account_name,
    account_number,
    bank_code,
    currency: "NGN"
  }
  const data = await paystack_api.transfer_recipient.create(params);
  // console.log({params});


  return data;
};



exports.initiateTransfer = async (amount, recipient_code,reference, reason) => {
  const params = {
    source: "balance",
    amount: amount * 100,
    recipient: recipient_code,
    // reference,
    reason: reason ? reason : "Transfer made from my Wallet Account",

  }
  const data = await paystack_api.transfer.create(params);
  // console.log({params});


  return data;
};

exports.bankList = async () => {
  const data = await paystack.misc.list_banks()
  return data
}