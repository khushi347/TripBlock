const express = require('express');
const router = express.Router();
const { createRequest, getRequests } = require('../controllers/request.controller');
const { validateCreateRequest } = require('../validators/request.validator');
const { protect } = require('../middlewares/auth.middleware');

// Protect all routes
router.use(protect);

router.post('/', validateCreateRequest, createRequest);
router.get('/', getRequests);

module.exports = router;
