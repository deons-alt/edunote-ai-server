import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Safety check
if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY missing");
  process.exit(1);
}

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.get("/", (req, res) => {
  res.send("✅ EduNote Studio AI Backend Running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "EduNote AI" });
});

/* --------------------------------------------------
   Generate Lesson Draft (STRICT – NO GUESSING)
-------------------------------------------------- */
app.post("/generateLessonDraft", async (req, res) => {
  try {
    const {
      curriculum,
      classLevel,
      subject,
      week,
      topic,
      subTopic
    } = req.body;

    if (!curriculum || !classLevel || !subject || !topic) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    const prompt = `
You are a professional ${curriculum} curriculum teacher.

Create a WELL-STRUCTURED lesson note using ONLY the data provided below.

Class: ${classLevel}
Subject: ${subject}
Week: ${week || "Not specified"}
Topic: ${topic}
Subtopic: ${subTopic || "Not specified"}

STRICT RULES:
- Do NOT guess class level, topic, or curriculum
- Do NOT add extra topics
- Use clear headings
- Keep teacher-friendly language

Include these sections:
1. Lesson Objectives
2. Introduction
3. Lesson Content (Step-by-step)
4. Examples
5. Class Activities
6. Evaluation
7. Assignment
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const result = await model.generateContent(
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const text = result.response.text().trim();

    res.json({ draft: text });

  } catch (error) {
    console.error("❌ AI Error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "AI request timed out. Please try again."
      });
    }

    res.status(500).json({
      error: "Failed to generate lesson draft",
      details: error.message
    });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 EduNote AI Server running on port ${PORT}`)
);