const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
require("dotenv").config();

const User = require("../models/user");

const GOOGLE_CLIENT_ID = process.env.CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.CLIENT_SECRET;

const googleStrategy = new GoogleStrategy(
  {
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/v1/login/google",
    // Replace with your callback URL
    passReqToCallback: true,
    // Pass req object to callback function for profile access
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      // console.log(profile);
      // Find or create user based on Google profile data (e.g., email)
      const user = await User.findOne({ email: profile.emails[0].value }, '-password');
      if (user) {
        return done(null, user);
      } else {
        const user = new User({
          username: profile.displayName,
          email: profile.emails[0].value,
          password: `${profile.id}${process.env.PASSWORD_SECRET}`,
        });
        await user.save();
        return done(null, user);
      }
    } catch (err) {
      return done(err);
    }
  }
);

passport.serializeUser((user, done) => {
  done(null, user.id); // Use a unique user identifier for serialization
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id); // Assuming User model with findById method
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(googleStrategy);

module.exports = passport;
