"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Check, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { Recommendation, RecommendationStatus } from "@/types"

interface SuggestionsListProps {
  recommendations: Recommendation[]
  onUpdateStatus: (recId: string, status: RecommendationStatus) => void
}

export function SuggestionsList({ recommendations, onUpdateStatus }: SuggestionsListProps) {
  const pending = recommendations.filter((r) => r.status === "PENDING")
  const accepted = recommendations.filter((r) => r.status === "ACCEPTED")
  const rejected = recommendations.filter((r) => r.status === "REJECTED")

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
          <Check className="w-5 h-5 text-emerald-600" />
        </div>
        <p className="font-semibold mb-1">Your resume is well-optimized!</p>
        <p className="text-sm text-muted-foreground">No significant improvements found for this job.</p>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{recommendations.length} suggestions</span>
        <Badge variant="secondary">{pending.length} pending</Badge>
        {accepted.length > 0 && <Badge variant="success">{accepted.length} accepted</Badge>}
        {rejected.length > 0 && <Badge variant="secondary">{rejected.length} rejected</Badge>}
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Review suggestions
          </p>
          {pending.map((rec) => (
            <SuggestionCard key={rec.id} rec={rec} onUpdateStatus={onUpdateStatus} />
          ))}
        </div>
      )}

      {/* Accepted */}
      {accepted.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Accepted
          </p>
          {accepted.map((rec) => (
            <SuggestionCard key={rec.id} rec={rec} onUpdateStatus={onUpdateStatus} compact />
          ))}
        </div>
      )}
    </div>
  )
}

function SuggestionCard({
  rec,
  onUpdateStatus,
  compact = false,
}: {
  rec: Recommendation
  onUpdateStatus: (id: string, status: RecommendationStatus) => void
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(!compact)
  const isGap = rec.original === rec.suggested
  const isAccepted = rec.status === "ACCEPTED"
  const isRejected = rec.status === "REJECTED"

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      isAccepted && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10",
      isRejected && "border-border opacity-50",
      !isAccepted && !isRejected && "border-border bg-card",
    )}>
      <div className="p-4">
        {/* Section badge + keywords */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={isGap ? "warning" : "default"}>
            {isGap ? "Gap" : rec.section}
          </Badge>
          {isGap && (
            <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Skill gap — consider upskilling
            </div>
          )}
          {rec.keywords.length > 0 && !isGap && (
            <div className="flex gap-1">
              {rec.keywords.slice(0, 3).map((kw) => (
                <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  +{kw}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto p-0.5 text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {expanded && (
          <>
            {/* Diff view */}
            {!isGap ? (
              <div className="space-y-2 mb-3">
                <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3">
                  <p className="text-[10px] font-semibold text-red-500 mb-1">Original</p>
                  <p className="text-xs text-foreground leading-relaxed">{rec.original}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-3">
                  <p className="text-[10px] font-semibold text-emerald-600 mb-1">Suggested</p>
                  <p className="text-xs text-foreground leading-relaxed font-medium">{rec.suggested}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-3 mb-3">
                <p className="text-xs text-foreground leading-relaxed">{rec.reason}</p>
              </div>
            )}

            {/* Reason */}
            {!isGap && (
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                💡 {rec.reason}
              </p>
            )}

            {/* Confidence */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${rec.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(rec.confidence * 100)}% confidence
                </span>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        {rec.status === "PENDING" && !isGap && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
              onClick={() => onUpdateStatus(rec.id, "REJECTED")}
            >
              <X className="w-3 h-3" />
              Keep original
            </Button>
            <Button
              size="xs"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onUpdateStatus(rec.id, "ACCEPTED")}
            >
              <Check className="w-3 h-3" />
              Accept
            </Button>
          </div>
        )}

        {isAccepted && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Accepted
            </span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => onUpdateStatus(rec.id, "PENDING")}
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
