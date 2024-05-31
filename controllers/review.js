const Review = require('../models/review');
const { catchAsync } = require('../util/catchAsync');

const getAllReviews = catchAsync(async (req, res, next) => {
  const tourId = req.params.tourId;
  const reviews = await Review.find({ tour: tourId });
  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews,
    },
  });
});

const createReview = catchAsync(async (req, res, next) => {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user._id;

  const review = await Review.create(req.body);
  res.status(201).json({
    status: 'success',
    data: {
      review,
    },
  });
});

const getReviewById = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});

const updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});

const deleteReview = catchAsync(async (req, res, next) => {
  await Review.findByIdAndDelete(req.params.id);
  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = {
  getAllReviews,
  createReview,
  getReviewById,
  updateReview,
  deleteReview,
};
