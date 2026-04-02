"use client"
import { useState } from "react"
import { cn } from "@/lib/utils/cn"
import { CheckCircle2, XCircle, Copy, Check } from "lucide-react"

interface KeywordGridProps {
  matched: string[]
  missing: string[]
  maxShow?: number
}

function CopyableKeyword({ kw }: { kw: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(kw)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API unavailable
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : "Click to copy keyword"}
      className={cn(
        "group flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all",
        copied
          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700"
          : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900/30 cursor-pointer"
      )}
    >
      {kw}
      {copied ? (
        <Check className="w-2.5 h-2.5 shrink-0" />
      ) : (
        <Copy className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
      )}
    </button>
  )
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
            Missing ({allMissing.length}) — click to copy
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allMissing.map((kw) => (
              <CopyableKeyword key={kw} kw={kw} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
