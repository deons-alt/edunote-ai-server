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
      subTopic,
      sections // <--- FIX 1: Destructure the 'sections' array from the client
    } = req.body;

    // The client should send at least one section, so we validate it here.
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({
            error: "Missing required field: sections array must be provided."
        });
    }

    if (!curriculum || !classLevel || !subject || !topic) {
      return res.status(400).json({
        error: "Missing required text fields"
      });
    }

    // Helper function to format the list of sections for the prompt
    const formattedSections = sections.map((section, index) => {
        // Capitalize the first letter for clean formatting
        const capitalized = section.charAt(0).toUpperCase() + section.slice(1);
        return `${index + 1}. ${capitalized}`;
    }).join('\n');


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

Include ONLY these sections, in the exact numbered order provided:
${formattedSections}
`; // <--- FIX 2: Use the dynamic 'formattedSections' list in the prompt

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