"use client"
import { cn } from "@/lib/utils/cn"
import { CheckCircle2, XCircle } from "lucide-react"

interface KeywordGridProps {
  matched: string[]
  missing: string[]
  maxShow?: number
}

export function KeywordGrid({ matched, missing, maxShow = 12 }: KeywordGridProps) {
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
            Missing ({allMissing.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allMissing.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
