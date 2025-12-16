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

        console.log("📝 Full Request Body Received:", req.body);

        // 1. Validation
        if (!curriculum || !classLevel || !subject || !topic || !sections) {
            console.log("⚠️ Validation Failed: Missing fields");
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 2. Format Sections for the AI
        const formattedSections = Array.isArray(sections) 
            ? sections.map((s, i) => `${i + 1}. ${s.charAt(0).toUpperCase() + s.slice(1)}`).join('\n')
            : "1. Lesson Objectives\n2. Content\n3. Evaluation";

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

            Use clear headings and professional teacher language.
        `;

        // 3. FIX: Use a valid model name (gemini-1.5-flash)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 4. Set a longer timeout (60 seconds) for AI generation
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const result = await model.generateContent(
            {
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            },
            { signal: controller.signal }
        );

        clearTimeout(timeout);
        
        const responseText = result.response.text().trim();
        console.log("✅ AI Generation Successful");

        res.json({ draft: responseText });

    } catch (error) {
        console.error("❌ SERVER ERROR:", error.message);

        // Handle specific timeout error
        if (error.name === "AbortError") {
            return res.status(504).json({ error: "AI generation timed out. Try again." });
        }

        // Send a clean JSON error so the Android app doesn't crash during parsing
        res.status(500).json({ 
            error: "Internal Server Error", 
            details: error.message 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));