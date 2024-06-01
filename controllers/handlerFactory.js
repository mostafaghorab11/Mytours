const APIFeatures = require('../util/apiFeatures');
const AppError = require('../util/appError');
const { catchAsync } = require('../util/catchAsync');

const getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter;
    if (req.params.tourId) {
      filter = { tour: req.params.tourId };
    }
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    // const doc = await features.query.explain();
    const doc = await features.query;
    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        doc,
      },
    });
  });

const createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    await Model.create(req.body).then((doc) => {
      res.status(201).json({
        status: 'success',
        data: {
          data: doc,
        },
      });
    });
  });

const getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    const id = req.params.id;
    let query = await Model.findOne({ _id: id });
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;
    if (doc) {
      res.status(200).json({
        status: 'success',
        data: {
          data: doc,
        },
      });
    } else {
      return next(new AppError(`No ${doc} for that ID`, 404));
    }
  });

const updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (doc) {
      res.status(200).json({
        status: 'success',
        data: {
          data: doc,
        },
      });
    } else {
      return next(new AppError(`No ${doc} for that ID`, 404));
    }
  });

const deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const id = req.params.id;
    const doc = await Model.findOneAndDelete({ _id: id });
    if (doc) {
      res.status(200).json({
        status: 'success',
        data: {
          data: doc,
        },
      });
    } else {
      return next(new AppError(`No ${doc} for that ID`, 404));
    }
  });

module.exports = {
  getAll,
  createOne,
  getOne,
  updateOne,
  deleteOne,
};
