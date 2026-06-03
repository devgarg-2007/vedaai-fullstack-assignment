const Assignment = require("../models/Assignment");
const { PDFParse } = require("pdf-parse");
const {
  generateQuestionPaper,
} = require("../services/geminiService");

// Generate Assignment with AI
const generateAssignment = async (req, res) => {
  const io = req.app.get("io");
  const teacherId = req.user.id;

  try {
    if (io) {
      io.to(teacherId).emit("generation-started", "Uploading PDF...");
    }
    await new Promise(r => setTimeout(r, 800)); // UX delay

    const { title, dueDate, questionTypes, additionalInfo } = req.body;

    // Parse questionTypes if it arrives as a string (multipart/form-data)
    let parsedQuestionTypes = questionTypes;
    if (typeof questionTypes === "string") {
      try {
        parsedQuestionTypes = JSON.parse(questionTypes);
      } catch (e) {
        parsedQuestionTypes = [];
      }
    }

    // Extract PDF text if file was uploaded
    let pdfContent = "";
    if (req.file && req.file.buffer) {
      try {
        if (io) io.to(teacherId).emit("generation-progress", "Extracting content...");
        await new Promise(r => setTimeout(r, 1000)); // UX delay

        const uint8 = new Uint8Array(req.file.buffer);
        const parser = new PDFParse(uint8);
        const result = await parser.getText();
        pdfContent = result.text || "";
        console.log("PDF text length:", pdfContent.length);
        console.log("First 500 chars:", pdfContent.slice(0, 500));
      } catch (pdfError) {
        console.error("PDF parsing failed:", pdfError.message);
      }
    }

    console.log("Sending prompt to Groq");
    if (io) {
      io.to(teacherId).emit("generation-progress", "Generating questions...");
    }

    const generatedPaper = await generateQuestionPaper(
      title,
      parsedQuestionTypes,
      additionalInfo,
      pdfContent
    );

    if (io) {
      io.to(teacherId).emit("generation-progress", "Saving assignment...");
    }
    await new Promise(r => setTimeout(r, 800)); // UX delay

    const assignment = await Assignment.create({
      teacher: teacherId,
      title,
      dueDate,
      questionTypes: parsedQuestionTypes,
      additionalInfo,
      generatedPaper,
    });

    if (io) {
      io.to(teacherId).emit("generation-completed", "Assignment generated successfully.");
    }

    res.status(201).json({
      success: true,
      message: "Assignment generated successfully",
      assignment,
    });
  } catch (error) {
    console.error("Assignment generation failed:", error.message);
    const io = req.app.get("io");
    if (io && req.user && req.user.id) {
      io.to(req.user.id).emit("generation-error", "Generation failed: " + error.message);
    }
    res.status(500).json({ success: false, message: "Generation failed" });
  }
};

// Get All Assignments for logged-in teacher
const getAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({
      teacher: req.user.id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      assignments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Single Assignment (owned by logged-in teacher)
const getAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      _id: req.params.id,
      teacher: req.user.id,
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    res.json({
      success: true,
      assignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Assignment (owned by logged-in teacher)
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndDelete({
      _id: req.params.id,
      teacher: req.user.id,
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    res.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  generateAssignment,
  getAssignments,
  getAssignment,
  deleteAssignment,
};