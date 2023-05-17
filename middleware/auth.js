const jwt = require("jsonwebtoken");
const StatusCodes = require("../utils/status-codes");


module.exports = function (req, res, next) {
    //   if (!config.get("requiresAuth")) return next();

    try {
        const token = req.headers.authorization.split(" ")[1];

        if (!token) return res.status(401).send("Access denied. No token provided.");
        const decoded = jwt.verify(token, process.env.JWT);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(StatusCodes.UNAUTHORIZED).send("Invalid token.");
    }
};
