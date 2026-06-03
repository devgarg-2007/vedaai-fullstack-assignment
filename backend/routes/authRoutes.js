const express = require("express");
const router = express.Router();

const { signup, login, getMe, updateProfile } = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", auth, getMe);
router.put("/profile", auth, updateProfile);

module.exports = router;