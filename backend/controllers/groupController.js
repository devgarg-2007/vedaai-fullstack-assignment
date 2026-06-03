const Group = require("../models/Group");

// Create a new group
const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const newGroup = await Group.create({
      name,
      description,
      teacher: req.user.id
    });

    res.status(201).json({
      success: true,
      group: newGroup
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all groups for logged-in user
const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ teacher: req.user.id }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      groups
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single group
const getGroupById = async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, teacher: req.user.id });
    
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json({
      success: true,
      group
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete group
const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findOneAndDelete({ _id: req.params.id, teacher: req.user.id });
    
    if (!group) {
      return res.status(404).json({ message: "Group not found or unauthorized" });
    }

    res.json({
      success: true,
      message: "Group deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  deleteGroup
};
