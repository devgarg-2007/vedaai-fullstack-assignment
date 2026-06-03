const express = require("express");
const router = express.Router();

const { createSchool, getSchools, getSchoolById } = require("../controllers/schoolController");
const auth = require("../middleware/auth");

router.post("/", auth, createSchool);
router.get("/", auth, getSchools);
router.get("/:id", auth, getSchoolById);

module.exports = router;
