const axios = require('axios');
const User = require('../../models/user');
const { charge_authorization } = require('../paystack');
const UserCard = require("../../models/cardDetails");
const CronNotification = require("../../models/cronJob")
const { Loan } = require("../../models/loan")

const loanDeduction = async () => {

    try {
        const loans = await Loan.find({ status: "Confirmed", repaymentStatus: "Ongoing", cronStatus: { $ne: "Successful" } });

        for (let i = 0; i < loans.length; i++) {
            let loan = loans[i];
            loan.cronStatus = "Initiated"

            // Add the interest on loan
            const amountPayable = parseFloat((loans[i].amount * 1.15).toFixed(2));

            // get monthly payment
            const monthlyPayment = parseFloat((amountPayable / (loans[i]?.repaymentPeriod)).toFixed(2));

            // Check how much payment user has made
            const repayment = parseFloat(!loan?.repayment[0] ? 0 : loan?.repayment?.reduce((total, currentRepayment) => total + currentRepayment.amount, 0))
            // console.log(loanDetails?.amountPaid)
            const outstandingBalance = (amountPayable - repayment)
            let amount = monthlyPayment < outstandingBalance ? monthlyPayment : outstandingBalance;
            // fetch the User card
            const findCard = await UserCard.findOne({ user: loan.user });

            if (!findCard) {
                loan.cronStatus = "Failed"
                let cronNotification = new CronNotification({
                    user: loan.user,
                    amount,
                    type: "LoanDeduction",
                    status: "Failed",
                    message: "Cannot find user Card",
                    item: loan._id,
                    checkModel: "Loan"
                });
                await loan.save()
                await cronNotification.save();
            } else {
         
                // Charge the user Card
                let authorization_code = findCard.authorization.authorization_code;
                let email = findCard.email;

                try {

                    const { data } = await charge_authorization(amount, email, authorization_code);

                    if (!data || data.status !== "success") {
                        loan.cronStatus = "Failed"
                        let cronNotification = new CronNotification({
                            user: loan.user,
                            amount,
                            type: "LoanDeduction",
                            status: "Failed",
                            message: "Payment transaction failed.",
                            item: loan._id,
                            checkModel: "Loan"
                        });
                        await loan.save()
                        await cronNotification.save();
                    } else {

                        loan.repayment.push({ amount, paymentMethod: "Card" })
                        loan.cronStatus = "Successful"

                        // This was the final payment
                        if (monthlyPayment > outstandingBalance || monthlyPayment === outstandingBalance) {
                            loan.repaymentStatus = "Completed"
                        }

                        let cronNotification = new CronNotification({
                            user: loan.user,
                            amount,
                            type: "LoanDeduction",
                            status: "Successful",
                            PaymentMethod:"Paystack",
                            reference:data.reference,
                            message: "Loan deducted successfully",
                            item: loan._id,
                            checkModel: "Loan"
                        });
                        await loan.save()
                        await cronNotification.save();
                    }


                } catch (error) {
                    // If there's an error during the transaction, log it and continue with the next loan
                    console.error("Transaction Error:", error.message);
                    loan.cronStatus = "Failed"
                    let cronNotification = new CronNotification({
                        user: loan.user,
                        amount,
                        type: "LoanDeduction",
                        status: "Failed",
                        message: "Payment transaction failed.",
                        item: loan._id,
                        checkModel: "Loan"
                    });
                    await loan.save()
                    await cronNotification.save();
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
};


module.exports = loanDeduction