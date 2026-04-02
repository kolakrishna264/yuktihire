"use client"
import { AtsScoreRing } from "@/components/AtsScoreRing"
import { KeywordGrid } from "@/components/KeywordGrid"
import { Progress } from "@/components/ui/Progress"
import { scoreColor, scoreBg } from "@/lib/utils/format"
import type { AtsScore, JDAnalysis } from "@/types"
import { Lightbulb } from "lucide-react"

interface AtsScorePanelProps {
  atsScore: AtsScore
  jdAnalysis: JDAnalysis | null
  onInsertKeyword?: (kw: string, target: "skills" | "summary") => void
}

const SCORE_SECTIONS = [
  { key: "keywordScore", label: "Keywords" },
  { key: "skillsScore", label: "Skills" },
  { key: "experienceScore", label: "Experience" },
  { key: "educationScore", label: "Education" },
  { key: "formatScore", label: "Format" },
] as const

export function AtsScorePanel({ atsScore, jdAnalysis, onInsertKeyword }: AtsScorePanelProps) {
  return (
    <div className="space-y-5">
      {/* Score ring */}
      <div className="flex flex-col items-center py-3">
        <AtsScoreRing score={atsScore.overallScore} size="lg" />
        <p className="text-sm font-semibold mt-3">ATS Match Score</p>
        <p className={`text-xs font-medium ${scoreColor(atsScore.overallScore)}`}>
          {atsScore.overallScore >= 85
            ? "Excellent match"
            : atsScore.overallScore >= 70
            ? "Good match"
            : "Needs improvement"}
        </p>
      </div>

      {/* Breakdown */}
      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Score Breakdown
        </p>
        {SCORE_SECTIONS.map(({ key, label }) => {
          const score = atsScore[key]
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-semibold tabular-nums ${scoreColor(score)}`}>{score}%</span>
              </div>
              <Progress value={score} barClassName={scoreBg(score)} className="h-1.5" />
            </div>
          )
        })}
      </div>

      {/* Keywords */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Keyword Analysis
        </p>
        <KeywordGrid
          matched={atsScore.matchedKeywords}
          missing={atsScore.missingKeywords}
          maxShow={8}
          onInsertToSkills={onInsertKeyword ? (kw) => onInsertKeyword(kw, "skills") : undefined}
          onInsertToSummary={onInsertKeyword ? (kw) => onInsertKeyword(kw, "summary") : undefined}
        />
      </div>

      {/* Tips */}
      {atsScore.tips.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Recommendations
          </p>
          {atsScore.tips.map((tip, i) => (
            <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-accent/50">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
