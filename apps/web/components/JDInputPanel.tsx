"use client"
import { useState, useEffect } from "react"
import { useAnalyzeJD } from "@/lib/hooks/useTailor"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Textarea"
import { Card, CardContent } from "@/components/ui/Card"
import { Link, FileSearch, CheckCircle2 } from "lucide-react"
import type { JDAnalysis } from "@/types"

interface JDInputPanelProps {
  onAnalyzed: (analysis: JDAnalysis) => void
  initialText?: string
}

export function JDInputPanel({ onAnalyzed, initialText }: JDInputPanelProps) {
  const [mode, setMode] = useState<"text" | "url">("text")
  const [text, setText] = useState(initialText || "")
  const [url, setUrl] = useState("")
  const [analyzed, setAnalyzed] = useState(false)

  // Update text when initialText loads (async from tracker)
  useEffect(() => {
    if (initialText && !text) setText(initialText)
  }, [initialText])
  const { mutate: analyze, isPending } = useAnalyzeJD()

  const handleAnalyze = () => {
    const payload = mode === "text" ? { text } : { url }
    analyze(payload, {
      onSuccess: (data) => {
        setAnalyzed(true)
        onAnalyzed(data)
      },
    })
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Job Description</h2>
          {analyzed && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Parsed
            </span>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border p-0.5 gap-0.5 w-fit">
          <button
            onClick={() => setMode("text")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === "text" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Paste text
          </button>
          <button
            onClick={() => setMode("url")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === "url" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            From URL
          </button>
        </div>

        {mode === "text" ? (
          <Textarea
            placeholder="Paste the full job description here…

We're looking for a Senior ML Engineer with 5+ years experience in Python, PyTorch, and distributed training..."
            className="min-h-[220px] text-sm resize-none"
            value={text}
            onChange={(e) => { setText(e.target.value); setAnalyzed(false) }}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="https://careers.company.com/job/..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setAnalyzed(false) }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              We&apos;ll try to fetch the job description. If it requires login, paste the text instead.
            </p>
          </div>
        )}

        <Button
          className="w-full"
          size="md"
          loading={isPending}
          disabled={(mode === "text" && text.length < 50) || (mode === "url" && !url)}
          onClick={handleAnalyze}
        >
          <FileSearch className="w-4 h-4" />
          {analyzed ? "Re-analyze" : "Analyze Job Description"}
        </Button>
      </CardContent>
    </Card>
  )
}
