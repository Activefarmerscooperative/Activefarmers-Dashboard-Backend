const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../../models/user');
const { charge_authorization } = require('../paystack');
const UserCard = require("../../models/cardDetails");
const CronNotification = require("../../models/cronJob")
const { savings } = require("../../models/savings");
const { ScheduledSavings } = require('../../models/scheduledSavings');
const SavingsCardDetails = require('../../models/savingsCardDetails');
const generateUniqueId = require('generate-unique-id');
const Savings = require("../../models/savings");
const SavingsWallet = require('../../models/savingsWallet');

const scheduledSavingsDeduction = async () => {

    try {
        const currentDayOfMonth = new Date().getDate();

        const scheduledSavings = await ScheduledSavings.find({
            scheduledDate: currentDayOfMonth
        });


        for (let i = 0; i < scheduledSavings.length; i++) {
            let savings = scheduledSavings[i];
            savings.cronStatus = "Initiated"

            const findCard = await SavingsCardDetails.findOne({ user: savings.user });

            if (!findCard) {
                savings.cronStatus = "Failed"
                let cronNotification = new CronNotification({
                    user: savings.user,
                    amount: savings.amount,
                    type: "SavingsDeduction",
                    status: "Failed",
                    message: "Cannot find user Card",
                    item: savings._id,
                    checkModel: "ScheduledSavings"
                });
                await savings.save()
                await cronNotification.save();
            } else {

                // Charge the user Card
                let authorization_code = findCard.authorization.authorization_code;
                let email = findCard.email;

                try {

                    const { data } = await charge_authorization(savings.amount, email, authorization_code);

                    if (!data || data.status !== "success") {
                        savings.cronStatus = "Failed"
                        let cronNotification = new CronNotification({
                            user: savings.user,
                            amount: savings.amount,
                            type: "SavingsDeduction",
                            status: "Failed",
                            message: "Payment transaction failed.",
                            item: savings._id,
                            checkModel: "ScheduledSavings"
                        });
                        await savings.save()
                        await cronNotification.save();
                    } else {
                        //generate reference id
                        let refID = generateUniqueId({
                            length: 15,
                            useLetters: false
                        });

                        //make sure the savings reference id is unique
                        let id_check = await Savings.findOne({ reference: refID }).exec();
                        while (id_check !== null) {
                            refID = generateUniqueId({
                                length: 15,
                                useLetters: false
                            });

                            id_check = await Savings.findOne({ reference: refID }).exec();
                        }

                        const saving = new Savings({
                            _id: new mongoose.Types.ObjectId(),
                            user: savings.user,
                            amount: savings.amount,
                            status: "Confirmed",
                            category: savings.category,
                            reference: refID
                        })

                        // Increase value in user wallet by deducted amount
                        let updateSavings = await SavingsWallet.findOne({ user: savings.user })

                        updateSavings.categories.map(item => {
                            if (item.category === savings.category) {
                                item.amount += savings.amount
                                return item
                            } else {
                                return item
                            }
                        })

                        savings.cronStatus = "Successful"

                        let cronNotification = new CronNotification({
                            user: savings.user,
                            amount: savings.amount,
                            type: "SavingsDeduction",
                            status: "Successful",
                            PaymentMethod: "Paystack",
                            reference: data.reference,
                            message: "Savings deducted successfully",
                            item: savings._id,
                            checkModel: "ScheduledSavings"
                        });
                        savings.savings.push(saving._id)
                        await saving.save();
                        await savings.save()
                        await cronNotification.save();
                    }


                } catch (error) {
                    // If there's an error during the transaction, log it and continue with the next savings
                    console.error("Transaction Error:", error.message);
                    savings.cronStatus = "Failed"
                    let cronNotification = new CronNotification({
                        user: savings.user,
                        amount: savings.amount,
                        type: "SavingsDeduction",
                        status: "Failed",
                        message: "Payment transaction failed.",
                        item: savings._id,
                        checkModel: "ScheduledSavings"
                    });
                    await savings.save()
                    await cronNotification.save();
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
};


module.exports = scheduledSavingsDeduction