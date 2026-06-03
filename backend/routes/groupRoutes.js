const express = require("express");
const router = express.Router();

const { createGroup, getGroups, getGroupById, deleteGroup } = require("../controllers/groupController");
const auth = require("../middleware/auth");

router.post("/", auth, createGroup);
router.get("/", auth, getGroups);
router.get("/:id", auth, getGroupById);
router.delete("/:id", auth, deleteGroup);

module.exports = router;
