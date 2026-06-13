const express = require('express');
const router = express.Router();
const { createAssignment, respondToAssignment, completeAssignment } = require('../controllers/assignment.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/', createAssignment);
router.put('/:id/respond', respondToAssignment);
router.post('/:id/complete', completeAssignment);

module.exports = router;
