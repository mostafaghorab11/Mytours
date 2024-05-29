const Tour = require('../models/tour');
const APIFeatures = require('../util/apiFeatures');
const AppError = require('../util/appError');
const { catchAsync } = require('../util/catchAsync');

// const tours = JSON.parse(
//   fs.readFileSync(path.join(__dirname, '../dev-data/data/tours-simple.json'))
// );

const topFive = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingAverage,price';
  req.query.fields = 'name,price,ratingAverage,summary,country';
  next();
};

const getAllTours = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Tour.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const tours = await features.query;
  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      tours,
    },
  });
});

const createTour = catchAsync(async (req, res, next) => {
  await Tour.create(req.body).then((newTour) => {
    res.status(201).json({
      status: 'success',
      data: {
        tour: newTour,
      },
    });
  });
});

// const checkId = (req, res, next, id) => {
//   const tour = tours.find(el => el.id === +id);

//   if (!tour) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID'
//     });
//   }
//   next();
// };

const getTourById = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const tour = await Tour.findOne({ _id: id });
  if (tour) {
    res.status(200).json({
      status: 'success',
      data: {
        tour,
      },
    });
  } else {
    return next(new AppError('No tour for that ID', 404));
  }
});

const updateTour = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const updatedTour = await Tour.findOneAndUpdate({ _id: id }, req.body, {
    new: true,
    runValidators: true,
  });
  if (updateTour) {
    res.status(200).json({
      status: 'success',
      data: {
        updatedTour,
      },
    });
  } else {
    return next(new AppError('No tour for that ID', 404));
  }
});

const deleteTour = catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const deletedTour = await Tour.findOneAndDelete({ _id: id });
  if (deletedTour) {
    res.status(200).json({
      status: 'success',
      data: {
        deletedTour,
      },
    });
  } else {
    return next(new AppError('No tour for that ID', 404));
  }
});

const getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: '$country',
        // sum * 1
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 },
    },
    {
      $match: { _id: { $ne: null } },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

const getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    { $unwind: '$startDates' },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-1-1`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numOfTours: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    // to hide _id field
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: { numTourStarts: -1 },
    },
    {
      $limit: 12,
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

module.exports = {
  getAllTours,
  getTourById,
  createTour,
  updateTour,
  deleteTour,
  getTourStats,
  topFive,
  getMonthlyPlan,
  // checkId,
};
