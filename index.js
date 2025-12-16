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

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY missing");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.get("/", (req, res) => res.send("✅ EduNote AI Backend Online"));

app.post("/generateLessonDraft", async (req, res) => {
    try {
        const { curriculum, classLevel, subject, week, topic, subTopic, sections } = req.body;

        console.log("📝 Processing request for topic:", topic);

        // Validation
        if (!curriculum || !classLevel || !subject || !topic || !sections) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Format sections list for the prompt
        const formattedSections = Array.isArray(sections) 
            ? sections.map((s, i) => `${i + 1}. ${s.toUpperCase()}`).join('\n')
            : "1. OBJECTIVES\n2. CONTENT\n3. EVALUATION";

        const prompt = `
            You are a professional ${curriculum} curriculum teacher.
            Create a detailed lesson note for:
            Class: ${classLevel}
            Subject: ${subject}
            Week: ${week || "N/A"}
            Topic: ${topic}
            Sub-topic: ${subTopic || "N/A"}

            Strictly include only these sections in this order:
            ${formattedSections}

            Format the output with clear headings.
        `;

        // Using the correct model name: gemini-1.5-flash
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        console.log("✅ AI Generation Successful");
        res.json({ draft: responseText });

    } catch (error) {
        console.error("❌ SERVER ERROR:", error.message);
        res.status(500).json({ 
            error: "AI Generation Failed", 
            details: error.message 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));