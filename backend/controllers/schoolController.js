const School = require("../models/School");

// Create a new school
const createSchool = async (req, res) => {
  try {
    const { name, address } = req.body;

    if (!name) {
      return res.status(400).json({ message: "School name is required" });
    }

    const newSchool = await School.create({
      name,
      address,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      school: newSchool
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all schools for logged-in user
const getSchools = async (req, res) => {
  try {
    const schools = await School.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      schools
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single school
const getSchoolById = async (req, res) => {
  try {
    const school = await School.findOne({ _id: req.params.id, createdBy: req.user.id });
    
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    res.json({
      success: true,
      school
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSchool,
  getSchools,
  getSchoolById
};
