const express = require('express');
const BuildingController = require('../controllers/buildingController');

const router = express.Router();

router.get('/', BuildingController.getBuildings);

module.exports = router;