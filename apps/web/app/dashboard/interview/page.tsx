"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { trackEvent, EVENTS } from "@/lib/track"
import { useResumes } from "@/lib/hooks/useResumes"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import {
  MessageCircle, Send, Mic, Lightbulb, RotateCcw,
  ChevronDown, User, Bot, Star, ArrowRight,
} from "lucide-react"
import { toast } from "sonner"

type Message = {
  role: "interviewer" | "candidate" | "feedback" | "system"
  content: string
  questionNumber?: number
}

type InterviewState = "setup" | "active" | "complete"

export default function MockInterviewPage() {
  const { data: resumes = [] } = useResumes()
  const [state, setState] = useState<InterviewState>("setup")
  const [selectedResumeId, setSelectedResumeId] = useState("")
  const [jdText, setJdText] = useState("")
  const [company, setCompany] = useState("")
  const [role, setRole] = useState("")
  const [interviewType, setInterviewType] = useState("full")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionContext, setSessionContext] = useState<any[]>([])
  const [questionNum, setQuestionNum] = useState(0)
  const [showFeedback, setShowFeedback] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (resumes.length > 0 && !selectedResumeId) {
      setSelectedResumeId(resumes[0].id)
    }
  }, [resumes, selectedResumeId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const startInterview = async () => {
    if (!selectedResumeId) { toast.error("Select a resume first"); return }
    setLoading(true)
    setState("active")
    trackEvent(EVENTS.MOCK_INTERVIEW_STARTED, { interviewType, company, role })
    setMessages([{ role: "system", content: "Starting mock interview..." }])

    try {
      const res = await apiFetch("/intelligence/mock-interview/start", {
        method: "POST",
        body: JSON.stringify({
          resume_id: selectedResumeId,
          job_description: jdText || undefined,
          company: company || undefined,
          role: role || undefined,
          interview_type: interviewType,
        }),
      })
      setSessionContext(res.sessionContext || [])
      setQuestionNum(res.questionNumber || 1)
      setCompany(res.company || company)
      setRole(res.role || role)
      setMessages([
        { role: "interviewer", content: res.question, questionNumber: 1 },
      ])
    } catch (err) {
      toast.error("Failed to start interview")
      setState("setup")
    } finally {
      setLoading(false)
    }
  }

  const sendAnswer = async () => {
    if (!input.trim() || loading) return
    const answer = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "candidate", content: answer }])
    setLoading(true)

    try {
      const res = await apiFetch("/intelligence/mock-interview/reply", {
        method: "POST",
        body: JSON.stringify({
          session_context: JSON.stringify(sessionContext),
          user_answer: answer,
          resume_id: selectedResumeId,
          company,
          role,
        }),
      })
      setSessionContext(res.sessionContext || sessionContext)
      setQuestionNum(res.questionNumber || questionNum + 1)
      setMessages(prev => [
        ...prev,
        { role: "interviewer", content: res.question, questionNumber: res.questionNumber },
      ])
      if (res.isComplete) {
        setState("complete")
        trackEvent(EVENTS.MOCK_INTERVIEW_COMPLETED, { questionCount: res.questionNumber })
      }
    } catch {
      toast.error("Failed to get next question")
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const getFeedback = async (answer: string) => {
    setShowFeedback("loading")
    try {
      const res = await apiFetch("/intelligence/mock-interview/feedback", {
        method: "POST",
        body: JSON.stringify({
          session_context: JSON.stringify(sessionContext),
          user_answer: answer,
          resume_id: selectedResumeId,
          job_description: jdText,
          company,
          role,
        }),
      })
      setShowFeedback(res.feedback)
      setMessages(prev => [...prev, { role: "feedback", content: res.feedback }])
    } catch {
      setShowFeedback(null)
      toast.error("Failed to get feedback")
    }
  }

  const resetInterview = () => {
    setState("setup")
    setMessages([])
    setSessionContext([])
    setQuestionNum(0)
    setInput("")
    setShowFeedback(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Mock Interview</h1>
            <p className="text-[11px] text-muted-foreground">
              {state === "setup" ? "Set up your practice session" :
               state === "complete" ? "Interview complete" :
               `Q${questionNum} · ${company || "Company"} · ${role || "Role"}`}
            </p>
          </div>
        </div>
        {state !== "setup" && (
          <Button variant="outline" size="sm" onClick={resetInterview}>
            <RotateCcw className="w-3 h-3" />
            New Interview
          </Button>
        )}
      </div>

      {/* Setup */}
      {state === "setup" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg mx-auto space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Practice Interview</h2>
              <p className="text-sm text-muted-foreground mt-1">
                AI interviewer tailored to your resume and target job
              </p>
            </div>

            {/* Resume select */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Resume</label>
              <select
                value={selectedResumeId}
                onChange={e => setSelectedResumeId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {resumes.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name || "Resume"}</option>
                ))}
              </select>
            </div>

            {/* Company + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Company</label>
                <input
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Google"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Role</label>
                <input
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. ML Engineer"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* JD */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Job Description (optional)</label>
              <textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste the job description for more relevant questions..."
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Interview type */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Interview Type</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "full", label: "Full Interview" },
                  { key: "recruiter", label: "Recruiter Screen" },
                  { key: "technical", label: "Technical" },
                  { key: "behavioral", label: "Behavioral" },
                  { key: "final", label: "Final Round" },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setInterviewType(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      interviewType === t.key
                        ? "bg-primary text-white border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              loading={loading}
              onClick={startInterview}
            >
              <MessageCircle className="w-4 h-4" />
              Start Mock Interview
            </Button>
          </div>
        </div>
      )}

      {/* Chat */}
      {(state === "active" || state === "complete") && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "candidate" ? "justify-end" : ""}`}>
                {msg.role === "interviewer" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] ${
                  msg.role === "candidate"
                    ? "bg-primary text-white rounded-2xl rounded-br-md px-4 py-3"
                    : msg.role === "feedback"
                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3"
                    : msg.role === "system"
                    ? "text-center text-xs text-muted-foreground py-2 w-full max-w-full"
                    : "bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3"
                }`}>
                  {msg.questionNumber && msg.role === "interviewer" && (
                    <span className="text-[9px] font-bold text-primary/60 uppercase tracking-wider block mb-1">
                      Question {msg.questionNumber}
                    </span>
                  )}
                  {msg.role === "feedback" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Feedback</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                  {/* Feedback button on candidate answers */}
                  {msg.role === "candidate" && (
                    <button
                      onClick={() => getFeedback(msg.content)}
                      className="mt-2 text-[10px] text-white/70 hover:text-white underline"
                    >
                      Get feedback on this answer
                    </button>
                  )}
                </div>
                {msg.role === "candidate" && (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-emerald-700" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            {showFeedback === "loading" && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4 text-amber-600 animate-pulse" />
                </div>
                <Skeleton className="h-20 w-64 rounded-2xl" />
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          {state === "active" && (
            <div className="shrink-0 border-t border-border bg-card p-4">
              <div className="flex gap-2 items-end max-w-3xl mx-auto">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAnswer() }
                  }}
                  placeholder="Type your answer... (Shift+Enter for new line)"
                  rows={2}
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
                <Button
                  size="sm"
                  onClick={sendAnswer}
                  disabled={!input.trim() || loading}
                  className="h-11 w-11 rounded-xl p-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Answer naturally as you would in a real interview · Click &quot;Get feedback&quot; on any answer
              </p>
            </div>
          )}

          {/* Complete state */}
          {state === "complete" && (
            <div className="shrink-0 border-t border-border bg-card p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="w-5 h-5 text-amber-500" />
                <p className="font-semibold">Interview Complete!</p>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Review your answers above and click &quot;Get feedback&quot; on any response.
              </p>
              <Button variant="gradient" onClick={resetInterview}>
                <RotateCcw className="w-4 h-4" />
                Start Another Interview
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
