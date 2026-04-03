"use client"

import { useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils/cn"
import { useProfile } from "@/lib/hooks/useProfile"
import { useResumes } from "@/lib/hooks/useResumes"
import { usePreferences } from "@/lib/hooks/usePreferences"
import { useTrackerKanban } from "@/lib/hooks/useTracker"
import {
  CheckCircle2,
  Circle,
  Upload,
  Settings2,
  Search,
  Bookmark,
  Chrome,
  ArrowRight,
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

  const hasResume = (resumes?.length ?? 0) > 0
  const hasProfile = (profile?.completeness ?? 0) >= 30
  const hasPreferences =
    !!prefs?.preferredTitles?.length ||
    !!prefs?.preferredSkills?.length ||
    !!prefs?.preferredWorkTypes?.length
  const hasTracked =
    Object.values(kanban?.stages ?? {}).reduce(
      (sum: number, s: any) => sum + (s?.count || 0),
      0
    ) > 0

  const steps: Step[] = useMemo(
    () => [
      {
        id: "resume",
        label: "Upload a resume",
        description: "We'll extract your profile automatically",
        href: "/dashboard/resumes",
        icon: Upload,
        check: () => hasResume,
      },
      {
        id: "preferences",
        label: "Set your preferences",
        description: "Tell us what you're looking for",
        href: "/dashboard/preferences",
        icon: Settings2,
        check: () => hasPreferences,
      },
      {
        id: "discover",
        label: "Discover jobs",
        description: "Browse and search real job listings",
        href: "/dashboard/discover",
        icon: Search,
        check: () => hasTracked,
      },
      {
        id: "save",
        label: "Save your first job",
        description: "Add a job to your tracker pipeline",
        href: "/dashboard/discover",
        icon: Bookmark,
        check: () => hasTracked,
      },
      {
        id: "extension",
        label: "Install the extension",
        description: "Save jobs from any website with one click",
        href: "/dashboard/extension",
        icon: Chrome,
        check: () => false, // Can't detect extension install
      },
    ],
    [hasResume, hasPreferences, hasTracked]
  )

  const completed = steps.filter((s) => s.check()).length
  const total = steps.length
  const pct = Math.round((completed / total) * 100)

  // Hide when mostly complete
  if (completed >= 4) return null

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
