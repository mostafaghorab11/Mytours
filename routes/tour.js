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
  uploadTourImages,
  resizeTourImages,
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
  .route('/:id')
  .get(getTourById)
  .patch(
    protect,
    restrictTo('admin', 'lead-guide'),
    uploadTourImages,
    resizeTourImages,
    updateTour
  )
  .delete(protect, restrictTo('admin', 'lead-guide'), deleteTour);

router
  .route('/')
  .get(getAllTours)
  .post(
    protect,
    restrictTo('admin', 'lead-guide'),
    uploadTourImages,
    resizeTourImages,
    createTour
  );

// api/v1/tours/:tourId/reviews
router.use('/:tourId/reviews', reviewRouter);

module.exports = router;
