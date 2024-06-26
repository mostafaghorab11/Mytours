const slugify = require('slugify');
const mongoose = require('mongoose');
const User = require('./user');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: [true, 'A tour"s name must be unique'],
      trim: true,
      maxlength: [40, 'A tour name must have less than 40 characters'],
    },
    slug: String,
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    country: {
      type: String,
      required: [true, 'A tour must have a country'],
      enum: ['Egypt', 'USA', 'Canada'],
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    startLocation: {
      //GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'], // can be only point
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'], // can be only point
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    guests: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    description: {
      type: String,
      trim: true,
    },
    numOfAdults: {
      type: Number,
      default: 2,
    },
    numOfChildren: {
      type: Number,
      default: 0,
    },
    ratingAverage: {
      type: Number,
      min: 1,
      max: 5,
      default: 4.5,
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingQuantity: {
      type: Number,
      default: 0,
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this only points to the current price of New Document
          // won't work on update
          return val < this.price;
        },
        message: `Discount price ({VALUE}) should be below regular price ${this.price}`,
      },
    },
    images: [String],
    startDates: [Date],
    vipTour: {
      type: Boolean,
      default: false,
    },
  },
  // options
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tourSchema.index({ price: 1, ratingAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

// VIRTUAL VARIABLES
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

tourSchema.virtual('totalPrice').get(function () {
  return this.numOfAdults * this.price;
});

tourSchema.virtual('priceDiscountPercentage').get(function () {
  return (this.priceDiscount / this.price) * 100;
});

// virtual populating
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// DOCUMENT MIDDLEWARE: runs before .save() and .create()
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// EMBEDDING
tourSchema.pre('save', async function (next) {
  const guidesPromises = this.guides.map(async (id) => await User.findById(id));
  this.guides = await Promise.all(guidesPromises);
  next();
});

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function (next) {
  this.find({ vipTour: { $ne: true } });
  next();
});

// REFERENCING
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guests',
    select: 'name',
  });
  next();
});

// AGGREGATION MIDDLEWARE
tourSchema.pre('aggregate', function (next) {
  this.pipeline().unshift({ $match: { vipTour: { $ne: true } } });
  next();
});

tourSchema.pre('remove', async function (next) {
  await this.model('Review').deleteMany({ tour: this._id });
  next();
});

tourSchema.set('toJSON', {
  virtuals: true, // Include virtuals for population
  transform: (doc, ret) => {
    const excludedVirtuals = [
      'durationWeeks',
      'id',
      'priceDiscountPercentage',
      'totalPrice',
    ];
    excludedVirtuals.forEach((field) => delete ret[field]);
    return ret;
  },
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
