import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();

    const { eventName, questions, responses } = body;

    if (!eventName || !responses || responses.length === 0) {
      return NextResponse.json(
        {
          error: "Event name and responses are required.",
        },
        { status: 400 },
      );
    }

    const feedbackData = responses.map((response, index) => ({
      responseNumber: index + 1,
      answers: response.answers || {},
      suggestion: response.suggestion || "",
    }));

    const prompt = `
You are an AI event intelligence analyst.

Analyze the participant feedback for this event.

EVENT NAME:
${eventName}

QUESTIONS:
${JSON.stringify(questions || [], null, 2)}

PARTICIPANT FEEDBACK:
${JSON.stringify(feedbackData, null, 2)}

Your goal is NOT to simply summarize the responses.

Identify the actual problems that event organizers should know about
and recommend actions that can be taken during the event.

Analyze ALL of these together:

1. Rating responses
2. Multiple-choice responses
3. Text answers
4. Participant suggestions

IMPORTANT:

- Group different wording that represents the same problem.
- For example:
  "Wi-Fi is slow"
  "Internet keeps disconnecting"
  "Cannot download datasets"
  should be recognized as the same Technical/Wi-Fi issue.
- Do not create separate issues for similar problems.
- Focus on actionable problems.
- Do not invent problems that are not supported by participant feedback.
- Suggestions should be treated as important evidence.
- Give higher priority to issues affecting many participants.
- Severity should be "high", "medium", or "low".

Return ONLY valid JSON.

Use exactly this structure:

{
  "summary": "Short overall summary of participant experience",
  "health": "excellent | stable | needs_attention",
  "issues": [
    {
      "category": "Technical Infrastructure",
      "problem": "Short description of the problem",
      "evidence": "What participants reported",
      "severity": "high",
      "percentage": 31,
      "recommendation": "Specific action the organizer should take now"
    }
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ]
}

Percentage rules:

- Estimate the percentage of participants affected by each issue.
- Use the number of participants as the basis.
- If an issue is mentioned by 10 out of 50 participants,
  percentage should be approximately 20.
- If there is not enough evidence to calculate a meaningful percentage,
  use 0.

Health rules:

- excellent = overwhelmingly positive feedback with no major concerns
- stable = some minor/moderate concerns but event is generally going well
- needs_attention = one or more significant problems require attention

Keep the output concise and useful for an event organizer.
`;

    /*
     * Retry Gemini if it temporarily returns 503.
     */
    let response = null;
    let lastError = null;

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        response = await ai.interactions.create({
          model: "gemini-3.5-flash-lite",
          input: prompt,
        });

        break;
      } catch (error) {
        lastError = error;

        console.error(`Gemini attempt ${attempt} failed:`, error.message);

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    if (!response) {
      throw new Error(
        lastError?.message ||
          "Gemini is temporarily unavailable. Please try again.",
      );
    }

    console.log("FULL GEMINI RESPONSE:", JSON.stringify(response, null, 2));

    const text = response.output_text || "";

    if (!text) {
      throw new Error(
        "Gemini returned an empty response. Check the terminal for FULL GEMINI RESPONSE.",
      );
    }
    /*
     * Remove Markdown code fences if Gemini adds them.
     */
    let cleaned = text.trim();

    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");

    let analysis;

    try {
      analysis = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Gemini returned invalid JSON:");
      console.error(text);

      return NextResponse.json(
        {
          error: "AI returned an invalid analysis.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Analyze responses error:", error);

    return NextResponse.json(
      {
        error: error.message || "Failed to analyze participant responses.",
      },
      { status: 500 },
    );
  }
}
