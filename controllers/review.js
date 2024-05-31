const Review = require('../models/review');
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
const createReview = createOne(Review);
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
