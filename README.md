# VedaAI Assignment Manager 🚀

> A full-stack AI-powered platform that empowers teachers to instantly create, manage, and generate highly structured question papers from uploaded syllabus PDFs using cutting-edge Language Models.

---

## 📖 Overview

VedaAI Assignment Manager was built to streamline the time-consuming process of exam creation for educators. By uploading reference materials (PDFs) and defining custom parameters (marks distribution, difficulty levels, and question types), the application leverages the **Groq Llama 3.3 70B** AI model to automatically generate complete, print-ready exam papers in seconds. 

The platform includes comprehensive assignment tracking, group management, real-time WebSocket progress updates, and one-click PDF exporting.

---

## ✨ Features

### 🔐 Authentication
- **Secure Access**: Full JWT (JSON Web Token) implementation.
- **User Management**: Signup, Login, and Protected API routes.
- **Dynamic Profiles**: Auto-generated avatar initials and session persistence.

### 📚 Assignment Management
- **Dashboard**: Real-time statistics and an aggregated recent activity feed.
- **CRUD Operations**: Create, view, search, sort (by date), and delete assignments safely with custom confirmation modals.
- **Library Section**: Filtered views for generated resources.

### 🧠 AI Integration
- **PDF Extraction**: Extracts raw text from uploaded syllabus materials using `pdf-parse`.
- **Groq Integration**: Powered by Llama 3.3 70B for blazing-fast inference.
- **Smart Generation**: Outputs highly structured JSON defining Sections, Questions, Marks, and Difficulty Levels.
- **Customization**: Supports Multiple Choice, Short Answer, Numerical, and Diagram-based questions.

### ⚡ Real-Time Processing
- **Socket.io**: Persistent WebSocket connection broadcasts granular, real-time status updates (`Uploading...`, `Extracting...`, `Generating...`) directly to the client UI to prevent blocking UX.

### 🖨️ Output & Export
- **Professional Exam Layout**: Renders a beautiful HTML exam preview complete with a Student Information header, categorized sections, and difficulty badges.
- **PDF Export**: One-click professional PDF generation via `html2pdf.js`.

### 🧰 AI Teacher's Toolkit
- **Active Feature**: Question Paper Generator (fully integrated with Llama 3.3).
- **Planned Roadmap**: Rubric Generator, Lesson Planner, Answer Evaluator, Content Summarizer, and Report Card Generator are styled uniformly with "Coming Soon" indicators.

### ➕ Additional Features
- **Groups Management**: Create and track specific class groups.
- **Library Section**: Dedicated tabs for viewing all generated historical resources.
- **Settings & Profile**: Manage personal info with dynamically generated avatars.
- **Polished UX**: Professional empty states, robust delete confirmation modals, and clean loading screens.

---

## 🏗️ Architecture

```text
+-------------------+       HTTP / REST        +--------------------+
|                   |  <-------------------->  |                    |
|   Frontend (UI)   |       WebSockets         |  Backend (Node.js) |
|   (HTML/CSS/JS)   |  <-------------------->  |   (Express + io)   |
|                   |                          |                    |
+---------+---------+                          +---------+----------+
          |                                              |
          |  (PDF Export)                                |
          v                                              v
+-------------------+                          +--------------------+
|                   |      (API Request)       |                    |
|   Local Client    |  <-------------------->  |   MongoDB Atlas    |
|   (html2pdf.js)   |                          |    (Mongoose)      |
|                   |                          |                    |
+-------------------+                          +---------+----------+
                                                         |
                                                         | (Prompt + PDF Text)
                                                         v
                                               +--------------------+
                                               |                    |
                                               |      Groq API      |
                                               |                    |
                                               |                    |
                                               +--------------------+
```

---

## 🛠️ Tech Stack

### Frontend
- HTML5 / CSS3 (Custom Styling, No Frameworks)
- Vanilla JavaScript
- **Zustand** (Centralized State Management)
- Socket.io Client
- html2pdf.js (Export)

### Backend
- Node.js & Express.js
- Socket.io Server
- JWT & bcryptjs
- Multer & pdf-parse (File buffering and extraction)
- Groq SDK

### Database
- MongoDB Atlas
- Mongoose ODM

---

## 📁 Project Structure

```text
vedaai-assignment-manager/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/     # Route logic (Auth, Assignments, Groups)
│   ├── middleware/      # JWT authentication middleware
│   ├── models/          # Mongoose Schemas (User, Assignment, Group)
│   ├── routes/          # Express API routes
│   ├── services/        # External API integrations (Groq AI)
│   ├── .env             # Environment variables
│   └── server.js        # Express & Socket.io entry point
├── frontend/
│   ├── index.html       # Main Single Page Application
│   ├── style.css        # UI/UX design tokens and components
│   └── app.js           # Core frontend logic & DOM manipulation
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16+ recommended)
- MongoDB Atlas account (or local MongoDB)
- Groq API Key

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/vedaai-assignment-manager.git
cd vedaai-assignment-manager
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Setup Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=8000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY=your_groq_api_key_here
```

### 4. Start the Application
```bash
# Inside the backend/ directory
npm start
```
The backend server will launch on `http://localhost:8000`.

### 5. Access the Frontend
Open `index.html` directly in your browser, or serve it using a lightweight local server:
```bash
# Using Python
python3 -m http.server 3000
```
Navigate to `http://localhost:3000`.

---

## 📸 Screenshots

| Dashboard & Statistics | Exam Generation Output |
| :---: | :---: |
| ![Dashboard Placeholder](https://via.placeholder.com/400x250?text=Dashboard+UI) | ![Exam Placeholder](https://via.placeholder.com/400x250?text=Generated+Exam+Paper) |
| **Search & Sort Assignments** | **Delete Confirmation Modal** |
| ![Search Placeholder](https://via.placeholder.com/400x250?text=Search+and+Sort) | ![Modal Placeholder](https://via.placeholder.com/400x250?text=Custom+Delete+Modal) |

---

## 🌐 API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/signup` | Register a new user | No |
| POST | `/api/auth/login` | Authenticate user & return JWT | No |
| GET | `/api/auth/me` | Fetch active user profile | Yes |
| GET | `/api/assignments` | Fetch all user assignments | Yes |
| POST | `/api/assignments/generate` | Generate AI assignment with PDF | Yes |
| DELETE | `/api/assignments/:id` | Delete an assignment | Yes |
| GET | `/api/groups` | Fetch all user groups | Yes |
| POST | `/api/groups` | Create a new class group | Yes |

---

## 🔮 Future Improvements

1. **Background Job Queues**: Implement Redis & BullMQ to offload the AI generation pipeline from the main Node.js event loop, preventing HTTP timeouts for exceptionally large PDF files.
2. **HttpOnly Cookies**: Transition JWT storage from `localStorage` to HttpOnly secure cookies to completely mitigate XSS vulnerabilities.
3. **Rate Limiting**: Add `express-rate-limit` to the generation endpoints to protect the Groq API limits.
4. **Student Portal**: Expand the architecture to allow students to log in, view assigned papers, and submit answers.

---
## Live Demo

Frontend:
https://vedaai-fullstack-assignment-1.onrender.com/

Backend:
https://vedaai-fullstack-assignment.onrender.com/

*Designed and engineered for the VedaAI Full Stack Engineering Assignment.*
