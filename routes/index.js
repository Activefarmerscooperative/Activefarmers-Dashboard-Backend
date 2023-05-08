const express = require('express');
const router = express.Router();


//GET index page. 
router.get('/', function (req, res) {
    res.json('Hello! welcome to KAELO');
});


module.exports = router;