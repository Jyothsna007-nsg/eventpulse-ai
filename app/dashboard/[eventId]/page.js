"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage({ params }) {
  // ==================================================
  // STATE
  // ==================================================

  const [eventId, setEventId] = useState(null);

  const [event, setEvent] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // IMPORTANT:
  // Do not use new Date() directly inside useState.
  const [lastUpdated, setLastUpdated] = useState(null);

  // ==================================================
  // GET EVENT ID
  // ==================================================

  useEffect(() => {
    let active = true;

    async function getParams() {
      try {
        const resolvedParams = await params;

        if (active && resolvedParams?.eventId) {
          setEventId(resolvedParams.eventId);
        }
      } catch (error) {
        console.error("Unable to read event ID:", error);
      }
    }

    getParams();

    return () => {
      active = false;
    };
  }, [params]);

  // ==================================================
  // LOAD DASHBOARD
  // ==================================================

  useEffect(() => {
    if (!eventId) return;

    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);

        // ----------------------------------------------
        // LOAD EVENT
        // ----------------------------------------------

        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", eventId)
          .single();

        if (eventError) {
          throw eventError;
        }

        // ----------------------------------------------
        // LOAD QUESTIONS
        // ----------------------------------------------

        const { data: questionData, error: questionError } = await supabase
          .from("questions")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (questionError) {
          throw questionError;
        }

        // ----------------------------------------------
        // LOAD RESPONSES
        // ----------------------------------------------

        const { data: responseData, error: responseError } = await supabase
          .from("responses")
          .select("*")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false });

        if (responseError) {
          throw responseError;
        }

        if (!active) return;

        setEvent(eventData);
        setQuestions(questionData || []);
        setResponses(responseData || []);

        // Date is created AFTER prerendering.
        setLastUpdated(new Date());
      } catch (error) {
        console.error("Dashboard loading error:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    // ==================================================
    // REALTIME RESPONSE LISTENER
    // ==================================================

    const channel = supabase
      .channel(`eventpulse-dashboard-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "responses",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          console.log("New response received:", payload.new);

          setResponses((current) => {
            const exists = current.some(
              (response) => response.id === payload.new.id,
            );

            if (exists) {
              return current;
            }

            return [payload.new, ...current];
          });

          setLastUpdated(new Date());
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // ==================================================
  // BASIC METRICS
  // ==================================================

  const totalResponses = responses.length;

  const suggestionCount = responses.filter(
    (response) =>
      response.suggestion && String(response.suggestion).trim().length > 0,
  ).length;

  // ==================================================
  // RATING QUESTIONS
  // ==================================================

  const ratingQuestions = useMemo(() => {
    return questions.filter(
      (question) =>
        question.type === "rating" ||
        question.type === "scale" ||
        question.type === "rating_1_5",
    );
  }, [questions]);

  // ==================================================
  // ALL RATINGS
  // ==================================================

  const allRatings = useMemo(() => {
    const values = [];

    responses.forEach((response) => {
      const answers = response.answers || {};

      ratingQuestions.forEach((question) => {
        const value = Number(answers[question.id]);

        if (!Number.isNaN(value) && value >= 1 && value <= 5) {
          values.push(value);
        }
      });
    });

    return values;
  }, [responses, ratingQuestions]);

  // ==================================================
  // AVERAGE RATING
  // ==================================================

  const averageRating =
    allRatings.length > 0
      ? allRatings.reduce((sum, value) => sum + value, 0) / allRatings.length
      : 0;

  // ==================================================
  // OVERALL PARTICIPANT EXPERIENCE
  // ==================================================

  const experiencePercentage =
    averageRating > 0 ? Math.round((averageRating / 5) * 100) : 0;

  let experienceLabel = "Waiting for feedback";

  let experienceDescription = "No participant feedback has been received yet.";

  if (experiencePercentage >= 80) {
    experienceLabel = "Excellent";

    experienceDescription = "Participants are having a strong experience.";
  } else if (experiencePercentage >= 60) {
    experienceLabel = "Good";

    experienceDescription =
      "Overall participant experience is positive, with some areas to improve.";
  } else if (experiencePercentage >= 40) {
    experienceLabel = "Needs Attention";

    experienceDescription =
      "Participant feedback shows several areas that need attention.";
  } else if (experiencePercentage > 0) {
    experienceLabel = "Critical";

    experienceDescription =
      "Participant feedback indicates significant problems during the event.";
  }

  // ==================================================
  // POSITIVE / NEUTRAL / NEGATIVE
  // ==================================================

  const positiveResponses = allRatings.filter((rating) => rating >= 4).length;

  const neutralResponses = allRatings.filter((rating) => rating === 3).length;

  const negativeResponses = allRatings.filter((rating) => rating <= 2).length;

  const positivePercentage =
    allRatings.length > 0
      ? Math.round((positiveResponses / allRatings.length) * 100)
      : 0;

  const neutralPercentage =
    allRatings.length > 0
      ? Math.round((neutralResponses / allRatings.length) * 100)
      : 0;

  const negativePercentage =
    allRatings.length > 0
      ? Math.round((negativeResponses / allRatings.length) * 100)
      : 0;

  // ==================================================
  // QUESTION RATING ANALYSIS
  // ==================================================

  const ratingAnalysis = useMemo(() => {
    return ratingQuestions.map((question) => {
      const values = [];

      responses.forEach((response) => {
        const answers = response.answers || {};

        const value = Number(answers[question.id]);

        if (!Number.isNaN(value) && value >= 1 && value <= 5) {
          values.push(value);
        }
      });

      const average =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;

      return {
        question,
        average,
        percentage: average > 0 ? Math.round((average / 5) * 100) : 0,
        count: values.length,
      };
    });
  }, [ratingQuestions, responses]);

  // ==================================================
  // MULTIPLE CHOICE ANALYSIS
  // ==================================================

  const multipleChoiceAnalysis = useMemo(() => {
    const questionsWithData = questions.filter(
      (question) =>
        question.type === "multiple_choice" ||
        question.type === "select" ||
        question.type === "choice",
    );

    const results = [];

    questionsWithData.forEach((question) => {
      const counts = {};

      responses.forEach((response) => {
        const answers = response.answers || {};

        const answer = answers[question.id];

        if (answer) {
          const key = String(answer);

          counts[key] = (counts[key] || 0) + 1;
        }
      });

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

      if (sorted.length > 0) {
        results.push({
          question,
          answers: sorted,
          total: sorted.reduce((sum, item) => sum + item[1], 0),
        });
      }
    });

    return results;
  }, [questions, responses]);

  // ==================================================
  // BIGGEST PARTICIPANT CONCERN
  // ==================================================

  const biggestConcern = useMemo(() => {
    if (multipleChoiceAnalysis.length === 0) {
      return null;
    }

    let biggest = null;

    multipleChoiceAnalysis.forEach((item) => {
      const [answer, count] = item.answers[0];

      const percentage = Math.round((count / item.total) * 100);

      if (!biggest || percentage > biggest.percentage) {
        biggest = {
          question: item.question,
          answer,
          count,
          total: item.total,
          percentage,
        };
      }
    });

    return biggest;
  }, [multipleChoiceAnalysis]);

  // ==================================================
  // PARTICIPANT SUGGESTIONS
  // ONLY SHOW TOP 3 SUMMARIZED POINTS
  // ==================================================

  const participantSuggestions = useMemo(() => {
    const suggestions = responses
      .map((response) => response.suggestion)
      .filter(
        (suggestion) => suggestion && String(suggestion).trim().length > 0,
      )
      .map((suggestion) => String(suggestion).trim());

    if (suggestions.length === 0) {
      return [];
    }

    const groups = [];

    suggestions.forEach((suggestion) => {
      const lower = suggestion.toLowerCase();

      let matchedGroup = null;

      if (
        lower.includes("wifi") ||
        lower.includes("wi-fi") ||
        lower.includes("internet") ||
        lower.includes("network")
      ) {
        matchedGroup = "Improve Wi-Fi and internet connectivity.";
      } else if (
        lower.includes("mentor") ||
        lower.includes("mentoring") ||
        lower.includes("guidance")
      ) {
        matchedGroup = "Improve mentor availability and guidance.";
      } else if (
        lower.includes("food") ||
        lower.includes("lunch") ||
        lower.includes("queue") ||
        lower.includes("canteen")
      ) {
        matchedGroup = "Improve food service and reduce waiting time.";
      } else if (lower.includes("judge") || lower.includes("judging")) {
        matchedGroup = "Make judging criteria clearer and more transparent.";
      } else if (
        lower.includes("workshop") ||
        lower.includes("session") ||
        lower.includes("speaker")
      ) {
        matchedGroup = "Improve workshop and session quality.";
      } else if (
        lower.includes("venue") ||
        lower.includes("space") ||
        lower.includes("seating")
      ) {
        matchedGroup = "Improve venue facilities and participant comfort.";
      }

      if (matchedGroup) {
        const existing = groups.find((group) => group.text === matchedGroup);

        if (existing) {
          existing.count += 1;
        } else {
          groups.push({
            text: matchedGroup,
            count: 1,
          });
        }
      } else {
        const existing = groups.find(
          (group) => group.text.toLowerCase() === lower,
        );

        if (existing) {
          existing.count += 1;
        } else {
          groups.push({
            text: suggestion,
            count: 1,
          });
        }
      }
    });

    // ONLY TOP 3
    return groups.sort((a, b) => b.count - a.count).slice(0, 3);
  }, [responses]);

  // ==================================================
  // AI ANALYSIS
  // ==================================================

  async function analyzeResponsesWithAI() {
    if (!event || responses.length === 0) {
      setAiError("There are no participant responses to analyze yet.");

      return;
    }

    try {
      setAiLoading(true);
      setAiError("");

      const response = await fetch("/api/analyze-responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventName: event.name,
          questions,
          responses,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI analysis failed.");
      }

      setAiAnalysis(data.analysis);
    } catch (error) {
      console.error("AI analysis error:", error);

      setAiError(error.message || "Unable to analyze feedback.");
    } finally {
      setAiLoading(false);
    }
  }

  // ==================================================
  // AI ISSUES
  // ==================================================

  const aiIssues = aiAnalysis?.issues || [];

  const activeIssues = aiIssues.length;

  // ==================================================
  // AI HEALTH
  // ==================================================

  const aiHealth = aiAnalysis?.health || "";

  let healthText = experienceLabel;

  if (aiHealth === "excellent") {
    healthText = "Excellent";
  } else if (aiHealth === "stable") {
    healthText = "Good";
  } else if (aiHealth === "needs_attention") {
    healthText = "Needs Attention";
  }

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070B14] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" />

            <h2 className="text-lg font-semibold">Loading EventPulse AI</h2>

            <p className="mt-2 text-sm text-slate-500">
              Preparing your event intelligence dashboard...
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ==================================================
  // MAIN UI
  // ==================================================

  return (
    <main className="min-h-screen bg-[#070B14] text-white">
      {/* BACKGROUND */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-200px] top-[-200px] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />

        <div className="absolute bottom-[-200px] right-[-200px] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <header className="mb-8 flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          {/* BRAND */}

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold shadow-lg shadow-blue-600/20">
              EP
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                EventPulse AI
              </h1>

              <p className="text-xs text-slate-500">
                Event Intelligence Platform
              </p>
            </div>
          </div>

          {/* EVENT INFO */}

          <div className="flex-1 lg:px-10">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">
                {event?.name || "Event Dashboard"}
              </h2>

              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                LIVE
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              {event?.event_date && <span>📅 {event.event_date}</span>}

              {event?.venue && <span>📍 {event.venue}</span>}

              <span>● {totalResponses} responses</span>

              {lastUpdated && (
                <span>
                  Updated{" "}
                  {lastUpdated.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* STATUS */}

          <div className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Real-time Intelligence
          </div>
        </header>

        {/* ================================================= */}
        {/* TOP METRIC CARDS */}
        {/* ================================================= */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon="◉"
            label="Total Responses"
            value={totalResponses}
            subtitle="Participant feedback received"
            iconClass="bg-blue-500/10 text-blue-400"
          />

          <MetricCard
            icon="★"
            label="Average Rating"
            value={averageRating > 0 ? `${averageRating.toFixed(1)} / 5` : "—"}
            subtitle={
              allRatings.length > 0
                ? `${allRatings.length} ratings analyzed`
                : "Waiting for ratings"
            }
            iconClass="bg-yellow-500/10 text-yellow-400"
          />

          <MetricCard
            icon="●"
            label="Positive Responses"
            value={allRatings.length > 0 ? `${positivePercentage}%` : "—"}
            subtitle="Ratings of 4 or 5"
            iconClass="bg-emerald-500/10 text-emerald-400"
          />

          <MetricCard
            icon="!"
            label="Active Issues"
            value={activeIssues}
            subtitle={aiAnalysis ? "Detected by AI" : "Run AI analysis"}
            iconClass="bg-red-500/10 text-red-400"
          />
        </section>

        {/* ================================================= */}
        {/* MAIN CONTENT */}
        {/* ================================================= */}

        <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
          {/* ================================================= */}
          {/* LEFT COLUMN */}
          {/* ================================================= */}

          <div className="space-y-6">
            {/* ================================================= */}
            {/* OVERALL PARTICIPANT EXPERIENCE */}
            {/* ================================================= */}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                {/* SCORE */}

                <div className="flex items-center gap-6">
                  <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(#10b981 ${experiencePercentage}%, rgba(255,255,255,0.08) ${experiencePercentage}% 100%)`,
                      }}
                    />

                    <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-[#0b111c]">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {experiencePercentage}%
                        </div>

                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                          Experience
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                      Overall Participant Experience
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">{healthText}</h2>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                      {aiAnalysis?.summary || experienceDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* EXPERIENCE BREAKDOWN */}

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <HealthMiniCard
                  label="Positive"
                  value={allRatings.length > 0 ? `${positivePercentage}%` : "—"}
                  description="Ratings 4–5"
                  className="border-emerald-500/10 bg-emerald-500/[0.05]"
                />

                <HealthMiniCard
                  label="Neutral"
                  value={allRatings.length > 0 ? `${neutralPercentage}%` : "—"}
                  description="Rating 3"
                  className="border-yellow-500/10 bg-yellow-500/[0.05]"
                />

                <HealthMiniCard
                  label="Needs attention"
                  value={allRatings.length > 0 ? `${negativePercentage}%` : "—"}
                  description="Ratings 1–2"
                  className="border-red-500/10 bg-red-500/[0.05]"
                />
              </div>
            </section>

            {/* ================================================= */}
            {/* PARTICIPANT EXPERIENCE */}
            {/* ================================================= */}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                  Participant Experience
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  How participants are rating the event
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Rating-based feedback across the generated questions.
                </p>
              </div>

              {ratingAnalysis.length === 0 ? (
                <EmptySection text="Rating data will appear once participants submit feedback." />
              ) : (
                <div className="space-y-5">
                  {ratingAnalysis.map((item, index) => (
                    <div key={index}>
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <p className="max-w-[80%] text-sm text-slate-300">
                          {item.question.question}
                        </p>

                        <span className="shrink-0 text-sm font-semibold text-white">
                          {item.average.toFixed(1)}/5
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${item.percentage}%`,
                          }}
                        />
                      </div>

                      <div className="mt-2 flex justify-between text-[11px] text-slate-600">
                        <span>{item.count} responses</span>

                        <span>{item.percentage}% experience score</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ================================================= */}
            {/* BIGGEST PARTICIPANT CONCERN */}
            {/* ================================================= */}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-yellow-400">
                  Participant Concern
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  Biggest participant concern
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  The strongest recurring issue found in structured feedback.
                </p>
              </div>

              {!biggestConcern ? (
                <EmptySection text="Multiple-choice feedback will appear here when participants respond." />
              ) : (
                <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.04] p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-xl text-yellow-400">
                      !
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Most selected response
                      </p>

                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {biggestConcern.answer}
                      </h3>

                      <p className="mt-2 text-sm text-slate-400">
                        {biggestConcern.percentage}% of responses selected this
                        option.
                      </p>

                      <p className="mt-3 text-xs leading-5 text-slate-600">
                        Question: {biggestConcern.question.question}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ================================================= */}
            {/* ISSUES REQUIRING ATTENTION */}
            {/* ================================================= */}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-red-400">
                    AI Detection
                  </p>

                  <h2 className="mt-1 text-lg font-semibold">
                    Issues requiring attention
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Problems identified from participant feedback.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={analyzeResponsesWithAI}
                  disabled={aiLoading || responses.length === 0}
                  className={`shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition ${
                    aiLoading || responses.length === 0
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-blue-500"
                  }`}
                >
                  {aiLoading
                    ? "Analyzing..."
                    : aiAnalysis
                      ? "Refresh AI"
                      : "Analyze with AI"}
                </button>
              </div>

              {aiError && (
                <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {aiError}
                </div>
              )}

              {!aiAnalysis ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    ✦
                  </div>

                  <h3 className="mt-4 font-semibold">AI issue detection</h3>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Analyze participant feedback to detect recurring problems,
                    severity and recommended actions.
                  </p>
                </div>
              ) : aiIssues.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-6 text-center">
                  <div className="text-2xl text-emerald-400">✓</div>

                  <h3 className="mt-3 font-semibold">
                    No major issues detected
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Participant feedback is currently not showing any
                    significant recurring problems.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {aiIssues.map((issue, index) => (
                    <IssueCard key={index} issue={issue} />
                  ))}
                </div>
              )}
            </section>

            {/* ================================================= */}
            {/* WHAT'S WORKING WELL */}
            {/* ================================================= */}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                  Positive Signals
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  What’s working well
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Areas where participants are responding positively.
                </p>
              </div>

              <div className="space-y-3">
                {getWorkingWellItems(ratingAnalysis, aiAnalysis).map(
                  (item, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                          ✓
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-emerald-300">
                            {item.title}
                          </h3>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>

            {/* ================================================= */}
            {/* PARTICIPANT SUGGESTIONS */}
            {/* ONLY 2–3 SUMMARY POINTS */}
            {/* ================================================= */}

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-yellow-400">
                  Participant Suggestions
                </p>

                <h2 className="mt-1 text-lg font-semibold">
                  Overall feedback from participants
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Main improvement themes summarized from participant
                  suggestions.
                </p>
              </div>

              {participantSuggestions.length === 0 ? (
                <EmptySection text="Participant suggestions will appear here when people submit optional suggestions." />
              ) : (
                <div className="space-y-3">
                  {participantSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 rounded-xl border border-white/10 bg-black/10 p-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm leading-6 text-slate-200">
                          {suggestion.text}
                        </p>

                        {suggestion.count > 1 && (
                          <p className="mt-1 text-xs text-slate-600">
                            Mentioned by {suggestion.count} participants
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ================================================= */}
            {/* AI RECOMMENDATIONS */}
            {/* ================================================= */}

            {aiAnalysis?.recommendations?.length > 0 && (
              <section className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] p-6">
                <div className="mb-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                    AI Recommendations
                  </p>

                  <h2 className="mt-1 text-lg font-semibold">
                    Recommended actions
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Actions generated from participant feedback.
                  </p>
                </div>

                <div className="space-y-3">
                  {aiAnalysis.recommendations
                    .slice(0, 5)
                    .map((recommendation, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/10 p-4"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-semibold text-blue-400">
                          {index + 1}
                        </div>

                        <p className="text-sm leading-6 text-slate-300">
                          {recommendation}
                        </p>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </div>

          {/* ================================================= */}
          {/* RIGHT SIDEBAR */}
          {/* ================================================= */}

          <aside className="space-y-6">
            {/* EVENT PROFILE */}

            <section className="sticky top-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                  Event Profile
                </p>

                <h2 className="mt-1 text-lg font-semibold">Event details</h2>
              </div>

              <div className="space-y-4">
                <SidebarInfo label="Event" value={event?.name} />

                <SidebarInfo label="Event type" value={event?.event_type} />

                <SidebarInfo label="Audience" value={event?.audience} />

                <SidebarInfo label="Date" value={event?.event_date} />

                <SidebarInfo label="Venue" value={event?.venue} />
              </div>

              {/* TOPICS */}

              {Array.isArray(event?.topics) && event.topics.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-xs uppercase tracking-wider text-slate-600">
                    Topics
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.topics.slice(0, 8).map((topic, index) => (
                      <span
                        key={index}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-400"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SUGGESTIONS COUNT */}

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Suggestions</span>

                  <span className="text-xl font-bold text-yellow-400">
                    {suggestionCount}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-600">
                  Optional suggestions received from participants
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

/* ================================================= */
/* METRIC CARD */
/* ================================================= */

function MetricCard({ icon, label, value, subtitle, iconClass }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>

      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
    </div>
  );
}

/* ================================================= */
/* HEALTH MINI CARD */
/* ================================================= */

function HealthMiniCard({ label, value, description, className }) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-1 text-xl font-bold">{value}</p>

      <p className="mt-1 text-xs text-slate-600">{description}</p>
    </div>
  );
}

/* ================================================= */
/* ISSUE CARD */
/* ================================================= */

function IssueCard({ issue }) {
  const severity = String(issue.severity || "medium").toLowerCase();

  let severityClass = "border-yellow-500/20 bg-yellow-500/[0.04]";

  let badgeClass = "bg-yellow-500/10 text-yellow-400";

  if (severity === "high") {
    severityClass = "border-red-500/20 bg-red-500/[0.04]";

    badgeClass = "bg-red-500/10 text-red-400";
  }

  if (severity === "low") {
    severityClass = "border-blue-500/20 bg-blue-500/[0.04]";

    badgeClass = "bg-blue-500/10 text-blue-400";
  }

  return (
    <div className={`rounded-xl border p-5 ${severityClass}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {/* PROBLEM */}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
            >
              {severity}
            </span>

            {issue.category && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-500">
                {issue.category}
              </span>
            )}

            {typeof issue.percentage === "number" && (
              <span className="text-xs text-slate-500">
                {issue.percentage}% affected
              </span>
            )}
          </div>

          <h3 className="mt-3 text-base font-semibold text-white">
            {issue.problem}
          </h3>

          {issue.evidence && (
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {issue.evidence}
            </p>
          )}
        </div>

        {/* RECOMMENDATION */}

        {issue.recommendation && (
          <div className="w-full rounded-xl border border-blue-500/10 bg-blue-500/[0.04] p-4 lg:max-w-[310px]">
            <div className="flex items-center gap-2">
              <span className="text-blue-400">⚡</span>

              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Recommended Action
              </p>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              {issue.recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================= */
/* SIDEBAR INFO */
/* ================================================= */

function SidebarInfo({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-300">
        {value || "Not provided"}
      </p>
    </div>
  );
}

/* ================================================= */
/* EMPTY SECTION */
/* ================================================= */

function EmptySection({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500">
        —
      </div>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
        {text}
      </p>
    </div>
  );
}

/* ================================================= */
/* WHAT'S WORKING WELL */
/* ================================================= */

function getWorkingWellItems(ratingAnalysis, aiAnalysis) {
  const items = [];

  const strongRatings = [...ratingAnalysis]
    .filter((item) => item.average >= 4)
    .sort((a, b) => b.average - a.average)
    .slice(0, 3);

  strongRatings.forEach((item) => {
    items.push({
      title:
        item.question.category ||
        item.question.question ||
        "Positive participant experience",

      description: `${item.average.toFixed(1)}/5 average rating across ${
        item.count
      } responses.`,
    });
  });

  if (items.length === 0 && aiAnalysis?.summary) {
    items.push({
      title: "Overall participant feedback",

      description:
        "Participants have provided enough feedback for EventPulse AI to identify the current event experience.",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Waiting for feedback",

      description:
        "Positive event areas will appear as participants submit responses.",
    });
  }

  return items.slice(0, 3);
}
