"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  FileText,
  Briefcase,
  Wand2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  BarChart3,
  ChevronUp,
  Zap,
  Target,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Progress } from "@/components/ui/Progress"
import { useProfile } from "@/lib/hooks/useProfile"
import { useResumes } from "@/lib/hooks/useResumes"
import { useAllJobs } from "@/lib/hooks/useJobs"
import { useTailor } from "@/lib/hooks/useTailor"
import { useUsage } from "@/lib/hooks/useBilling"
import type { User } from "@supabase/supabase-js"
import type { TailoringSessionMeta, ApplicationStatus } from "@/types"

interface DashboardShellProps {
  user: User | null
}

// ── Pipeline stages in display order ──────────────────────────────────────
const PIPELINE_STAGES: {
  status: ApplicationStatus
  label: string
  color: string
  barColor: string
  dotColor: string
}[] = [
  {
    status: "APPLIED",
    label: "Applied",
    color: "text-blue-600",
    barColor: "bg-blue-500",
    dotColor: "bg-blue-400",
  },
  {
    status: "INTERVIEWING",
    label: "Interviewing",
    color: "text-violet-600",
    barColor: "bg-violet-500",
    dotColor: "bg-violet-400",
  },
  {
    status: "OFFER",
    label: "Offer",
    color: "text-emerald-600",
    barColor: "bg-emerald-500",
    dotColor: "bg-emerald-400",
  },
  {
    status: "REJECTED",
    label: "Rejected",
    color: "text-red-500",
    barColor: "bg-red-400",
    dotColor: "bg-red-400",
  },
  {
    status: "SAVED",
    label: "Saved",
    color: "text-gray-500",
    barColor: "bg-gray-300",
    dotColor: "bg-gray-300",
  },
]

// ── Rotating pro tips ──────────────────────────────────────────────────────
const PRO_TIPS = [
  "Tailor your resume for each job posting to increase your ATS match score by up to 3x.",
  "Keep your work experience bullets achievement-focused — use numbers wherever possible.",
  "Add a strong summary section that mirrors the keywords in the job description.",
  "Follow up with a thank-you email within 24 hours of every interview to stand out.",
]

