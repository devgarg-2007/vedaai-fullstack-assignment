const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, PNG, JPG files are allowed"), false);
    }
  },
});

const {
  generateAssignment,
  getAssignments,
  getAssignment,
  deleteAssignment,
} = require("../controllers/assignmentController");

const auth = require("../middleware/auth");

// All routes are protected
router.use(auth);

router.post("/generate", upload.single("file"), generateAssignment);
router.get("/", getAssignments);
router.get("/:id", getAssignment);
router.delete("/:id", deleteAssignment);

module.exports = router;