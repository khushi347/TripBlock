const express = require('express');
const router = express.Router();
const { getOverview } = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');

router.get('/overview', protect, getOverview);

module.exports = router;
