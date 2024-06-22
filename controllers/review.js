const Review = require('../models/review');
const { catchAsync } = require('../utils/catchAsync');
const {
  deleteOne,
  updateOne,
  createOne,
  getOne,
  getAll,
} = require('./handlerFactory');

const setTourAndUserIds = (req, res, next) => {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user._id;
  next();
};

const getAllReviews = getAll(Review);
const createReview = catchAsync(async (req, res, next) => {
  // prevent duplicate reviews from same user to save tour
  const alreadySubmitted = await Review.getOne({
    tour: req.body.tour,
    user: req.body.user,
  });
  if (alreadySubmitted) {
    return next(new AppError('Review already submitted', 400));
  }
  createOne(Review);
});
const getReviewById = getOne(Review);
const updateReview = updateOne(Review);
const deleteReview = deleteOne(Review);

module.exports = {
  setTourAndUserIds,
  getAllReviews,
  createReview,
  getReviewById,
  updateReview,
  deleteReview,
};
