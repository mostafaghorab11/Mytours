const express = require('express');
const {
  getAllReviews,
  createReview,
  getReviewById,
  updateReview,
  deleteReview,
  setTourAndUserIds,
} = require('../controllers/review');
const { protect, restrictTo } = require('../controllers/auth');

const router = express.Router({ mergeParams: true });

// api/v1/reviews
// api/v1/tours/:tourId/reviews
router
  .route('/')
  .get(getAllReviews)
  .post(protect, restrictTo('user'), setTourAndUserIds, createReview);

router
  .route('/:id')
  .get(getReviewById)
  .patch(updateReview)
  .delete(protect, restrictTo('user'), deleteReview);

module.exports = router;
