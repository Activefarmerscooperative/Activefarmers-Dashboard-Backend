exports.Card_Is_Valid = (cardData) => {

    // Check if Card is Valid for Loan period
    const currentMonth = new Date().getMonth() + 1; // Add 1 since JavaScript months are zero-based
    const currentYear = new Date().getFullYear();

    const cardExpiryYear = cardData.authorization.exp_year;
    const cardExpiryMonth = cardData.authorization.exp_month;

    // Create the current date and the card expiry date
    const currentDate = new Date(currentYear, currentMonth, 1);
    const cardExpiryDate = new Date(cardExpiryYear, cardExpiryMonth, 1);

    // Add 12 months to the current date
    const validUntilDate = new Date(currentYear + 1, currentMonth, 1);
    if (cardExpiryDate <= validUntilDate) {
        return false
    } else {
        return true
    }
};