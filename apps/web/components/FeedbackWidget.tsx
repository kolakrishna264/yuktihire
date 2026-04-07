"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { MessageSquare, X, Send, Star } from "lucide-react"
import { apiFetch } from "@/lib/api/client"
import { toast } from "sonner"

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [category, setCategory] = useState("general")
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (!feedback.trim() && rating === 0) return
    setSending(true)
    try {
      await apiFetch("/feedback", {
        method: "POST",
        body: JSON.stringify({
          rating,
          category,
          message: feedback.trim(),
          page: window.location.pathname,
          userAgent: navigator.userAgent.slice(0, 200),
        }),
      })
      toast.success("Thanks for the feedback!")
      setOpen(false)
      setRating(0)
      setFeedback("")
    } catch {
      toast.error("Failed to send — try again")
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-110"
        title="Send feedback"
      >
        <MessageSquare className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-card border border-border rounded-2xl shadow-xl animate-slide-up">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Send Feedback</p>
          <p className="text-[11px] text-muted-foreground">Help us improve YuktiHire</p>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Rating */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">How's your experience?</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star className={`w-5 h-5 ${n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "bug", label: "Bug" },
            { key: "feature", label: "Feature Request" },
            { key: "ux", label: "UX Issue" },
            { key: "general", label: "General" },
          ].map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                category === c.key ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Message */}
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="What's on your mind? Bug? Feature idea? Anything helps..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <Button
          className="w-full"
          size="sm"
          loading={sending}
          onClick={submit}
          disabled={!feedback.trim() && rating === 0}
        >
          <Send className="w-3 h-3" />
          Send Feedback
        </Button>
      </div>
    </div>
  )
}
