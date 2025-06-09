// Netlify-compatible serverless function for AI grading (Node.js)

const fetch = require("node-fetch");

const token = process.env.AI_API_TOKEN || "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";
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

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

    if (aiResp.status === 401) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "AI API error: 401 Unauthorized. Check your API token or set AI_API_TOKEN in environment variables." })
      };
    }
    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return {
        statusCode: aiResp.status,
        body: JSON.stringify({ error: "AI API error: " + aiResp.statusText, details: errText })
      };
    }

    const data = await aiResp.json();
    const content = data.choices?.[0]?.message?.content || "";
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
};
