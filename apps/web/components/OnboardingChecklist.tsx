"use client"

import { useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils/cn"
import { useProfile } from "@/lib/hooks/useProfile"
import { useResumes } from "@/lib/hooks/useResumes"
import { usePreferences } from "@/lib/hooks/usePreferences"
import { useTrackerKanban } from "@/lib/hooks/useTracker"
import { useTailor } from "@/lib/hooks/useTailor"
import {
  CheckCircle2,
  Circle,
  Upload,
  Settings2,
  Search,
  Bookmark,
  Chrome,
  ArrowRight,
  Wand2,
} from "lucide-react"

interface Step {
  id: string
  label: string
  description: string
  href: string
  icon: typeof Upload
  check: () => boolean
}

export function OnboardingChecklist() {
  const { data: profile } = useProfile()
  const { data: resumes } = useResumes()
  const { data: prefs } = usePreferences()
  const { data: kanban } = useTrackerKanban()
  const { data: tailorSessions } = useTailor()

  const hasResume = (resumes?.length ?? 0) > 0
  const hasTailored = (tailorSessions?.length ?? 0) > 0
  const hasProfile = (profile?.completeness ?? 0) >= 30
  const hasPreferences = !!(
    (prefs?.preferredTitles && prefs.preferredTitles.length > 0) ||
    (prefs?.preferredSkills && prefs.preferredSkills.length > 0) ||
    (prefs?.preferredLocations && prefs.preferredLocations.length > 0) ||
    (prefs?.preferredWorkTypes && prefs.preferredWorkTypes.length > 0)
  )
  const hasTracked =
    Object.values(kanban?.stages ?? {}).reduce(
      (sum: number, s: any) => sum + (s?.count || 0),
      0
    ) > 0

  // Check work auth is set
  const hasWorkAuth = !!(prefs as any)?.applicationInfo?.workAuthType

  const steps: Step[] = useMemo(
    () => [
      {
        id: "resume",
        label: "Upload your resume",
        description: hasResume ? "Resume uploaded" : "We'll auto-build your profile from it",
        href: "/dashboard/profile",
        icon: Upload,
        check: () => hasResume,
      },
      {
        id: "profile",
        label: "Complete your profile",
        description: hasProfile ? "Profile ready" : "Review extracted info and fill gaps",
        href: "/dashboard/profile",
        icon: Settings2,
        check: () => hasProfile,
      },
      {
        id: "workauth",
        label: "Set work authorization",
        description: hasWorkAuth ? "Authorization set" : "Required for accurate autofill",
        href: "/dashboard/profile",
        icon: Settings2,
        check: () => hasWorkAuth,
      },
      {
        id: "extension",
        label: "Install the Chrome extension",
        description: "Save jobs and autofill applications from any site",
        href: "/dashboard/extension",
        icon: Chrome,
        check: () => false,
      },
      {
        id: "save",
        label: "Save your first job",
        description: hasTracked ? "Jobs saved" : "Browse or use extension to save jobs",
        href: "/dashboard/feed",
        icon: Bookmark,
        check: () => hasTracked,
      },
      {
        id: "tailor",
        label: "Tailor a resume",
        description: hasTailored ? "Resume tailored" : "AI-optimize your resume for a job",
        href: "/dashboard/tailor",
        icon: Wand2,
        check: () => hasTailored,
      },
    ],
    [hasResume, hasProfile, hasWorkAuth, hasTracked, hasTailored]
  )

  const completed = steps.filter((s) => s.check()).length
  const total = steps.length
  const pct = Math.round((completed / total) * 100)

  // Hide when mostly complete (5+ of 6 steps done)
  if (completed >= 5) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800">
            Get started with YuktiHire
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {completed} of {total} steps completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-indigo-600">{pct}%</span>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => {
          const done = step.check()
          const Icon = step.icon
          return (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all group",
                done
                  ? "bg-emerald-50/50"
                  : "hover:bg-gray-50"
              )}
            >
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-gray-300 shrink-0" />
              )}
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  done ? "text-emerald-400" : "text-gray-400"
                )}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    done
                      ? "text-emerald-700 line-through"
                      : "text-gray-700"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-[11px] text-gray-400">{step.description}</p>
              </div>
              {!done && (
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
