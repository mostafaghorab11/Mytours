const speakeasy = require('speakeasy'); // Mock speakeasy for testing
const User = require('../models/user'); // Replace with your user model path
const { signup } = require('../controllers/auth'); // Replace with your auth controller path

jest.mock('speakeasy'); // Mock speakeasy for testing
jest.mock('../models/user'); // Mock User model for testing
jest.mock('../utils/sendVerificationEmail.js', () => ({ sendVerificationEmail: jest.fn() })); // Mock email sending

describe('Signup Functionality', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: { name: 'Test User', email: 'test@example.com', password: 'password@123' } };
    res = { status: jest.fn(), json: jest.fn(), cookie: jest.fn() };
    next = jest.fn();
    User.countDocuments.mockResolvedValue(0); // Simulate first user signup
    speakeasy.generateSecret.mockReturnValue({ base32: 'user_secret' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new user with admin role for the first signup', async () => {
    await signup(req, res, next);

    expect(User.countDocuments).toHaveBeenCalled();
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      role: 'admin', // Admin role for first user
    }));
  });

  it('should create a new user with user role for subsequent signups', async () => {
    User.countDocuments.mockResolvedValue(1); // Simulate existing users

    await signup(req, res, next);

    expect(User.countDocuments).toHaveBeenCalled();
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      role: 'user', // User role for subsequent signups
    }));
  });

  it('should generate a verification token and secret key', async () => {
    await signup(req, res, next);

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      verificationToken: expect.any(String),
      secret: 'user_secret',
    }));
  });

  // it('should send a verification email', async () => {
  //   await signup(req, res, next);

  //   expect(User.create).toHaveBeenCalled();
  //   expect(sendVerificationEmail).toHaveBeenCalledWith({
  //     email: req.body.email,
  //     name: req.body.name,
  //     verificationToken: expect.any(String),
  //   });
  // });

  it('should call next with error on user creation error', async () => {
    User.create.mockRejectedValue(new Error('User creation failed'));

    await signup(req, res, next);

    expect(User.create).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(new Error('User creation failed'));
  });
});