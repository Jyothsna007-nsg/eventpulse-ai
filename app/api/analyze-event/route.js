import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    const body = await request.json();

    const { eventName, eventUrl, eventDetails } = body;

    if (!eventName && !eventUrl && !eventDetails) {
      return Response.json(
        {
          success: false,
          error: "Please provide event information",
        },
        { status: 400 },
      );
    }

    // -----------------------------
    // 1. Ask Gemini to understand event
    // -----------------------------

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

Return ONLY valid JSON in this format:

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
- Use information from the provided event details.
- If something is unknown, use an empty string or empty array.
- importantAreas should contain areas that participants could realistically give feedback about.
`;

    console.log("STEP 1: Sending request to Gemini...");

    const response = await ai.interactions.create({
      model: "gemini-3.5-flash-lite",
      input: prompt,
    });

    console.log("STEP 2: Gemini response received");
    console.log("Gemini output:", response.output_text);

    const aiText = response.output_text;

    // -----------------------------
    // 2. Convert AI response to JSON
    // -----------------------------

    let analysis;

    try {
      analysis = JSON.parse(aiText);
    } catch (error) {
      console.error("AI JSON parsing failed:", aiText);

      analysis = {
        eventName: eventName || "",
        eventType: "",
        description: aiText,
        audience: "",
        date: "",
        venue: "",
        topics: [],
        goals: [],
        importantAreas: [],
      };
    }

    // -----------------------------
    // 3. Save event to Supabase
    // -----------------------------
    console.log("STEP 3: Gemini analysis completed");
    console.log("Analysis:", analysis);

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

        topics: analysis.topics || [],

        goals: analysis.goals || [],

        important_areas: analysis.importantAreas || [],
      })
      .select()
      .single();
    console.log("STEP 5: Supabase operation completed");
    console.log("Saved event:", savedEvent);
    console.log("Supabase error:", saveError);

    // -----------------------------
    // 4. Check Supabase error
    // -----------------------------

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

    // -----------------------------
    // 5. Return everything
    // -----------------------------

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
