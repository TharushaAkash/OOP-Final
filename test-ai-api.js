// This script demonstrates how to test the Copilot AI API from Node.js using the Azure SDK.
// Make sure to install dependencies: npm install @azure-rest/ai-inference @azure/core-auth

import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

const token = "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";
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

/**
 * Checks a single answer using the Copilot AI API.
 * @param {string} question - The question text.
 * @param {string} answer - The user's answer.
 * @param {string} markingGuide - The marking guide or expected answer (optional).
 * @param {number} maxMarks - The maximum marks for this question.
 * @returns {Promise<number>} - The marks awarded by the AI.
 */
export async function checkAnswerWithAI(question, answer, markingGuide, maxMarks) {
  const client = ModelClient(endpoint, new AzureKeyCredential(token));
  const prompt = `
You are an exam grader. Grade the following answer strictly according to the marking guide and allocate marks out of ${maxMarks}.

Question: ${question}
Marking Guide: ${markingGuide || "N/A"}
Student Answer: ${answer}

Respond ONLY with the number of marks (0 to ${maxMarks}) as a single integer.
`;

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [
        { role: "system", content: "You are an exam grading assistant." },
        { role: "user", content: prompt }
      ],
      temperature: 0,
      top_p: 1,
      model: model
    }
  });

  if (isUnexpected(response)) {
    throw response.body.error;
  }

  // Try to extract the integer score from the AI's response
  const content = response.body.choices[0].message.content;
  const match = content.match(/\d+/);
  if (match) {
    return Math.min(Math.max(parseInt(match[0], 10), 0, maxMarks), maxMarks);
  }
  return 0;
}

// Example usage for a batch of questions/answers
export async function checkAllAnswersWithAI(questions, answers, markingGuides, marks) {
  const results = {};
  for (const key in questions) {
    try {
      results[key] = await checkAnswerWithAI(
        questions[key],
        answers[key] || "",
        markingGuides[key] || "",
        marks[key]
      );
    } catch (e) {
      results[key] = 0;
    }
  }
  return results;
}

// Example usage
async function main() {
  const question = "What is the capital of France?";
  const answer = "Paris";
  const markingGuide = "The answer should be 'Paris'.";
  const maxMarks = 5;
  const score = await checkAnswerWithAI(question, answer, markingGuide, maxMarks);
  console.log("Score:", score);
}

main().catch((err) => {
  console.error("The sample encountered an error:", err);
});
