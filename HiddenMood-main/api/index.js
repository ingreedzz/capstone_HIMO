import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import profileRoutes from "../backend/routes/profile.js";
import authRoutes from "../backend/routes/auth.js";
import curhatRoutes from "../backend/routes/curhat.js";
import historyRoutes from "../backend/routes/history.js";
import dashboardRoutes from "../backend/routes/dashboard.js";
import feedbackRoutes from "../backend/routes/feedback.js";
import articlesRoutes from "../backend/routes/articles.js";
import historyDetailRouter from "../backend/routes/historydetail.js";
import forgotPasswordRouter from "../backend/routes/forgotpassword.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://hiddenmood.vercel.app' : 'http://localhost:5501',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/presenters', express.static('presenters')); // Simplified to match original
app.use('/views', express.static('views')); // Simplified to match original

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api", curhatRoutes);
app.use("/api", historyRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", articlesRoutes);
app.use("/api", historyDetailRouter);
app.use("/api/forgot-password", forgotPasswordRouter); 

app.get("/api", (req, res) => {
  res.json({ message: "Hidden Mood API is running" });
});

export default app;