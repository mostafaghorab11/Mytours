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

router.use(protect);

router
  .route('/:id')
  .get(getReviewById)
  .patch(restrictTo('user', 'admin'), updateReview)
  .delete(restrictTo('user', 'admin'), deleteReview);

module.exports = router;
