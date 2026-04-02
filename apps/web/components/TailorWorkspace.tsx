"use client"
import { useState, useCallback } from "react"
import { useResumes } from "@/lib/hooks/useResumes"
import { useRunTailoring, useTailoringSession, useUpdateRecommendation, useApplyRecommendations } from "@/lib/hooks/useTailor"
import { JDInputPanel } from "./JDInputPanel"
import { ResumeSelectPanel } from "./ResumeSelectPanel"
import { AtsScorePanel } from "./AtsScorePanel"
import { SuggestionsList } from "./SuggestionsList"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Wand2, ChevronRight, RotateCcw } from "lucide-react"
import type { JDAnalysis, RecommendationStatus } from "@/types"
import { toast } from "sonner"

type Step = "setup" | "running" | "results"

export function TailorWorkspace() {
  const [step, setStep] = useState<Step>("setup")
  const [selectedResumeId, setSelectedResumeId] = useState<string>("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysis | null>(null)
  const [saveLabel, setSaveLabel] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const { data: resumes = [] } = useResumes()
  const { mutate: runTailoring, isPending: startingTailor } = useRunTailoring()
  const { data: sessionData, isPolling } = useTailoringSession(sessionId)
  const { mutate: updateRec } = useUpdateRecommendation(sessionId ?? "")
  const { mutate: applyRecs, isPending: applying } = useApplyRecommendations(sessionId ?? "")

  const isComplete = sessionData?.session?.status === "COMPLETED"

  const handleJDAnalyzed = useCallback((analysis: JDAnalysis) => {
    setJdAnalysis(analysis)
  }, [])

  const handleStartTailoring = () => {
    if (!selectedResumeId || !jdAnalysis?.jobDescriptionId) {
      toast.error("Select a resume and analyze a job description first")
      return
    }
    setStep("running")
    runTailoring(
      { resumeId: selectedResumeId, jobDescriptionId: jdAnalysis.jobDescriptionId },
      {
        onSuccess: ({ sessionId: sid }) => {
          setSessionId(sid)
          setStep("results")
        },
        onError: () => setStep("setup"),
      }
    )
  }

  const handleRecStatus = (recId: string, status: RecommendationStatus) => {
    updateRec({ recId, status })
  }

  const handleSaveVersion = () => {
    if (!sessionId) return
    applyRecs(saveLabel || undefined, {
      onSuccess: () => setShowSaveDialog(false),
    })
  }

  const handleReset = () => {
    setStep("setup")
    setSessionId(null)
    setJdAnalysis(null)
    setSaveLabel("")
  }

  const acceptedCount = sessionData?.recommendations?.filter(
    (r) => r.status === "ACCEPTED"
  ).length ?? 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary" />
          <h1 className="font-semibold text-sm">Tailor Resume</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step !== "setup" ? "text-foreground font-medium" : "text-primary font-medium"}>
            1. Setup
          </span>
          <ChevronRight className="w-3 h-3" />
          <span className={step === "results" ? "text-foreground font-medium" : ""}>
            2. AI Analysis
          </span>
          <ChevronRight className="w-3 h-3" />
          <span className={step === "results" && isComplete ? "text-primary font-medium" : ""}>
            3. Review
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {step === "results" && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
                New
              </Button>
              {isComplete && acceptedCount > 0 && (
                <Button
                  size="sm"
                  loading={applying}
                  onClick={() => setShowSaveDialog(true)}
                >
                  Save {acceptedCount} change{acceptedCount !== 1 ? "s" : ""}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Workspace */}
      {step === "setup" && (
        <div className="flex-1 grid lg:grid-cols-2 gap-6 p-6 overflow-auto">
          {/* Left: JD Input */}
          <JDInputPanel onAnalyzed={handleJDAnalyzed} />

          {/* Right: Resume select */}
          <div className="space-y-4">
            <ResumeSelectPanel
              resumes={resumes}
              selectedId={selectedResumeId}
              onSelect={setSelectedResumeId}
            />

            {/* Go button */}
            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!selectedResumeId || !jdAnalysis}
              loading={startingTailor}
              onClick={handleStartTailoring}
            >
              <Wand2 className="w-4 h-4" />
              Start AI Tailoring
            </Button>

            {jdAnalysis && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  JD Parsed
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {jdAnalysis.requiredSkills.slice(0, 8).map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                  {jdAnalysis.requiredSkills.length > 8 && (
                    <Badge variant="secondary">+{jdAnalysis.requiredSkills.length - 8} more</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {jdAnalysis.role} · {jdAnalysis.seniorityLevel} level · {jdAnalysis.mustHaveKeywords.length} must-have keywords
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="flex-1 flex items-center justify-center">
          <TailoringRunningState />
        </div>
      )}

      {step === "results" && sessionData && (
        <div className="flex-1 grid lg:grid-cols-3 gap-0 overflow-hidden">
          {/* Left: ATS score + breakdown */}
          <div className="border-r border-border overflow-y-auto scrollbar-thin p-5 space-y-4">
            {isPolling ? (
              <TailoringRunningState compact />
            ) : (
              sessionData.atsScore && (
                <AtsScorePanel atsScore={sessionData.atsScore} jdAnalysis={jdAnalysis} />
              )
            )}
          </div>

          {/* Center + Right: Suggestions */}
          <div className="lg:col-span-2 overflow-y-auto scrollbar-thin">
            {isPolling ? (
              <div className="p-5 space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
              </div>
            ) : (
              <SuggestionsList
                recommendations={sessionData.recommendations ?? []}
                onUpdateStatus={handleRecStatus}
              />
            )}
          </div>
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSaveDialog(false)} />
          <div className="relative bg-card rounded-xl border border-border shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold mb-2">Save as version</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {acceptedCount} accepted change{acceptedCount !== 1 ? "s" : ""} will be applied
            </p>
            <input
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-4"
              placeholder="Version label (optional)"
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={applying} onClick={handleSaveVersion}>
                Save Version
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TailoringRunningState({ compact = false }: { compact?: boolean }) {
  const steps = [
    { label: "Analyzing job description", done: true },
    { label: "Comparing your experience", done: true },
    { label: "Generating suggestions", done: false },
  ]

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm font-medium">AI is working…</span>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  return (
    <div className="text-center max-w-sm">
      <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-6" />
      <h3 className="font-semibold mb-1">AI is tailoring your resume</h3>
      <p className="text-sm text-muted-foreground mb-6">
        This takes 15-30 seconds. Please wait…
      </p>
      <div className="space-y-3 text-left">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              s.done ? "bg-emerald-500" : "border-2 border-primary animate-pulse"
            }`}>
              {s.done && <span className="text-white text-xs">✓</span>}
            </div>
            <span className={`text-sm ${s.done ? "text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
