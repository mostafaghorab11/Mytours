const express = require('express');
const { protect, restrictTo } = require('../controllers/auth');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateMe,
  deleteMe,
  getMe,
  uploadUserPhoto,
  resizeUserPhoto,
} = require('../controllers/user');

const router = express.Router();

router.use(protect);

// "/api/v1/users"
router.get('/me', getMe, getUserById);
router.patch('/updateMe', uploadUserPhoto, resizeUserPhoto, updateMe);
router.delete('/deleteMe', deleteMe);

router.use(restrictTo('admin'));

router.route('/').get(getAllUsers);

router.route('/:id').get(getUserById).patch(updateUser).delete(deleteUser);

module.exports = router;
