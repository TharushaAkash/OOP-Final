// Simple Express backend for AI grading (Netlify-compatible as a serverless function)

import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const token = process.env.GITHUB_TOKEN || "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";
const endpoint = "https://models.github.ai/inference";
const model = "meta/Llama-4-Scout-17B-16E-Instruct";

// POST /api/grade
app.post("/api/grade", async (req, res) => {
  const { question, answer, maxMarks, markingInstructions = "" } = req.body;
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
    const client = ModelClient(endpoint, new AzureKeyCredential(token));
    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: "You are an exam grading assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        top_p: 0.1,
        max_tokens: 2048,
        model: model
      }
    });

    if (isUnexpected(response)) {
      return res.status(500).json({ error: response.body.error });
    }

    const content = response.body.choices[0].message.content;
    const match = content.match(/\d+/);
    const score = match ? Math.min(Math.max(parseInt(match[0], 10), 0), maxMarks) : 0;
    res.json({ score, raw: content });
  } catch (e) {
    res.status(500).json({ error: "Backend error: " + e.message });
  }
});

// For Netlify serverless function export
export default app;

// Netlify function handler (for netlify/functions/ai-grading-backend.js)
export async function handler(event, context) {
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
    const client = ModelClient(endpoint, new AzureKeyCredential(token));
    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: "You are an exam grading assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        top_p: 0.1,
        max_tokens: 2048,
        model: model
      }
    });

    if (isUnexpected(response)) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: response.body.error })
      };
    }

    const content = response.body.choices[0].message.content;
    const match = content.match(/\d+/);
    const score = match ? Math.min(Math.max(parseInt(match[0], 10), 0), maxMarks) : 0;
    return {
      statusCode: 200,
      body: JSON.stringify({ score, raw: content })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Backend error: " + e.message })
    };
  }
}

// If running locally (node ai-grading-backend.js), start server
if (require.main === module) {
  const port = process.env.PORT || 8888;
  app.listen(port, () => {
    console.log("AI grading backend running on port", port);
  });
}

// Make sure to install dependencies before running this backend:
// npm install express cors @azure-rest/ai-inference @azure/core-auth

// To run locally (Node.js):
// 1. Open a terminal in your project directory.
// 2. Run: node ai-grading-backend.js
// 3. Your API will be available at http://localhost:8888/api/grade

// To use this file as a Netlify Function:
// 1. Create a folder named `netlify` in your project root if it doesn't exist.
// 2. Inside `netlify`, create a folder named `functions`.
// 3. Move or copy this file into `netlify/functions/`.
//    Example full path: c:\Users\Tharusha\Documents\OOP\netlify\functions\ai-grading-backend.js
// 4. In your Netlify dashboard, set the environment variable GITHUB_TOKEN with your API token.
// 5. Deploy your site to Netlify. The function will be available at:
//    https://<your-site>.netlify.app/.netlify/functions/ai-grading-backend

// To run this backend locally, you must have Node.js installed.
// If you see "'node' is not recognized...", install Node.js from https://nodejs.org/
// After installing, restart your terminal and try: node ai-grading-backend.js
