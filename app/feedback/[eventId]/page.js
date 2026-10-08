"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function FeedbackPage({ params }) {
  const [eventId, setEventId] = useState(null);

  const [event, setEvent] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [suggestion, setSuggestion] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Get dynamic route ID
  useEffect(() => {
    async function getParams() {
      const resolvedParams = await params;
      setEventId(resolvedParams.eventId);
    }

    getParams();
  }, [params]);

  // Load event and questions
  useEffect(() => {
    if (eventId) {
      loadFeedbackForm();
    }
  }, [eventId]);

  async function loadFeedbackForm() {
    try {
      setLoading(true);
      setError("");

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) {
        throw eventError;
      }

      const { data: questionData, error: questionError } = await supabase
        .from("questions")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (questionError) {
        throw questionError;
      }

      setEvent(eventData);
      setQuestions(questionData || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load this feedback form.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(questionId, answer) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: answer,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (questions.length === 0) {
      setError("No questions are available for this feedback form.");
      return;
    }

    // Check required generated questions
    const unanswered = questions.filter(
      (question) =>
        answers[question.id] === undefined || answers[question.id] === "",
    );

    if (unanswered.length > 0) {
      setError("Please answer all questions before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const { error: responseError } = await supabase.from("responses").insert([
        {
          event_id: eventId,
          participant_id: `participant-${Date.now()}`,

          // All generated question answers
          answers: answers,

          // Optional participant suggestion
          suggestion: suggestion.trim() || null,
        },
      ]);

      if (responseError) {
        throw responseError;
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Unable to submit your feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------
  // Loading
  // --------------------------------

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b12] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#f7b500] border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <p className="text-gray-400">Loading feedback form...</p>
        </div>
      </main>
    );
  }

  // --------------------------------
  // Error while loading
  // --------------------------------

  if (error && !event) {
    return (
      <main className="min-h-screen bg-[#070b12] text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-5">⚠️</div>

          <h1 className="text-2xl font-bold mb-3">Feedback form unavailable</h1>

          <p className="text-gray-400">{error}</p>
        </div>
      </main>
    );
  }

  // --------------------------------
  // Successfully submitted
  // --------------------------------

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#070b12] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-lg text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <span className="text-4xl">✓</span>
          </div>

          <h1 className="text-3xl font-bold mb-3">Feedback Submitted</h1>

          <p className="text-gray-400 text-lg">
            Thank you for sharing your feedback.
          </p>

          <p className="text-gray-500 mt-2">
            Your response and suggestions will help organizers improve the event
            in real time.
          </p>
        </div>
      </main>
    );
  }

  // --------------------------------
  // Main Feedback Form
  // --------------------------------

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      {/* Header */}

      <header className="border-b border-white/10 bg-[#0b111b]/90">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f7b500] flex items-center justify-center text-black font-black">
              EP
            </div>

            <div>
              <p className="font-bold">EventPulse AI</p>

              <p className="text-xs text-gray-500">Live Event Intelligence</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Event Header */}

        <div className="mb-8">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#f7b500]/10 border border-[#f7b500]/20 text-[#f7b500] text-sm mb-4">
            Participant Feedback
          </div>

          <h1 className="text-4xl font-bold tracking-tight mb-4">
            {event?.name}
          </h1>

          {event?.description && (
            <p className="text-gray-400 leading-7">{event.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* -------------------------------- */}
          {/* Generated Questions */}
          {/* -------------------------------- */}

          <div className="space-y-5">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                answer={answers[question.id]}
                onAnswer={handleAnswer}
              />
            ))}
          </div>

          {/* -------------------------------- */}
          {/* OPTIONAL SUGGESTION BOX */}
          {/* -------------------------------- */}

          <div className="mt-6 bg-[#0d141f] border border-white/10 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              {/* Icon */}

              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#f7b500]/10 border border-[#f7b500]/20 flex items-center justify-center text-xl">
                💡
              </div>

              {/* Heading */}

              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold">Have a suggestion?</h2>

                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-500">
                    Optional
                  </span>
                </div>

                <p className="text-sm text-gray-500 mt-2 leading-6">
                  Is there anything you think the organizers could improve?
                  Share your suggestion with us.
                </p>
              </div>
            </div>

            {/* Suggestion textarea */}

            <div className="mt-5">
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Share your suggestion here..."
                rows={5}
                maxLength={1000}
                className="w-full bg-[#111a27] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 outline-none focus:border-[#f7b500] focus:ring-2 focus:ring-[#f7b500]/10 resize-none transition"
              />

              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-600">
                  Your suggestion is optional.
                </p>

                <p className="text-xs text-gray-600">
                  {suggestion.length}/1000
                </p>
              </div>
            </div>
          </div>

          {/* -------------------------------- */}
          {/* Error */}
          {/* -------------------------------- */}

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
              {error}
            </div>
          )}

          {/* -------------------------------- */}
          {/* Submit */}
          {/* -------------------------------- */}

          <div className="mt-8">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-[#f7b500] text-black font-bold text-lg hover:bg-[#ffc933] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting Feedback..." : "Submit Feedback"}
            </button>

            <p className="text-center text-xs text-gray-600 mt-4">
              Your feedback helps organizers improve the event in real time.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ========================================= */
/* Question Card */
/* ========================================= */

function QuestionCard({ question, index, answer, onAnswer }) {
  const type = question.type;

  return (
    <div className="bg-[#0d141f] border border-white/10 rounded-2xl p-6">
      {/* Question Header */}

      <div className="mb-5">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#f7b500]/10 text-[#f7b500] flex items-center justify-center text-sm font-bold">
            {index + 1}
          </span>

          <div className="flex-1">
            <h2 className="text-lg font-semibold leading-7">
              {question.question}
            </h2>

            {question.category && (
              <p className="text-xs text-gray-500 mt-2">{question.category}</p>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------- */}
      {/* Rating */}
      {/* -------------------------------- */}

      {type === "rating" && (
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => onAnswer(question.id, value)}
              className={`h-12 rounded-xl border transition font-semibold ${
                answer === value
                  ? "bg-[#f7b500] border-[#f7b500] text-black"
                  : "border-white/10 bg-[#111a27] text-gray-300 hover:border-[#f7b500]/50"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      {/* -------------------------------- */}
      {/* Multiple Choice */}
      {/* -------------------------------- */}

      {type === "multiple_choice" && (
        <div className="space-y-3">
          {(question.options || []).map((option, optionIndex) => (
            <button
              type="button"
              key={optionIndex}
              onClick={() => onAnswer(question.id, option)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                answer === option
                  ? "border-[#f7b500] bg-[#f7b500]/10 text-white"
                  : "border-white/10 bg-[#111a27] text-gray-300 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-4 h-4 rounded-full border ${
                    answer === option
                      ? "border-[#f7b500] bg-[#f7b500]"
                      : "border-gray-500"
                  }`}
                />

                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* -------------------------------- */}
      {/* Text */}
      {/* -------------------------------- */}

      {type === "text" && (
        <textarea
          value={answer || ""}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder="Share your thoughts..."
          rows={4}
          className="w-full bg-[#111a27] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none focus:border-[#f7b500] resize-none"
        />
      )}
    </div>
  );
}
