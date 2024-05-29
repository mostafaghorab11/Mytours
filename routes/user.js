const express = require("express");
const { protect } = require("../controllers/auth");
const {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  updateMe,
  deleteMe,
} = require("../controllers/user");

const router = express.Router();

// "/api/v1/users"
router.route("/").get(getAllUsers).post(createUser);

router.route("/:id").get(getUserById).patch(updateUser).delete(deleteUser);

router.patch("/updateMe", protect, updateMe);
router.delete("/deleteMe", protect, deleteMe);

module.exports = router;
