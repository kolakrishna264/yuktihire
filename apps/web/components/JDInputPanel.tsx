"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useAnalyzeJD } from "@/lib/hooks/useTailor"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Textarea"
import { Card, CardContent } from "@/components/ui/Card"
import { Link, FileSearch, CheckCircle2, Loader2 } from "lucide-react"
import type { JDAnalysis } from "@/types"

interface JDInputPanelProps {
  onAnalyzed: (analysis: JDAnalysis) => void
  onTextChange?: (text: string) => void
  initialText?: string
}

export function JDInputPanel({ onAnalyzed, onTextChange, initialText }: JDInputPanelProps) {
  const [mode, setMode] = useState<"text" | "url">("text")
  const [text, setText] = useState(initialText || "")
  const [url, setUrl] = useState("")
  const [analyzed, setAnalyzed] = useState(false)
  const [autoAnalyzing, setAutoAnalyzing] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Update text when initialText loads (async from tracker)
  useEffect(() => {
    if (initialText && !text) {
      setText(initialText)
      onTextChange?.(initialText)
    }
  }, [initialText])

  const { mutate: analyze, isPending } = useAnalyzeJD()

  const triggerAnalyze = useCallback((jdText: string) => {
    if (jdText.length < 50) return
    setAutoAnalyzing(true)
    analyze({ text: jdText }, {
      onSuccess: (data) => {
        setAnalyzed(true)
        setAutoAnalyzing(false)
        onAnalyzed(data)
      },
      onError: () => setAutoAnalyzing(false),
    })
  }, [analyze, onAnalyzed])

  // Auto-analyze after user stops typing (1.5s debounce)
  const handleTextChange = (value: string) => {
    setText(value)
    setAnalyzed(false)
    onTextChange?.(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length >= 100) {
      debounceRef.current = setTimeout(() => triggerAnalyze(value), 1500)
    }
  }

  // Also auto-analyze when initialText is set (from tracker)
  useEffect(() => {
    if (initialText && initialText.length >= 100 && !analyzed) {
      triggerAnalyze(initialText)
    }
  }, [initialText])

  const handleManualAnalyze = () => {
    const payload = mode === "text" ? { text } : { url }
    analyze(payload, {
      onSuccess: (data) => {
        setAnalyzed(true)
        setAutoAnalyzing(false)
        onAnalyzed(data)
      },
    })
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Job Description</h2>
          <div className="flex items-center gap-2">
            {autoAnalyzing && !analyzed && (
              <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Analyzing...
              </span>
            )}
            {analyzed && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Parsed
              </span>
            )}
          </div>
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
            placeholder="Paste the full job description here — analysis starts automatically..."
            className="min-h-[220px] text-sm resize-none"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
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
            <Button
              className="w-full"
              size="md"
              loading={isPending}
              disabled={!url}
              onClick={handleManualAnalyze}
            >
              <FileSearch className="w-4 h-4" />
              Fetch & Analyze
            </Button>
          </div>
        )}

        {/* Only show manual analyze button for text mode if auto-analyze hasn't run */}
        {mode === "text" && !analyzed && !autoAnalyzing && text.length >= 50 && (
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            loading={isPending}
            onClick={handleManualAnalyze}
          >
            <FileSearch className="w-4 h-4" />
            Analyze Now
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
