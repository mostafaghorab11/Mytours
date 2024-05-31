const express = require('express');
const {
  getAllReviews,
  createReview,
  getReviewById,
  updateReview,
  deleteReview,
} = require('../controllers/review');
const { protect, restrictTo } = require('../controllers/auth');

const router = express.Router();

// api/v1/reviews
router
  .route('/')
  .get(getAllReviews)
  .post(protect, restrictTo('user'), createReview);

router
  .route('/:id')
  .get(getReviewById)
  .patch(updateReview)
  .delete(deleteReview);

module.exports = router;