export default function DashboardShell({ user }: DashboardShellProps) {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: resumes, isLoading: resumesLoading } = useResumes()
  const { data: jobs = [] } = useAllJobs()
  useUsage()
  const { data: tailoringSessions = [] } = useTailor()

  const name = user?.email?.split("@")[0] ?? "there"
  const resumeList = resumes ?? []
  const resumeCount = resumeList.length
  const jobsCount = jobs.length
  const tailoringCount = tailoringSessions.length
  const tailoringUsed = tailoringCount
  const tailoringMax = 3
  const tailoringPct =
    tailoringMax > 0 ? Math.round((tailoringUsed / tailoringMax) * 100) : 0
  const profileCompleteness = profile?.completeness ?? 0

  // ── ATS average score ────────────────────────────────────────────────────
  const scoredSessions = (tailoringSessions as TailoringSessionMeta[]).filter(
    (s) => s.matchScore !== null && s.matchScore !== undefined
  )
  const avgAtsScore =
    scoredSessions.length > 0
      ? Math.round(
          scoredSessions.reduce((sum, s) => sum + (s.matchScore ?? 0), 0) /
            scoredSessions.length
        )
      : null

  // ── Pipeline counts ──────────────────────────────────────────────────────
  const pipelineCounts = jobs.reduce<Record<ApplicationStatus, number>>(
    (acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1
      return acc
    },
    {} as Record<ApplicationStatus, number>
  )
  const pipelineMax = Math.max(1, ...Object.values(pipelineCounts))

  // ── Status dot colors for Applications stat card ─────────────────────────
  const activePipelineStages = PIPELINE_STAGES.filter(
    (s) => (pipelineCounts[s.status] ?? 0) > 0
  )

  // ── Rotating tip ─────────────────────────────────────────────────────────
  const [tipIndex, setTipIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(
      () => setTipIndex((i) => (i + 1) % PRO_TIPS.length),
      5000
    )
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
          Good {getGreeting()},{" "}
          <span className="text-indigo-600">{name}</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1.5">
          Here&apos;s an overview of your job search activity
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Resumes"
          value={resumesLoading ? null : resumeCount}
          icon={FileText}
          href="/dashboard/resumes"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          trend="+2 this week"
          trendUp
        />

        {/* Applications card with pipeline dots */}
        <Link href="/dashboard/jobs" className="block group">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-gray-100 h-full">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  Active tracking
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {jobsCount}
              </p>
              <p className="text-xs text-gray-500 font-medium mt-0.5 mb-2">
                Applications
              </p>
              {/* Mini pipeline dots */}
              {activePipelineStages.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {activePipelineStages.map((stage) => (
                    <span
                      key={stage.status}
                      className={`inline-flex items-center gap-1 text-[10px] font-medium ${stage.color}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${stage.dotColor} shrink-0`}
                      />
                      {pipelineCounts[stage.status]}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <StatCard
          label="Tailoring Runs"
          value={tailoringCount}
          icon={Wand2}
          href="/dashboard/tailor"
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          trend={`${tailoringMax - tailoringUsed} remaining`}
        />
        <StatCard
          label="Profile"
          value={profileLoading ? null : `${profileCompleteness}%`}
          icon={TrendingUp}
          href="/dashboard/profile"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          trend={profileCompleteness >= 80 ? "Looking strong" : "Needs attention"}
          trendUp={profileCompleteness >= 80}
        />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left col: Quick Actions + Recent Resumes + Recent Tailoring */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Quick Actions
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <QuickAction
                href="/dashboard/tailor"
                icon={Wand2}
                title="Tailor Resume"
                description="AI-match your resume to a job description"
                accent
              />
              <QuickAction
                href="/dashboard/resumes"
                icon={FileText}
                title="Edit Resume"
                description="Update your resume content and layout"
              />
              <QuickAction
                href="/dashboard/jobs"
                icon={Briefcase}
                title="Track Applications"
                description="Manage your job application pipeline"
              />
              <QuickAction
                href="/dashboard/profile"
                icon={TrendingUp}
                title="Build Profile"
                description="Strengthen your career data for better matches"
              />
            </div>
          </div>

          {/* Recent Resumes */}
          {resumesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : resumeList.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Recent Resumes
                  </h2>
                </div>
                <Link
                  href="/dashboard/resumes"
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  View all
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                {resumeList.slice(0, 3).map((r: any) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/resumes/${r.id}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                        <p className="text-xs text-gray-400">Last edited recently</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {r.status}
                      </Badge>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-indigo-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">No resumes yet</p>
              <p className="text-xs text-gray-400 mb-4">
                Upload or create your first resume to get started
              </p>
              <Link href="/dashboard/resumes">
                <Button size="sm" variant="outline">
                  Add Resume
                </Button>
              </Link>
            </div>
          )}

          {/* Recent Tailoring */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-indigo-500" />
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  Recent Tailoring
                </h2>
              </div>
              {tailoringSessions.length > 0 && (
                <Link
                  href="/dashboard/tailor"
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  View all
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>

            {tailoringSessions.length > 0 ? (
              <div className="space-y-2">
                {(tailoringSessions as TailoringSessionMeta[])
                  .slice(0, 3)
                  .map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <Wand2 className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <AtsScoreBadge score={session.matchScore} />
                            <SessionStatusBadge status={session.status} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(session.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/dashboard/tailor"
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
                      >
                        View
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                  <Wand2 className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  No tailoring sessions yet
                </p>
                <p className="text-xs text-gray-400 mb-3">
                  Tailor your resume to a job posting to boost your ATS score
                </p>
                <Link href="/dashboard/tailor">
                  <Button size="sm" variant="outline">
                    Start Tailoring
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right col: Plan + ATS Score + Profile Strength + Pipeline + Tips */}
        <div className="space-y-4">
          {/* Plan & Usage */}
          <Card className="overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-bold text-gray-800">Plan &amp; Usage</span>
                </div>
                <Badge variant="default" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                  Free
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500">Tailoring runs</span>
                  <span className="text-xs font-bold text-gray-700">
                    {tailoringUsed}
                    <span className="font-normal text-gray-400"> / {tailoringMax}</span>
                  </span>
                </div>
                <Progress
                  value={tailoringPct}
                  className="h-2"
                  barClassName={tailoringPct >= 80 ? "bg-amber-500" : "bg-indigo-500"}
                />
                {tailoringPct >= 80 && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    Almost at your limit — consider upgrading
                  </p>
                )}
              </div>

              <div className="pt-1">
                <Link href="/dashboard/settings/billing">
                  <Button
                    variant="gradient"
                    size="sm"
                    className="w-full font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Upgrade to Pro
                  </Button>
                </Link>
                <p className="text-[11px] text-center text-gray-400 mt-2">
                  Unlimited runs · ATS scanner · Priority support
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ATS Average Score */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-bold text-gray-800">Avg ATS Score</span>
              </div>

              {scoredSessions.length === 0 ? (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-400">
                    No scored sessions yet
                  </p>
                  <Link
                    href="/dashboard/tailor"
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold mt-1 inline-block"
                  >
                    Run your first tailor
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Colored ring indicator */}
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 border-4 ${
                      avgAtsScore !== null && avgAtsScore >= 70
                        ? "border-emerald-400 bg-emerald-50"
                        : avgAtsScore !== null && avgAtsScore >= 50
                        ? "border-amber-400 bg-amber-50"
                        : "border-red-400 bg-red-50"
                    }`}
                  >
                    <span
                      className={`text-base font-bold tabular-nums ${
                        avgAtsScore !== null && avgAtsScore >= 70
                          ? "text-emerald-700"
                          : avgAtsScore !== null && avgAtsScore >= 50
                          ? "text-amber-700"
                          : "text-red-700"
                      }`}
                    >
                      {avgAtsScore ?? "—"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">
                      {avgAtsScore !== null && avgAtsScore >= 70
                        ? "Strong match"
                        : avgAtsScore !== null && avgAtsScore >= 50
                        ? "Room to improve"
                        : "Needs work"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      from {scoredSessions.length} session
                      {scoredSessions.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Strength */}
          {(profile || profileLoading) && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">Profile Strength</span>
                  {profileLoading ? (
                    <Skeleton className="h-5 w-10" />
                  ) : (
                    <span
                      className={`text-sm font-bold ${
                        profileCompleteness >= 80
                          ? "text-emerald-600"
                          : profileCompleteness >= 50
                          ? "text-amber-500"
                          : "text-red-500"
                      }`}
                    >
                      {profileCompleteness}%
                    </span>
                  )}
                </div>

                {profileLoading ? (
                  <Skeleton className="h-2 w-full rounded-full" />
                ) : (
                  <Progress
                    value={profileCompleteness}
                    className="h-2"
                    barClassName={
                      profileCompleteness >= 80
                        ? "bg-emerald-500"
                        : profileCompleteness >= 50
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }
                  />
                )}

                <p className="text-xs text-gray-400 leading-relaxed">
                  {profileCompleteness < 100
                    ? "A complete profile helps AI tailor your resume more accurately."
                    : "Your profile is complete — great job!"}
                </p>

                {!profileLoading && profileCompleteness < 100 && (
                  <Link href="/dashboard/profile">
                    <Button variant="outline" size="sm" className="w-full">
                      <ChevronUp className="w-3.5 h-3.5 mr-1" />
                      Complete Profile
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Application Pipeline Chart */}
          {jobsCount > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-bold text-gray-800">
                    Pipeline
                  </span>
                </div>
                <div className="space-y-2.5">
                  {PIPELINE_STAGES.filter(
                    (s) => (pipelineCounts[s.status] ?? 0) > 0
                  ).map((stage) => {
                    const count = pipelineCounts[stage.status] ?? 0
                    const pct = Math.round((count / pipelineMax) * 100)
                    return (
                      <div key={stage.status}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[11px] font-semibold ${stage.color}`}>
                            {stage.label}
                          </span>
                          <span className="text-[11px] font-bold text-gray-600 tabular-nums">
                            {count}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${stage.barColor} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Link
                  href="/dashboard/jobs"
                  className="mt-3 text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  Manage applications
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Rotating Pro Tips */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-4 min-h-[80px]">
            <p className="text-xs font-semibold text-indigo-700 mb-1">Pro tip</p>
            <p
              key={tipIndex}
              className="text-xs text-indigo-600 leading-relaxed transition-opacity duration-500"
            >
              {PRO_TIPS[tipIndex]}
            </p>
            {/* Dot indicators */}
            <div className="flex items-center gap-1 mt-2">
              {PRO_TIPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTipIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === tipIndex ? "bg-indigo-500" : "bg-indigo-200"
                  }`}
                  aria-label={`Tip ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Sub-components ---- */

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  iconBg,
  iconColor,
  trend,
  trendUp,
}: {
  label: string
  value: string | number | null
  icon: typeof FileText
  href: string
  iconBg: string
  iconColor: string
  trend?: string
  trendUp?: boolean
}) {
  return (
    <Link href={href} className="block group">
      <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-gray-100">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div
              className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}
            >
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            {trend && (
              <div
                className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  trendUp
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {trendUp && <ChevronUp className="w-2.5 h-2.5" />}
                {trend}
              </div>
            )}
          </div>

          {value === null ? (
            <Skeleton className="h-8 w-12 mb-1" />
          ) : (
            <p className="text-2xl font-bold tabular-nums text-gray-900">{value}</p>
          )}
          <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string
  icon: typeof FileText
  title: string
  description: string
  accent?: boolean
}) {
  return (
    <Link href={href} className="block">
      <div
        className={`
          group flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer
          ${
            accent
              ? "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-sm"
              : "border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm"
          }
        `}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            accent ? "bg-indigo-100" : "bg-gray-100 group-hover:bg-gray-200"
          } transition-colors`}
        >
          <Icon
            className={`w-4 h-4 ${accent ? "text-indigo-600" : "text-gray-500"}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${
              accent ? "text-indigo-700" : "text-gray-800"
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
        </div>

        <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 shrink-0 mt-1 transition-all group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

function AtsScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <Badge variant="secondary" className="text-[10px] font-semibold">
        No score
      </Badge>
    )
  }
  const colorClass =
    score >= 70
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score >= 50
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-red-100 text-red-700 border-red-200"
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}
    >
      ATS {score}
    </span>
  )
}

function SessionStatusBadge({ status }: { status: TailoringSessionMeta["status"] }) {
  const map: Record<
    TailoringSessionMeta["status"],
    { label: string; className: string }
  > = {
    COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
    PENDING: { label: "Pending", className: "bg-gray-100 text-gray-500" },
    RUNNING: { label: "Running", className: "bg-blue-50 text-blue-600" },
    FAILED: { label: "Failed", className: "bg-red-50 text-red-600" },
    PARTIAL: { label: "Partial", className: "bg-amber-50 text-amber-600" },
  }
  const { label, className } = map[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-500",
  }
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${className}`}
    >
      {label}
    </span>
  )
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 18) return "afternoon"
  return "evening"
}
