"use client"

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

interface DashboardShellProps {
  user: User | null
}

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
        <StatCard
          label="Applications"
          value={jobsCount}
          icon={Briefcase}
          href="/dashboard/jobs"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          trend="Active tracking"
        />
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
        {/* Left col: Quick Actions + Recent Resumes */}
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
        </div>

        {/* Right col: Plan + Profile Strength */}
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

          {/* Tips card */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-4">
            <p className="text-xs font-semibold text-indigo-700 mb-1">Pro tip</p>
            <p className="text-xs text-indigo-600 leading-relaxed">
              Tailor your resume for each job posting to increase your ATS match score by up to 3x.
            </p>
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

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 18) return "afternoon"
  return "evening"
}
