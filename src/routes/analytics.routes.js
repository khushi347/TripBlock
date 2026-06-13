const express = require('express');
const router = express.Router();
const {
  getSavings,
  getDemandHotspots,
  getServiceDistribution,
  getVillageCoverage
} = require('../controllers/analytics.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/savings', getSavings);
router.get('/demand-hotspots', getDemandHotspots);
router.get('/service-distribution', getServiceDistribution);
router.get('/village-coverage', getVillageCoverage);

module.exports = router;
