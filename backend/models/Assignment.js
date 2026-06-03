const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    title: {
      type: String,
      required: true
    },

    dueDate: {
      type: Date
    },

    questionTypes: [
      {
        type: { type: String },
        count: { type: Number },
        marks: { type: Number }
      }
    ],

    additionalInfo: {
      type: String
    },

    generatedPaper: {
      type: Object
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Assignment",
  assignmentSchema
);