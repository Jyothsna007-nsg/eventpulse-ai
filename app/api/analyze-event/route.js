import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();

    const { eventName, eventUrl, eventDetails } = body;

    // -----------------------------------------
    // 1. Validate input
    // -----------------------------------------

    if (!eventName && !eventUrl && !eventDetails) {
      return Response.json(
        {
          success: false,
          error: "Please provide event information",
        },
        { status: 400 },
      );
    }

    // -----------------------------------------
    // 2. Create AI prompt
    // -----------------------------------------

    const prompt = `
You are EventPulse AI, an event intelligence system.

Understand the event using the information provided below.

EVENT NAME:
${eventName || "Not provided"}

EVENT URL:
${eventUrl || "Not provided"}

EVENT DETAILS:
${eventDetails || "Not provided"}

Create a structured event profile.

Return ONLY valid JSON in this exact format:

{
  "eventName": "",
  "eventType": "",
  "description": "",
  "audience": "",
  "date": "",
  "venue": "",
  "topics": [],
  "goals": [],
  "importantAreas": []
}

Rules:

- Do not invent specific facts.
- Use only the information provided.
- If something is unknown, use an empty string.
- If there are no items, use an empty array.
- importantAreas should contain realistic areas that participants could give feedback about.
- Keep the description concise.
- Return valid JSON only.
`;

    // -----------------------------------------
    // 3. Ask Gemini to analyze the event
    // -----------------------------------------

    console.log("STEP 1: Sending request to Gemini...");

    const response = await ai.interactions.create({
      model: "gemini-3.5-flash-lite",
      input: prompt,
    });

    console.log("STEP 2: Gemini response received");

    const aiText = response.output_text || "";

    console.log("Gemini output:", aiText);

    if (!aiText.trim()) {
      return Response.json(
        {
          success: false,
          error: "Gemini returned an empty response.",
        },
        { status: 500 },
      );
    }

    // -----------------------------------------
    // 4. Clean Gemini JSON response
    // -----------------------------------------

    let cleanedText = aiText.trim();

    // Remove markdown JSON fences if Gemini adds them
    cleanedText = cleanedText.replace(/^```json\s*/i, "");
    cleanedText = cleanedText.replace(/^```\s*/i, "");
    cleanedText = cleanedText.replace(/\s*```$/i, "");

    // -----------------------------------------
    // 5. Convert AI response to JSON
    // -----------------------------------------

    let analysis;

    try {
      analysis = JSON.parse(cleanedText);
    } catch (error) {
      console.error("AI JSON parsing failed.");
      console.error("Gemini response:", aiText);

      return Response.json(
        {
          success: false,
          error: "AI returned an invalid event profile. Please try again.",
        },
        { status: 500 },
      );
    }

    console.log("STEP 3: Gemini analysis completed");
    console.log("Analysis:", analysis);

    // -----------------------------------------
    // 6. Save event to Supabase
    // -----------------------------------------

    console.log("STEP 4: Saving event to Supabase...");

    const { data: savedEvent, error: saveError } = await supabase
      .from("events")
      .insert({
        name: analysis.eventName || eventName || "Unnamed Event",

        description: analysis.description || eventDetails || "",

        website_url: eventUrl || null,

        event_type: analysis.eventType || "",

        audience: analysis.audience || "",

        event_date: analysis.date || "",

        venue: analysis.venue || "",

        topics: Array.isArray(analysis.topics) ? analysis.topics : [],

        goals: Array.isArray(analysis.goals) ? analysis.goals : [],

        important_areas: Array.isArray(analysis.importantAreas)
          ? analysis.importantAreas
          : [],
      })
      .select()
      .single();

    console.log("STEP 5: Supabase operation completed");
    console.log("Saved event:", savedEvent);
    console.log("Supabase error:", saveError);

    // -----------------------------------------
    // 7. Check Supabase error
    // -----------------------------------------

    if (saveError) {
      console.error("Supabase save error:", saveError);

      return Response.json(
        {
          success: false,
          error: "AI analysis succeeded, but saving the event failed.",
          details: saveError.message,
        },
        { status: 500 },
      );
    }

    // -----------------------------------------
    // 8. Return event + AI analysis
    // -----------------------------------------

    return Response.json({
      success: true,

      analysis,

      event: savedEvent,
    });
  } catch (error) {
    console.error("Event analysis error:", error);

    return Response.json(
      {
        success: false,
        error: error.message || "Failed to analyze event",
      },
      { status: 500 },
    );
  }
}
