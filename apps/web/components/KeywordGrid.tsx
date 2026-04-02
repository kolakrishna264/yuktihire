"use client"
import { useState } from "react"
import { cn } from "@/lib/utils/cn"
import { CheckCircle2, XCircle, Layers, FileText } from "lucide-react"

interface KeywordGridProps {
  matched: string[]
  missing: string[]
  maxShow?: number
  onInsertToSkills?: (kw: string) => void
  onInsertToSummary?: (kw: string) => void
}

type InsertedState = "skills" | "summary" | null

function InsertableKeyword({
  kw,
  onInsertToSkills,
  onInsertToSummary,
}: {
  kw: string
  onInsertToSkills?: (kw: string) => void
  onInsertToSummary?: (kw: string) => void
}) {
  const [inserted, setInserted] = useState<InsertedState>(null)
  const [hovered, setHovered] = useState(false)

  const handleInsertSkills = () => {
    onInsertToSkills?.(kw)
    setInserted("skills")
  }

  const handleInsertSummary = () => {
    onInsertToSummary?.(kw)
    setInserted("summary")
  }

  if (inserted) {
    return (
      <span
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-300",
          "bg-emerald-50 text-emerald-700 border-emerald-300",
          "dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700"
        )}
      >
        {kw}
        <span className="text-[10px] opacity-70">
          → {inserted === "skills" ? "Skills" : "Summary"}
        </span>
      </span>
    )
  }

  const hasActions = onInsertToSkills || onInsertToSummary

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all",
          "bg-red-50 text-red-600 border-red-200",
          "dark:bg-red-900/20 dark:text-red-400 dark:border-red-900",
          hovered && hasActions && "border-red-300 bg-red-100 dark:bg-red-900/30"
        )}
      >
        {kw}
      </span>

      {/* Hover action pill group */}
      {hasActions && hovered && (
        <span
          className={cn(
            "absolute left-0 top-full mt-1 z-10 flex items-center gap-0.5",
            "bg-popover border border-border rounded-lg shadow-lg px-1 py-0.5",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
        >
          {onInsertToSkills && (
            <button
              onClick={handleInsertSkills}
              title="Add to Skills"
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30",
                "transition-colors whitespace-nowrap"
              )}
            >
              <Layers className="w-2.5 h-2.5 shrink-0" />
              Skills
            </button>
          )}
          {onInsertToSkills && onInsertToSummary && (
            <span className="w-px h-3 bg-border" />
          )}
          {onInsertToSummary && (
            <button
              onClick={handleInsertSummary}
              title="Add to Summary"
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                "text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/30",
                "transition-colors whitespace-nowrap"
              )}
            >
              <FileText className="w-2.5 h-2.5 shrink-0" />
              Summary
            </button>
          )}
        </span>
      )}
    </span>
  )
}

export function KeywordGrid({
  matched,
  missing,
  maxShow = 12,
  onInsertToSkills,
  onInsertToSummary,
}: KeywordGridProps) {
  const allMatched = matched.slice(0, maxShow)
  const allMissing = missing.slice(0, maxShow)

  return (
    <div className="space-y-3">
      {allMatched.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Matched ({allMatched.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allMatched.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
      {allMissing.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 mb-1.5 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Missing ({allMissing.length}){(onInsertToSkills || onInsertToSummary) ? " — hover to insert" : " — hover to copy"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allMissing.map((kw) => (
              <InsertableKeyword
                key={kw}
                kw={kw}
                onInsertToSkills={onInsertToSkills}
                onInsertToSummary={onInsertToSummary}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
