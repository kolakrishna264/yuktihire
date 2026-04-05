"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Briefcase,
  FileText,
  Wand2,
  ArrowRight,
  Sparkles,
  ChromeIcon as Chrome,
  PlusCircle,
  Upload,
  MapPin,
  Globe,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Progress } from "@/components/ui/Progress"
import { useProfile } from "@/lib/hooks/useProfile"
import { useResumes } from "@/lib/hooks/useResumes"
import { useTailor } from "@/lib/hooks/useTailor"
import { useTrackerList } from "@/lib/hooks/useTracker"
import { OnboardingChecklist } from "@/components/OnboardingChecklist"
import { apiFetch } from "@/lib/api/client"
import type { User } from "@supabase/supabase-js"
import type { TrackedJob } from "@/types"

interface DashboardShellProps {
  user: User | null
}

export default function DashboardShell({ user }: DashboardShellProps) {
  const { data: profile } = useProfile()
  const { data: resumes, isLoading: resumesLoading } = useResumes()
  const { data: tailoringSessions = [] } = useTailor()
  const { data: trackedJobs = [], isLoading: jobsLoading } = useTrackerList()
  const [permissions, setPermissions] = useState<any>(null)
  const [autofillStats, setAutofillStats] = useState<any>(null)

  useEffect(() => {
    apiFetch("/permissions").then(setPermissions).catch(() => {})
    apiFetch("/extension/autofill-stats").then(setAutofillStats).catch(() => {})
  }, [])

  const name = user?.email?.split("@")[0] ?? "there"
  const resumeCount = resumes?.length ?? 0
  const jobsSaved = trackedJobs.length
  const resumesTailored = tailoringSessions.length
  const appliedStages = new Set(["APPLIED", "PHONE_SCREEN", "INTERVIEWING", "OFFER"])
  const applicationsSent = trackedJobs.filter(
    (j: TrackedJob) => appliedStages.has(j.pipelineStage)
  ).length

  const recentJobs = trackedJobs.slice(0, 5)

  // Determine onboarding state
  const isNewUser = !jobsLoading && !resumesLoading && jobsSaved === 0 && resumeCount === 0

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
          Good {getGreeting()},{" "}
          <span className="text-indigo-600">{name}</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1.5">
          Here&apos;s your job search at a glance
        </p>
      </div>

      {/* Onboarding Checklist for new users */}
      {isNewUser && <OnboardingChecklist />}

      {/* Readiness + Plan Card (for returning users) */}
      {!isNewUser && (
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {/* Autofill Readiness */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Autofill Readiness</p>
                <Link href="/dashboard/profile" className="text-xs text-primary hover:underline">Improve</Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Progress value={profile?.completeness ?? 0} className="h-2" />
                </div>
                <span className="text-sm font-bold text-primary">{profile?.completeness ?? 0}%</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {resumeCount > 0 ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Resume uploaded</span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600"><AlertCircle className="w-3 h-3" /> No resume</span>
                )}
                {autofillStats?.totalSessions > 0 ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600"><CheckCircle2 className="w-3 h-3" /> {autofillStats.totalFieldsFilled} fields filled</span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><AlertCircle className="w-3 h-3" /> No autofills yet</span>
                )}
                {autofillStats?.totalMemoryReused > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-indigo-600"><MessageSquare className="w-3 h-3" /> {autofillStats.totalMemoryReused} answers reused</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plan Badge */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Plan</p>
                {permissions?.isUnlimited ? (
                  <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">Unlimited</Badge>
                ) : (
                  <Link href="/dashboard/settings/billing">
                    <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-primary/10">Upgrade</Badge>
                  </Link>
                )}
              </div>
              <p className="text-lg font-bold">{permissions?.effectivePlan || permissions?.plan || "FREE"}</p>
              {permissions?.isAdmin && <Badge className="text-[9px] bg-primary/10 text-primary mt-1">Admin</Badge>}
              {autofillStats?.estimatedTimeSavedMin > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ~{autofillStats.estimatedTimeSavedMin} min saved with autofill
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link href="/dashboard/jobs" className="block group">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-gray-100">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
              {jobsLoading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-gray-900">{jobsSaved}</p>
              )}
              <p className="text-xs text-gray-500 font-medium mt-0.5">Jobs Saved</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/tailor" className="block group">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-gray-100">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-violet-600" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-gray-900">{resumesTailored}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Resumes Tailored</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/jobs" className="block group">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-gray-100">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-gray-900">{applicationsSent}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Applications Sent</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Quick Actions
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <QuickAction
            href="/dashboard/add-job"
            icon={PlusCircle}
            title="Add Job"
            description="Save a job from a URL or paste a description"
            accent
          />
          <QuickAction
            href="/dashboard/extension"
            icon={Chrome}
            title="Get Extension"
            description="Save jobs from any website with one click"
          />
          <QuickAction
            href="/dashboard/resumes"
            icon={Upload}
            title="Upload Resume"
            description="Add your resume to start tailoring"
          />
        </div>
      </div>

      {/* Recent Saved Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Recent Jobs
            </h2>
          </div>
          {recentJobs.length > 0 && (
            <Link
              href="/dashboard/jobs"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {jobsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : recentJobs.length > 0 ? (
          <div className="space-y-2">
            {recentJobs.map((job: TrackedJob) => (
              <Link
                key={job.id}
                href="/dashboard/jobs"
                className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {job.title}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{job.company}</span>
                      {job.location && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-2.5 h-2.5" />
                          {job.location}
                        </span>
                      )}
                      {job.source && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Globe className="w-2.5 h-2.5" />
                          {job.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      appliedStages.has(job.pipelineStage)
                        ? "default"
                        : job.resumeUsed
                        ? "success"
                        : "secondary"
                    }
                  >
                    {appliedStages.has(job.pipelineStage)
                      ? "Applied"
                      : job.resumeUsed
                      ? "Tailored"
                      : "Saved"}
                  </Badge>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6 text-indigo-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">No saved jobs yet</p>
            <p className="text-xs text-gray-400 mb-4">
              Save jobs from anywhere on the web using the extension or add them manually
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/dashboard/add-job">
                <Button size="sm" variant="outline">
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Job
                </Button>
              </Link>
              <Link href="/dashboard/extension">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Chrome className="w-3.5 h-3.5" />
                  Get Extension
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Beta Feedback + Help */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="grid sm:grid-cols-3 gap-3">
          <a href="mailto:support@yuktihire.com?subject=YuktiHire Feedback" className="block">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 transition-colors">
              <MessageSquare className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-700">Send Feedback</p>
                <p className="text-[10px] text-gray-400">Help us improve YuktiHire</p>
              </div>
            </div>
          </a>
          <Link href="/dashboard/extension" className="block">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 transition-colors">
              <Chrome className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-700">Get Extension</p>
                <p className="text-[10px] text-gray-400">Install guide + quick start</p>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
            <Globe className="w-4 h-4 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-700">YuktiHire Beta</p>
              <div className="flex gap-2 mt-0.5">
                <a href="/privacy" className="text-[10px] text-indigo-500 hover:underline">Privacy</a>
                <a href="mailto:support@yuktihire.com" className="text-[10px] text-indigo-500 hover:underline">Contact</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Sub-components ---- */

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
