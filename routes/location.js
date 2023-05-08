const express = require('express');
const locationController = require('../controller/locationController');

const locationRoutes  = express.Router();

locationRoutes.post('/countries', locationController.addCountry);
locationRoutes.get('/countries', locationController.countries);

locationRoutes.post('/states', locationController.addState);
locationRoutes.get('/states', locationController.states);

locationRoutes.post('/lga', locationController.addLGA);
locationRoutes.post('/lga/list', locationController.addLGAList);
locationRoutes.get('/lga/:state_id', locationController.lgas);


module.exports = locationRoutes;