const express = require('express');

const {
  getAllTours,
  getTourById,
  createTour,
  updateTour,
  deleteTour,
  getTourStats,
  topFive,
  getMonthlyPlan,
} = require('../controllers/tour');

const reviewRouter = require('./review');
const { restrictTo, protect } = require('../controllers/auth');

const router = express.Router();

// router.param('id', checkId);

//api/v1/tours

router.route('/top-five').get(topFive, getAllTours);
router.route('/stats').get(getTourStats);
router
  .route('/monthly-plan/:year')
  .get(protect, restrictTo('admin', 'lead-guide'), getMonthlyPlan);

router
  .route('/')
  .get(getAllTours)
  .post(protect, restrictTo('admin', 'lead-guide'), createTour);
router
  .route('/:id')
  .get(getTourById)
  .put(protect, restrictTo('admin', 'lead-guide'), updateTour)
  .delete(protect, restrictTo('admin', 'lead-guide'), deleteTour);

// api/v1/tours/:tourId/reviews
router.use('/:tourId/reviews', reviewRouter);

module.exports = router;
