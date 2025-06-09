// Simple Express backend for AI grading (Netlify-compatible as a serverless function)

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// Set your environment variable as AI_API_TOKEN (not as the token value itself!)
// In Netlify, the key should be AI_API_TOKEN and the value should be your token (not the key name).
const token = process.env.AI_API_TOKEN;
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
    if (!token || typeof token !== "string" || token.length < 20) {
      console.error("AI_API_TOKEN is missing or invalid.");
      return res.status(500).json({ error: "AI_API_TOKEN is missing or invalid. Set it in your Netlify environment variables." });
    }

    // --- DEBUG: Print token length and first/last chars for troubleshooting ---
    console.log("AI API call: ", endpoint, "Token present:", !!token, "Token length:", token.length, "Token preview:", token.slice(0,6) + "..." + token.slice(-4));

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

    // --- DEBUG: Log AI API response status ---
    console.log("AI API response status:", aiResp.status, aiResp.statusText);

    if (aiResp.status === 401) {
      console.error("AI API error: 401 Unauthorized. Token used:", token);
      return res.status(401).json({ error: "AI API error: 401 Unauthorized. Check your API token or set AI_API_TOKEN in environment variables." });
    }
    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI API error:", aiResp.status, aiResp.statusText, errText);
      return res.status(aiResp.status).json({ error: "AI API error: " + aiResp.statusText, details: errText });
    }

    const data = await aiResp.json();
    // --- DEBUG: Log AI API raw response ---
    console.log("AI API raw response:", JSON.stringify(data));

    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\d+/);
    const score = match ? Math.min(Math.max(parseInt(match[0], 10), 0), maxMarks) : 0;
    res.json({ score, raw: content });
  } catch (e) {
    console.error("Backend error:", e);
    res.status(500).json({ error: "Backend error: " + e.message });
  }
});

// For Netlify serverless function export
module.exports = app;

// Netlify function handler (for netlify/functions/ai-grading-backend.js)
module.exports.handler = async (event, context) => {
  // Netlify Functions use event.body as a string
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body." })
    };
  }

  const { question, answer, maxMarks, markingInstructions = "" } = body;
  if (!question || !answer || !maxMarks) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required fields." })
    };
  }

  const prompt = `
${markingInstructions}

Question: ${question}
Student Answer: ${answer}

Respond ONLY with the number of marks (0 to ${maxMarks}) as a single integer.
`;

  try {
    const usedToken = process.env.AI_API_TOKEN;
    if (!usedToken || typeof usedToken !== "string" || usedToken.length < 20) {
      console.error("AI_API_TOKEN is missing or invalid.");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "AI_API_TOKEN is missing or invalid. Set it in your Netlify environment variables." })
      };
    }

    // --- DEBUG: Print token length and first/last chars for troubleshooting ---
    console.log("AI API call (Netlify): ", endpoint, "Token present:", !!usedToken, "Token length:", usedToken.length, "Token preview:", usedToken.slice(0,6) + "..." + usedToken.slice(-4));

    const aiResp = await fetch(endpoint + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (process.env.AI_API_TOKEN || token)
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

    // --- DEBUG: Log AI API response status ---
    console.log("AI API response status (Netlify):", aiResp.status, aiResp.statusText);

    if (aiResp.status === 401) {
      console.error("AI API error: 401 Unauthorized. Token used:", process.env.AI_API_TOKEN || token);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "AI API error: 401 Unauthorized. Check your API token or set AI_API_TOKEN in environment variables." })
      };
    }
    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI API error:", aiResp.status, aiResp.statusText, errText);
      return {
        statusCode: aiResp.status,
        body: JSON.stringify({ error: "AI API error: " + aiResp.statusText, details: errText })
      };
    }

    const data = await aiResp.json();
    // --- DEBUG: Log AI API raw response ---
    console.log("AI API raw response (Netlify):", JSON.stringify(data));

    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\d+/);
    const score = match ? Math.min(Math.max(parseInt(match[0], 10), 0), maxMarks) : 0;
    return {
      statusCode: 200,
      body: JSON.stringify({ score, raw: content })
    };
  } catch (e) {
    console.error("Backend error:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Backend error: " + e.message })
    };
  }
};

// If running locally (node ai-grading-backend.js), start server
if (require.main === module) {
  const port = process.env.PORT || 8888;
  app.listen(port, () => {
    console.log("AI grading backend running on port", port);
  });
}
