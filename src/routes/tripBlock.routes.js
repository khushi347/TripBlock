const express = require('express');
const router = express.Router();
const { getTripBlocks, getTripBlockById, getRecommendations } = require('../controllers/tripBlock.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', getTripBlocks);
router.get('/:id', getTripBlockById);
router.get('/:id/recommend-providers', getRecommendations);

module.exports = router;
