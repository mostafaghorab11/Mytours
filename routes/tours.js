const express = require('express');

const {
  getAllTours,
  getTourById,
  createTour,
  updateTour,
  deleteTour,
  getTourStats,
  topFive,
  getMonthlyPlan
  // checkId
} = require('../controllers/tours');

const router = express.Router();

// router.param('id', checkId);

//api/v1/tours

router.route('/top-five').get(topFive, getAllTours);
router.route('/stats').get(getTourStats);
router.route('/monthly-plan/:year').get(getMonthlyPlan);

router
  .route('/')
  .get(getAllTours)
  .post(createTour);
router
  .route('/:id')
  .get(getTourById)
  .put(updateTour)
  .delete(deleteTour);

module.exports = router;
