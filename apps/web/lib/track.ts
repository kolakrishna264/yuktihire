import { apiFetch } from "@/lib/api/client"

/**
 * Track a beta event. Fire-and-forget — never blocks UI.
 */
export function trackEvent(eventType: string, data?: Record<string, any>) {
  try {
    apiFetch("/events", {
      method: "POST",
      body: JSON.stringify({
        event_type: eventType,
        event_data: data ? JSON.stringify(data) : null,
        page: typeof window !== "undefined" ? window.location.pathname : null,
      }),
    }).catch(() => {}) // Silent fail
  } catch {
    // Never crash the app for tracking
  }
}

// Pre-defined event types for consistency
export const EVENTS = {
  // Onboarding
  SIGNUP: "signup",
  RESUME_UPLOADED: "resume_uploaded",
  PROFILE_COMPLETED: "profile_completed",

  // Core features
  TAILORING_STARTED: "tailoring_started",
  TAILORING_COMPLETED: "tailoring_completed",
  RESUME_EXPORTED: "resume_exported",
  JOB_SAVED: "job_saved",

  // Extension
  AUTOFILL_STARTED: "autofill_started",
  AUTOFILL_COMPLETED: "autofill_completed",

  // Interview
  MOCK_INTERVIEW_STARTED: "mock_interview_started",
  MOCK_INTERVIEW_COMPLETED: "mock_interview_completed",

  // Engagement
  FEED_VIEWED: "feed_viewed",
  COVER_LETTER_GENERATED: "cover_letter_generated",
  FEEDBACK_SUBMITTED: "feedback_submitted",
} as const
