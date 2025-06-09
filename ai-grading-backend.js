// Simple Express backend for AI grading (Netlify-compatible as a serverless function)

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const token = "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";
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

// POST /api/grade
app.post("/api/grade", async (req, res) => {
  const { question, answer, maxMarks } = req.body;
  let markingInstructions = req.body.markingInstructions || "";
  if (!question || !answer || !maxMarks) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const prompt = `
${markingInstructions}

Question: ${question}
Student Answer: ${answer}

Respond ONLY with the number of marks (0 to ${maxMarks}) as a single integer.
`;

  try {
    const aiResp = await fetch(endpoint + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are an exam grading assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0,
        top_p: 1,
        model: model
      })
    });

    if (!aiResp.ok) {
      return res.status(aiResp.status).json({ error: "AI API error: " + aiResp.statusText });
    }

    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\d+/);
    const score = match ? Math.min(Math.max(parseInt(match[0], 10), 0), maxMarks) : 0;
    res.json({ score, raw: content });
  } catch (e) {
    res.status(500).json({ error: "Backend error: " + e.message });
  }
});

// For Netlify serverless function export
module.exports = app;

// If running locally (node ai-grading-backend.js), start server
if (require.main === module) {
  const port = process.env.PORT || 8888;
  app.listen(port, () => {
    console.log("AI grading backend running on port", port);
  });
}
