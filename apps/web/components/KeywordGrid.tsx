"use client"
import { useState } from "react"
import { cn } from "@/lib/utils/cn"
import { CheckCircle2, XCircle, Plus } from "lucide-react"

interface KeywordGridProps {
  matched: string[]
  missing: string[]
  maxShow?: number
  onInsertToSkills?: (kw: string) => void
  onInsertToSummary?: (kw: string) => void
}

export function KeywordGrid({
  matched,
  missing,
  maxShow = 20,
  onInsertToSkills,
  onInsertToSummary,
}: KeywordGridProps) {
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set())

  const handleAdd = (kw: string) => {
    onInsertToSkills?.(kw)
    setAddedKeywords(prev => new Set([...prev, kw]))
  }

  return (
    <div className="space-y-3">
      {matched.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Matched ({matched.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matched.slice(0, maxShow).map((kw) => (
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
      {missing.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 mb-1.5 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Missing ({missing.length}) — click to add to resume
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing.slice(0, maxShow).map((kw) => (
              addedKeywords.has(kw) ? (
                <span
                  key={kw}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-300"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {kw}
                </span>
              ) : (
                <button
                  key={kw}
                  onClick={() => handleAdd(kw)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  {kw}
                </button>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
