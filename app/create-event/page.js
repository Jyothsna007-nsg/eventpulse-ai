"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function CreateEventPage() {
  const [eventName, setEventName] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [eventDetails, setEventDetails] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [eventId, setEventId] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [questionPrompt, setQuestionPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // -----------------------------------
  // Helper: Clean AI Analysis
  // -----------------------------------

  function cleanAnalysis(rawAnalysis) {
    if (!rawAnalysis) return null;

    if (typeof rawAnalysis === "object") {
      return rawAnalysis;
    }

    if (typeof rawAnalysis !== "string") {
      return null;
    }

    let cleaned = rawAnalysis.trim();

    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      console.error("Unable to parse AI analysis:", error);
      console.error("Raw analysis:", rawAnalysis);

      return null;
    }
  }

  // -----------------------------------
  // STEP 1: Analyze Event
  // -----------------------------------

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setAnalysis(null);
    setEventId(null);
    setQuestions([]);

    if (!eventName && !eventUrl && !eventDetails) {
      setError("Please provide at least some event information.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/analyze-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventName,
          eventUrl,
          eventDetails,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Something went wrong.");
      }

      console.log("AI Event Analysis:", data.analysis);
      console.log("Saved Event:", data.event);

      const cleanedAnalysis = cleanAnalysis(data.analysis);

      if (!cleanedAnalysis) {
        throw new Error(
          "The AI returned an invalid event analysis. Please try again.",
        );
      }

      setAnalysis(cleanedAnalysis);

      // Save the newly created Supabase event ID
      setEventId(data.event?.id || null);
    } catch (error) {
      console.error(error);

      setError(error.message || "Failed to connect to the AI service.");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------
  // STEP 2: Generate Feedback Questions
  // -----------------------------------

  async function generateQuestions() {
    if (!eventId) {
      setError("Please analyze and save the event first.");
      return;
    }

    if (!analysis) {
      setError("Event analysis is not available.");
      return;
    }

    setGeneratingQuestions(true);
    setError("");

    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          eventName: analysis.eventName,
          eventType: analysis.eventType,
          description: analysis.description,
          audience: analysis.audience,
          topics: analysis.topics,
          goals: analysis.goals,
          importantAreas: analysis.importantAreas,
          questionPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate feedback questions.");
      }

      console.log("Generated Questions:", data.questions);

      setQuestions(data.questions || []);
    } catch (error) {
      console.error("Question generation error:", error);

      setError(error.message || "Failed to generate feedback questions.");
    } finally {
      setGeneratingQuestions(false);
    }
  }

  // -----------------------------------
  // STEP 3: URLs
  // -----------------------------------

  function getFeedbackUrl() {
    if (typeof window === "undefined" || !eventId) {
      return "";
    }

    return `${window.location.origin}/feedback/${eventId}`;
  }

  function getDashboardUrl() {
    if (typeof window === "undefined" || !eventId) {
      return "";
    }

    return `${window.location.origin}/dashboard/${eventId}`;
  }

  // -----------------------------------
  // Copy Participant URL
  // -----------------------------------

  async function copyFeedbackLink() {
    const url = getFeedbackUrl();

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      alert("Participant feedback link copied!");
    } catch (error) {
      console.error("Failed to copy feedback link:", error);
    }
  }

  // -----------------------------------
  // Copy Dashboard URL
  // -----------------------------------

  async function copyDashboardLink() {
    const url = getDashboardUrl();

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      alert("AI dashboard link copied!");
    } catch (error) {
      console.error("Failed to copy dashboard link:", error);
    }
  }

  // -----------------------------------
  // STEP 4: Download QR
  // -----------------------------------

  function downloadQRCode() {
    const canvas = document.getElementById("eventpulse-feedback-qr");

    if (!canvas) {
      console.error("QR code canvas not found.");
      return;
    }

    const pngUrl = canvas.toDataURL("image/png");

    const downloadLink = document.createElement("a");

    downloadLink.href = pngUrl;
    downloadLink.download = "eventpulse-feedback-qr.png";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  return (
    <main className="min-h-screen bg-[#070B14] text-white">
      {/* Background glow */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-200px] top-[-200px] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />

        <div className="absolute bottom-[-200px] right-[-200px] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* -------------------------------- */}
        {/* TOP NAVIGATION */}
        {/* -------------------------------- */}

        <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold shadow-lg shadow-blue-600/20">
              EP
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                EventPulse AI
              </h2>

              <p className="text-xs text-slate-500">
                Event Intelligence Platform
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            AI System Online
          </div>
        </header>

        {/* -------------------------------- */}
        {/* PAGE HEADER */}
        {/* -------------------------------- */}

        <div className="mb-10 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400">
            <span>✦</span>
            AI Event Intelligence
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Create your event
          </h1>

          <p className="mt-4 text-base leading-7 text-slate-400 sm:text-lg">
            Give EventPulse AI the context it needs. We'll understand your
            event, identify important feedback areas, and prepare the
            intelligence layer for your event.
          </p>
        </div>

        {/* -------------------------------- */}
        {/* MAIN GRID */}
        {/* -------------------------------- */}

        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          {/* ================================= */}
          {/* LEFT SIDE */}
          {/* ================================= */}

          <section>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 sm:p-8"
            >
              {/* Section Header */}

              <div className="mb-8 flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  01
                </div>

                <div>
                  <h2 className="text-lg font-semibold">Event information</h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Add the information you already have about your event.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Event Name */}

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Event name
                  </label>

                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. AI Tech Summit 2026"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500/60 focus:bg-white/[0.04] focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                {/* Event URL */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-200">
                      Event website
                    </label>

                    <span className="text-xs text-slate-600">Optional</span>
                  </div>

                  <input
                    type="url"
                    value={eventUrl}
                    onChange={(e) => setEventUrl(e.target.value)}
                    placeholder="https://example.com/event"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500/60 focus:bg-white/[0.04] focus:ring-4 focus:ring-blue-500/10"
                  />

                  <p className="mt-2 text-xs text-slate-600">
                    Provide the event website if one is available.
                  </p>
                </div>

                {/* Event Details */}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-200">
                      Event details
                    </label>

                    <span className="text-xs text-slate-600">Optional</span>
                  </div>

                  <textarea
                    value={eventDetails}
                    onChange={(e) => setEventDetails(e.target.value)}
                    placeholder={`Example:

Event type: 24-hour hackathon
Date: 8-9 October 2026
Venue: Vignan Institute
Audience: College students
Topics: AI, ML and Data Science
Description: A national-level hackathon where students build innovative AI solutions.`}
                    rows={9}
                    className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm leading-6 text-white placeholder:text-slate-600 outline-none transition focus:border-blue-500/60 focus:bg-white/[0.04] focus:ring-4 focus:ring-blue-500/10"
                  />

                  <p className="mt-2 text-xs text-slate-600">
                    Add anything the AI should know about the event.
                  </p>
                </div>

                {/* Error */}

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <div className="flex gap-3">
                      <span>!</span>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {/* Submit */}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Understanding your event...
                    </>
                  ) : (
                    <>
                      Analyze event with AI
                      <span className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* ================================= */}
          {/* RIGHT SIDE */}
          {/* ================================= */}

          <section>
            <div className="sticky top-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 sm:p-8">
              {/* AI Header */}

              <div className="mb-8 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    ✦
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold">AI event profile</h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Your event intelligence
                    </p>
                  </div>
                </div>

                {analysis && (
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                    ANALYZED
                  </div>
                )}
              </div>

              {/* Empty State */}

              {!analysis && !loading && (
                <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-2xl" />

                    <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl">
                      ✦
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-200">
                    AI analysis will appear here
                  </h3>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                    Add your event information and let EventPulse AI understand
                    the event structure, audience and important feedback areas.
                  </p>

                  <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2">
                    <MiniFeature text="Understand" />
                    <MiniFeature text="Personalize" />
                    <MiniFeature text="Analyze" />
                  </div>
                </div>
              )}

              {/* Loading State */}

              {loading && (
                <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                  <div className="relative mb-8">
                    <div className="h-16 w-16 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" />

                    <div className="absolute inset-0 flex items-center justify-center text-xl">
                      ✦
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold">
                    Understanding your event
                  </h3>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                    EventPulse AI is analyzing the information you provided and
                    building an event profile.
                  </p>

                  <div className="mt-8 space-y-2 text-left">
                    <LoadingItem text="Reading event context" />
                    <LoadingItem text="Identifying event type" />
                    <LoadingItem text="Finding important feedback areas" />
                  </div>
                </div>
              )}

              {/* ================================= */}
              {/* Analysis Result */}
              {/* ================================= */}

              {analysis && !loading && (
                <div className="space-y-6">
                  {/* Event Name */}

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                      Event
                    </p>

                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">
                      {analysis.eventName || eventName || "Unnamed Event"}
                    </h3>

                    {analysis.description && (
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {analysis.description}
                      </p>
                    )}
                  </div>

                  {/* Basic Information */}

                  <div className="grid grid-cols-2 gap-3">
                    <InfoCard label="Event type" value={analysis.eventType} />

                    <InfoCard label="Audience" value={analysis.audience} />

                    <InfoCard label="Date" value={analysis.date} />

                    <InfoCard label="Venue" value={analysis.venue} />
                  </div>

                  {/* Topics */}

                  {Array.isArray(analysis.topics) &&
                    analysis.topics.length > 0 && (
                      <TagSection title="Topics" items={analysis.topics} />
                    )}

                  {/* Goals */}

                  {Array.isArray(analysis.goals) &&
                    analysis.goals.length > 0 && (
                      <TagSection title="Event goals" items={analysis.goals} />
                    )}

                  {/* Important Areas */}

                  {Array.isArray(analysis.importantAreas) &&
                    analysis.importantAreas.length > 0 && (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-5">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">✦</span>

                          <h4 className="text-sm font-semibold text-slate-200">
                            Important feedback areas
                          </h4>
                        </div>

                        <div className="mt-4 space-y-2">
                          {analysis.importantAreas.map((area, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 text-sm text-slate-300"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />

                              {area}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Event Saved */}

                  <div className="border-t border-white/10 pt-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-sm text-emerald-400">
                        ✓
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          Event understanding complete
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          Event saved successfully. Ready to generate
                          personalized feedback questions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ================================= */}
                  {/* FEEDBACK QUESTION CONFIGURATION */}
                  {/* ================================= */}

                  {!questions.length && (
                    <div className="border-t border-white/10 pt-6">
                      <div className="mb-5">
                        <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                          Feedback configuration
                        </p>

                        <h3 className="mt-1 text-lg font-semibold text-white">
                          What do you want to learn from participants?
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Optionally tell the AI what this feedback form should
                          focus on. Leave it empty and EventPulse AI will
                          automatically choose useful questions based on your
                          event.
                        </p>
                      </div>

                      {/* Optional Prompt */}

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-300">
                          Your requirements
                          <span className="ml-2 text-xs font-normal text-slate-600">
                            Optional
                          </span>
                        </label>

                        <textarea
                          value={questionPrompt}
                          onChange={(e) => setQuestionPrompt(e.target.value)}
                          placeholder={`Example:

Generate questions about the workshop quality, speaker clarity,
whether participants found the session useful, and what could
be improved.`}
                          rows={6}
                          className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm leading-6 text-white placeholder:text-slate-600 outline-none transition focus:border-indigo-500/60 focus:bg-white/[0.04] focus:ring-4 focus:ring-indigo-500/10"
                        />

                        <p className="mt-2 text-xs text-slate-600">
                          You can describe the topic, problem, session,
                          audience, or anything specific you want the feedback
                          to measure.
                        </p>
                      </div>

                      {/* Generate Button */}

                      <button
                        type="button"
                        onClick={generateQuestions}
                        disabled={generatingQuestions || !eventId}
                        className="group mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingQuestions ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Generating personalized questions...
                          </>
                        ) : (
                          <>
                            Generate Feedback Questions
                            <span className="transition-transform group-hover:translate-x-1">
                              →
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* ================================= */}
                  {/* GENERATED QUESTIONS */}
                  {/* ================================= */}

                  {questions.length > 0 && (
                    <div className="border-t border-white/10 pt-6">
                      <div className="mb-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                            AI Generated
                          </p>

                          <h3 className="mt-1 text-lg font-semibold text-white">
                            Feedback questions
                          </h3>
                        </div>

                        <div className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-400">
                          {questions.length} questions
                        </div>
                      </div>

                      <div className="space-y-3">
                        {questions.map((item, index) => (
                          <QuestionCard
                            key={item.id || index}
                            index={index}
                            question={item}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ================================= */}
                  {/* SHARE FEEDBACK FORM */}
                  {/* ================================= */}

                  {eventId && questions.length > 0 && (
                    <div className="mt-8 border-t border-white/10 pt-6">
                      <div className="mb-6">
                        <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                          Ready to share
                        </p>

                        <h3 className="mt-1 text-lg font-semibold text-white">
                          Feedback Form & AI Dashboard
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Share the participant link with attendees and use the
                          AI dashboard to monitor their feedback.
                        </p>
                      </div>

                      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
                        {/* LEFT: URLs */}

                        <div className="space-y-6">
                          {/* Participant URL */}

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <label className="text-sm font-medium text-slate-300">
                                Participant Feedback URL
                              </label>

                              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-400">
                                Participant
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <input
                                readOnly
                                value={getFeedbackUrl()}
                                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300 outline-none"
                              />

                              <button
                                type="button"
                                onClick={copyFeedbackLink}
                                className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                              >
                                Copy
                              </button>
                            </div>

                            <div className="mt-3">
                              <a
                                href={getFeedbackUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400 transition hover:bg-blue-500/20"
                              >
                                Open Feedback Form →
                              </a>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-slate-600">
                              Share this URL with participants through WhatsApp,
                              email, or other event channels.
                            </p>
                          </div>

                          {/* Divider */}

                          <div className="border-t border-white/10" />

                          {/* Dashboard URL */}

                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <label className="text-sm font-medium text-slate-300">
                                AI Analysis Dashboard
                              </label>

                              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-indigo-400">
                                Organizer
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <input
                                readOnly
                                value={getDashboardUrl()}
                                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300 outline-none"
                              />

                              <button
                                type="button"
                                onClick={copyDashboardLink}
                                className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                              >
                                Copy
                              </button>
                            </div>

                            <div className="mt-3">
                              <a
                                href={getDashboardUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-400 transition hover:bg-indigo-500/20"
                              >
                                Open AI Dashboard →
                              </a>
                            </div>

                            <p className="mt-3 text-xs leading-5 text-slate-600">
                              Monitor participant responses, identify live
                              issues, view AI insights, and get actionable
                              recommendations.
                            </p>
                          </div>
                        </div>

                        {/* RIGHT: QR CODE */}

                        <div className="flex flex-col items-center justify-center">
                          <div className="rounded-2xl border border-white/10 bg-white p-4 shadow-xl shadow-black/20">
                            <QRCodeCanvas
                              id="eventpulse-feedback-qr"
                              value={getFeedbackUrl()}
                              size={180}
                              level="H"
                              includeMargin={true}
                            />
                          </div>

                          <p className="mt-3 text-center text-xs text-slate-500">
                            Scan to open participant feedback
                          </p>

                          <button
                            type="button"
                            onClick={downloadQRCode}
                            className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-blue-500/40 hover:bg-blue-500/10"
                          >
                            Download QR
                          </button>
                        </div>
                      </div>

                      {/* Event ID */}

                      <div className="mt-6 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-slate-600">
                            Event ID
                          </span>

                          <span className="font-mono text-xs text-slate-500">
                            {eventId}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------- */
/* Small Components */
/* -------------------------------- */

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-300">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function TagSection({ title, items }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </h4>

      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={index}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniFeature({ text }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-500">
      {text}
    </div>
  );
}

function LoadingItem({ text }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />

      {text}
    </div>
  );
}

function QuestionCard({ index, question }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-4 transition hover:border-indigo-500/20 hover:bg-indigo-500/[0.03]">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-semibold text-indigo-400">
          {String(index + 1).padStart(2, "0")}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-600">
              {question.type?.replace("_", " ")}
            </span>

            {question.category && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">
                {question.category}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-200">
            {question.question}
          </p>

          {question.options?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {question.options.map((option, optionIndex) => (
                <span
                  key={optionIndex}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-slate-400"
                >
                  {option}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
