"use client"
import { cn } from "@/lib/utils/cn"
import { scoreColor } from "@/lib/utils/format"

interface AtsScoreRingProps {
  score: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}

export function AtsScoreRing({ score, size = "md", showLabel = true, className }: AtsScoreRingProps) {
  const radius = size === "lg" ? 52 : size === "md" ? 36 : 24
  const strokeW = size === "lg" ? 8 : 6
  const viewBox = (radius + strokeW) * 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const ringColor = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444"
  const textSize = size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-sm"
  const labelSize = size === "lg" ? "text-sm" : "text-[10px]"
  const wh = size === "lg" ? "w-32 h-32" : size === "md" ? "w-20 h-20" : "w-14 h-14"

  return (
    <div className={cn("relative inline-flex items-center justify-center", wh, className)}>
      <svg
        viewBox={`0 0 ${viewBox} ${viewBox}`}
        className="absolute inset-0 w-full h-full -rotate-90"
      >
        {/* Track */}
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeW}
          className="text-border"
        />
        {/* Progress */}
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      {showLabel && (
        <div className="flex flex-col items-center z-10">
          <span className={cn("font-bold leading-none tabular-nums", textSize, scoreColor(score))}>
            {score}
          </span>
          <span className={cn("text-muted-foreground font-medium leading-none mt-0.5", labelSize)}>
            ATS
          </span>
        </div>
      )}
    </div>
  )
}
