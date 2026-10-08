import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      eventId,
      eventName,
      eventType,
      description,
      audience,
      topics,
      goals,
      importantAreas,
      questionPrompt,
    } = body;

    if (!eventId) {
      return Response.json(
        {
          success: false,
          error: "Event ID is required",
        },
        { status: 400 },
      );
    }

    const prompt = `
You are EventPulse AI, an intelligent event feedback generator.

Create a personalized feedback form for the following event.

The organizer may optionally provide specific requirements for
this feedback form.

If custom requirements are provided:
- Prioritize them.
- Make the questions directly relevant to them.
- Still use the event context to make the questions specific.

If no custom requirements are provided:
- Automatically determine the most useful feedback areas
  based on the event type, audience, goals and important areas.

This feedback form does NOT necessarily have to be an
end-of-event survey. It may be intended for a workshop,
keynote, session, activity, judging phase, facilities check,
mid-event pulse check, or any other stage of the event.

EVENT NAME:
${eventName || "Unknown"}

EVENT TYPE:
${eventType || "Unknown"}

DESCRIPTION:
${description || "Unknown"}

AUDIENCE:
${audience || "Unknown"}

TOPICS:
${JSON.stringify(topics || [])}

GOALS:
${JSON.stringify(goals || [])}

IMPORTANT FEEDBACK AREAS:
${JSON.stringify(importantAreas || [])}
ORGANIZER'S CUSTOM REQUIREMENTS:
${questionPrompt || "No specific requirements provided. Decide the most useful feedback focus based on the event context."}

Generate 8 high-quality feedback questions.

The questions should help event organizers understand:
- participant satisfaction
- event quality
- specific event areas
- problems participants experienced
- what should be improved
- actionable feedback

Use a mixture of:
- rating questions
- multiple choice questions
- text questions

Return ONLY valid JSON in exactly this format:

{
  "questions": [
    {
      "question": "",
      "type": "rating",
      "category": "",
      "options": []
    }
  ]
}

Allowed question types:
- "rating"
- "multiple_choice"
- "text"

Rules:
- Rating questions should use options ["1", "2", "3", "4", "5"].
- Multiple choice questions must have useful options.
- Text questions should have an empty options array.
- Questions must be specific to this event.
- Avoid generic questions whenever possible.
- Do not ask duplicate questions.
- Keep questions short and clear.
`;

    console.log("STEP 1: Generating feedback questions...");

    const response = await ai.interactions.create({
      model: "gemini-3.5-flash-lite",
      input: prompt,
    });

    console.log("STEP 2: Gemini response received");

    const aiText = response.output_text;

    console.log("Gemini questions output:", aiText);

    let result;

    try {
      result = JSON.parse(aiText);
    } catch (error) {
      console.error("Question JSON parsing failed:", aiText);

      return Response.json(
        {
          success: false,
          error: "AI returned invalid question data",
        },
        { status: 500 },
      );
    }

    if (
      !result.questions ||
      !Array.isArray(result.questions) ||
      result.questions.length === 0
    ) {
      return Response.json(
        {
          success: false,
          error: "AI did not generate any questions",
        },
        { status: 500 },
      );
    }

    console.log("STEP 3: Saving questions to Supabase...");

    const questionsToInsert = result.questions.map((item) => ({
      event_id: eventId,
      question: item.question,
      type: item.type,
      category: item.category || null,
      options: item.options || [],
    }));

    const { data: savedQuestions, error: saveError } = await supabase
      .from("questions")
      .insert(questionsToInsert)
      .select();

    if (saveError) {
      console.error("Supabase question save error:", saveError);

      return Response.json(
        {
          success: false,
          error: "Questions generated but could not be saved.",
          details: saveError.message,
        },
        { status: 500 },
      );
    }

    console.log("STEP 4: Questions saved successfully");
    console.log("Saved questions:", savedQuestions);

    return Response.json({
      success: true,
      questions: savedQuestions,
    });
  } catch (error) {
    console.error("Question generation error:", error);

    return Response.json(
      {
        success: false,
        error: error.message || "Failed to generate feedback questions",
      },
      { status: 500 },
    );
  }
}
