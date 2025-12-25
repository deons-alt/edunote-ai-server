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

// --- HELPER FUNCTION FOR RETRY LOGIC ---
async function generateWithRetry(model, prompt, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Wait before retrying: 0s first, then 2s, then 4s
            if (i > 0) {
                const delay = Math.pow(2, i) * 1000;
                console.log(`🔄 Retrying AI request (Attempt ${i + 1}) in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const result = await model.generateContent(prompt);
            return result.response.text().trim();

        } catch (error) {
            lastError = error;
            const msg = error.message.toLowerCase();
            
            // Only retry on temporary server issues (503 Overloaded, 500 Error)
            const isRetryable = msg.includes("503") || msg.includes("500") || msg.includes("overloaded") || msg.includes("unavailable");
            
            if (!isRetryable) {
                console.error("❌ Non-retryable error:", error.message);
                throw error; 
            }
            console.warn(`⚠️ Attempt ${i + 1} failed: ${error.message}`);
        }
    }
    throw lastError; 
}

// --- ROUTES ---

app.get("/", (req, res) => res.send("✅ EduNote AI Backend Online"));

app.post("/generateLessonDraft", async (req, res) => {
    try {
        const { curriculum, classLevel, subject, week, topic, subTopic, sections } = req.body;

        console.log("📝 Received request for:", topic);

        // 1. Validation
        if (!curriculum || !classLevel || !subject || !topic || !sections) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 2. Format sections for the prompt
        const formattedSections = Array.isArray(sections) 
            ? sections.map((s, i) => `${i + 1}. ${s.toUpperCase()}`).join('\n')
            : "1. OBJECTIVES\n2. CONTENT\n3. EVALUATION";

        const prompt = `
           You are a highly experienced professional teacher and curriculum expert working with the ${curriculum} curriculum.

Generate a COMPREHENSIVE WEEKLY LESSON PLAN suitable for teaching this topic across MULTIPLE CLASS PERIODS in one week.

Teaching Context:
- Class Level: ${classLevel}
- Subject: ${subject}
- Week: ${week || "N/A"}
- Topic: ${topic}
- Sub-topic(s): ${subTopic || "N/A"}
- Number of lessons this week: 3 (three separate class periods)

IMPORTANT INSTRUCTIONS:
1. This lesson plan must be detailed enough for a teacher to teach the topic across THREE DIFFERENT CLASSES in the same week.
2. Each lesson period must be clearly separated as:
   - Lesson 1
   - Lesson 2
   - Lesson 3
3. Each lesson should build progressively on the previous one.
4. Write in clear, simple, professional language suitable for official school lesson notes.
5. Avoid unnecessary storytelling. Be practical and classroom-focused.

STRICTLY USE ONLY THE FOLLOWING SECTIONS AND MAINTAIN THIS ORDER:
${formattedSections}

CONTENT EXPECTATIONS:
- OBJECTIVES must be measurable and appropriate for the class level.
- CONTENT must be broken down per lesson period (Lesson 1, Lesson 2, Lesson 3).
- Each lesson period should include:
  • Brief introduction
  • Main teaching points
  • Teacher activities
  • Learner activities
  • Teaching/learning materials
  • Evaluation questions
- EVALUATION should include both oral and written assessment suitable for the end of the week.
- ASSIGNMENT (if included) should reinforce learning across the week.

FORMAT RULES:
- Use clear headings and sub-headings.
- Use bullet points where appropriate.
- Keep symbols and notations clear (e.g., ¬, ∧, ∨ for logic when applicable).
- Do NOT include any section outside the provided list.

The final output should be a FULL WEEKLY LESSON NOTE that a teacher can directly use without modification.
        `;

        // 3. Initialize Model (1.5-flash is the stable workhorse)
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // 4. Call AI with Retry Logic
        const responseText = await generateWithRetry(model, prompt);

        console.log("✅ AI Generation Successful");
        res.json({ draft: responseText });

    } catch (error) {
        console.error("❌ FINAL SERVER ERROR:", error.message);
        
        // Return a clean error to the Android app
        res.status(500).json({ 
            error: "AI Service Busy", 
            details: error.message.includes("overloaded") 
                ? "The AI is currently overloaded. Please try again in a few moments." 
                : error.message 
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
