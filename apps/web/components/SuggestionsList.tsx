"use client"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Check, X, ChevronDown, ChevronUp, AlertTriangle, Zap } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { Recommendation, RecommendationStatus } from "@/types"

interface SuggestionsListProps {
  recommendations: Recommendation[]
  onUpdateStatus: (recId: string, status: RecommendationStatus) => void
  onApplyOne?: (rec: Recommendation) => void
}

export function SuggestionsList({ recommendations, onUpdateStatus, onApplyOne }: SuggestionsListProps) {
  const pending = recommendations.filter((r) => r.status === "PENDING")
  const accepted = recommendations.filter((r) => r.status === "ACCEPTED")

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-2">
          <Check className="w-4 h-4 text-emerald-600" />
        </div>
        <p className="font-semibold text-sm mb-1">Resume well-optimized!</p>
        <p className="text-xs text-muted-foreground">No improvements found for this job.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">{recommendations.length} suggestions</span>
        {pending.length > 0 && <Badge variant="secondary">{pending.length} pending</Badge>}
        {accepted.length > 0 && <Badge variant="success">{accepted.length} applied</Badge>}
      </div>

      {/* Pending */}
      {pending.map((rec) => (
        <SuggestionCard key={rec.id} rec={rec} onUpdateStatus={onUpdateStatus} onApplyOne={onApplyOne} />
      ))}

      {/* Applied */}
      {accepted.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider pt-2">
            Applied ({accepted.length})
          </p>
          {accepted.map((rec) => (
            <div key={rec.id} className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10 p-3">
              <div className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <Badge variant="default" className="text-[9px]">{rec.section}</Badge>
                <p className="text-[11px] text-muted-foreground truncate flex-1">{rec.reason}</p>
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground underline shrink-0"
                  onClick={() => onUpdateStatus(rec.id, "PENDING")}
                >
                  Undo
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function SuggestionCard({
  rec,
  onUpdateStatus,
  onApplyOne,
}: {
  rec: Recommendation
  onUpdateStatus: (id: string, status: RecommendationStatus) => void
  onApplyOne?: (rec: Recommendation) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isGap = rec.original === rec.suggested

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant={isGap ? "warning" : "default"} className="text-[9px]">
            {isGap ? "Gap" : rec.section}
          </Badge>
          {rec.keywords.length > 0 && !isGap && (
            <div className="flex gap-1 flex-1 overflow-hidden">
              {rec.keywords.slice(0, 2).map((kw) => (
                <span key={kw} className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium truncate">
                  +{kw}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto p-0.5 text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{rec.reason}</p>

        {expanded && !isGap && (
          <div className="space-y-2 mt-2">
            <div className="rounded bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-2">
              <p className="text-[9px] font-semibold text-red-500 mb-0.5">Original</p>
              <p className="text-[11px] text-foreground leading-relaxed">{rec.original}</p>
            </div>
            <div className="rounded bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-2">
              <p className="text-[9px] font-semibold text-emerald-600 mb-0.5">Suggested</p>
              <p className="text-[11px] text-foreground leading-relaxed font-medium">{rec.suggested}</p>
            </div>
          </div>
        )}

        {expanded && isGap && (
          <div className="rounded bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-2 mt-2">
            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Skill gap — consider upskilling
            </div>
          </div>
        )}

        {!isGap && (
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="xs"
              className="flex-1 text-[10px] h-7 border-muted-foreground/20"
              onClick={() => onUpdateStatus(rec.id, "REJECTED")}
            >
              <X className="w-3 h-3" />
              Skip
            </Button>
            <Button
              size="xs"
              className="flex-1 text-[10px] h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                onUpdateStatus(rec.id, "ACCEPTED")
                onApplyOne?.(rec)
              }}
            >
              <Zap className="w-3 h-3" />
              Apply
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
