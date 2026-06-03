const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const schoolRoutes = require("./routes/schoolRoutes");
const groupRoutes = require("./routes/groupRoutes");

dotenv.config();

// Connect Database
connectDB();

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow all origins for dev
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Make io accessible in controllers
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Client joins a room with their user ID
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined room ${userId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/groups", groupRoutes);

// Health Check Route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "VedaAI Backend Running 🚀"
  });
});

// Handle Unknown Routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// Start Server
const PORT = process.env.PORT || 8000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});