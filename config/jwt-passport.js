const passport = require("passport");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
require("dotenv").config();

const User = require("../models/user");

var opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.JWT_SECRET_KEY;

const jwtStrategy = new JwtStrategy(opts, async (jwt_payload, done) => {
  // console.log(jwt_payload);
  try {
    const user = await User.findOne({ _id: jwt_payload.userId }, "-password");
    // console.log(user);
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
      // or you could create a new account
    }
  } catch (error) {
    return done(error, false);
  }
});

passport.use(jwtStrategy);

module.exports = passport;
