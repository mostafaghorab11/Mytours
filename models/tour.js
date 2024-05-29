const mongoose = require('mongoose');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less than 40 characters'],
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    country: {
      type: String,
      required: [true, 'A tour must have a country'],
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
    startPoint: {
      type: String,
      required: [true, 'A tour must have a start point'],
      enum: {
        values: ['Cairo', 'Alexandria'],
        message: 'Start point must be Cairo or Alexandria',
      },
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
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
    },
    ratingQuantity: {
      type: Number,
      default: 0,
    },
    priceDiscount: {
      type: Number,
      required: true,
      validate: {
        validator: function(val) {
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

// VIRTUAL VARIABLES
tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
});

tourSchema.virtual('totalPrice').get(function() {
  return this.numOfAdults * this.price;
});

tourSchema.virtual('priceDiscountPercentage').get(function() {
  return (this.priceDiscount / this.price) * 100;
});

// DOCUMENT MIDDLEWARE
// like using pre('save') function to perform something before saving or creating document like slugify()

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function(next) {
  this.find({ vipTour: { $ne: true } });
  next();
});

// AGGREGATION MIDDLEWARE
tourSchema.pre('aggregate', function(next) {
  this.pipeline().unshift({ $match: { vipTour: { $ne: true } } });
  next();
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
