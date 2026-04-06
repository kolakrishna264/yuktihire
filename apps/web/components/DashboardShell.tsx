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
  Zap,
  TrendingUp,
  Clock,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Progress } from "@/components/ui/Progress"
import { GradientStat } from "@/components/ui/GradientStat"
import { HeroBanner } from "@/components/ui/HeroBanner"
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
  const interviewingCount = trackedJobs.filter(
    (j: TrackedJob) => j.pipelineStage === "INTERVIEWING"
  ).length

  const recentJobs = trackedJobs.slice(0, 5)
  const isNewUser = !jobsLoading && !resumesLoading && jobsSaved === 0 && resumeCount === 0
  const timeSaved = autofillStats?.estimatedTimeSavedMin ?? 0
  const fieldsFilled = autofillStats?.totalFieldsFilled ?? 0
  const answersReused = autofillStats?.totalMemoryReused ?? 0

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">

      {/* ── Top Banner ────────────────────────────────────────────────── */}
      <HeroBanner
        eyebrow={timeSaved > 0 ? `Saving you ~${timeSaved} min per application` : "Welcome to YuktiHire"}
        title={
          <>
            Good {getGreeting()},{" "}
            <span className="text-white/90">{name}</span>
          </>
        }
        subtitle="Here's your job search at a glance. Every application, tailored and tracked."
        actions={
          <div className="flex gap-2.5">
            <Link href="/dashboard/tailor">
              <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm">
                <Wand2 className="w-3.5 h-3.5" />
                Tailor Resume
              </Button>
            </Link>
            <Link href="/dashboard/add-job">
              <Button size="sm" className="bg-white/15 hover:bg-white/25 text-white border-0 backdrop-blur-sm">
                <PlusCircle className="w-3.5 h-3.5" />
                Add Job
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── Onboarding (new users) ────────────────────────────────────── */}
      {isNewUser && <OnboardingChecklist />}

      {/* ── Gradient Stats Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GradientStat
          icon={Briefcase}
          value={jobsLoading ? "..." : jobsSaved}
          label="Jobs Saved"
          gradient="gradient-card-indigo"
          iconColor="text-indigo-600"
          trend={jobsSaved > 0 ? `${jobsSaved} tracked` : undefined}
          trendUp
        />
        <GradientStat
          icon={Wand2}
          value={resumesTailored}
          label="Resumes Tailored"
          gradient="gradient-card-violet"
          iconColor="text-violet-600"
        />
        <GradientStat
          icon={Target}
          value={applicationsSent}
          label="Applications Sent"
          gradient="gradient-card-emerald"
          iconColor="text-emerald-600"
          trend={interviewingCount > 0 ? `${interviewingCount} interviewing` : undefined}
          trendUp
        />
        <GradientStat
          icon={Zap}
          value={fieldsFilled > 0 ? fieldsFilled : "0"}
          label="Fields Autofilled"
          gradient="gradient-card-amber"
          iconColor="text-amber-600"
          trend={answersReused > 0 ? `${answersReused} answers reused` : undefined}
          trendUp
        />
      </div>

      {/* ── Readiness + Plan (returning users) ────────────────────────── */}
      {!isNewUser && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Autofill Readiness */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg gradient-card-indigo flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-sm font-bold text-gray-900">Autofill Readiness</p>
              </div>
              <Link href="/dashboard/profile" className="text-xs text-indigo-600 hover:underline font-medium">Improve</Link>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <Progress value={profile?.completeness ?? 0} className="h-2.5" />
              </div>
              <span className="text-sm font-bold text-indigo-600">{profile?.completeness ?? 0}%</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {resumeCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle2 className="w-3 h-3" /> Resume uploaded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  <AlertCircle className="w-3 h-3" /> No resume
                </span>
              )}
              {autofillStats?.totalSessions > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle2 className="w-3 h-3" /> {autofillStats.totalFieldsFilled} fields filled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-100">
                  <AlertCircle className="w-3 h-3" /> No autofills yet
                </span>
              )}
              {answersReused > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <MessageSquare className="w-3 h-3" /> {answersReused} answers reused
                </span>
              )}
            </div>
          </div>

          {/* Plan Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg gradient-card-violet flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                </div>
                <p className="text-sm font-bold text-gray-900">Your Plan</p>
              </div>
              {permissions?.isUnlimited ? (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px]">Unlimited</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Beta</Badge>
              )}
            </div>
            <p className="text-xl font-bold text-gray-900 mb-1">{permissions?.effectivePlan || permissions?.plan || "FREE"}</p>
            {permissions?.isAdmin && <Badge className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 mt-1">Admin</Badge>}
            {timeSaved > 0 && (
              <div className="flex items-center gap-1.5 mt-3">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <p className="text-xs text-gray-500">~{timeSaved} min saved with autofill</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quick Actions</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <QuickAction
            href="/dashboard/add-job"
            icon={PlusCircle}
            title="Add Job"
            description="Save a job from a URL or paste a description"
            gradient="gradient-card-indigo"
            iconColor="text-indigo-600"
            accent
          />
          <QuickAction
            href="/dashboard/extension"
            icon={Chrome}
            title="Get Extension"
            description="Save jobs from any website with one click"
            gradient="gradient-card-emerald"
            iconColor="text-emerald-600"
          />
          <QuickAction
            href="/dashboard/resumes"
            icon={Upload}
            title="Upload Resume"
            description="Add your resume to start tailoring"
            gradient="gradient-card-violet"
            iconColor="text-violet-600"
          />
        </div>
      </div>

      {/* ── Recent Jobs ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-500" />
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Jobs</h2>
          </div>
          {recentJobs.length > 0 && (
            <Link href="/dashboard/jobs" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
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
              <Link key={job.id} href="/dashboard/jobs"
                className="group flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50 transition-all duration-200">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl gradient-card-indigo flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Briefcase className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{job.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{job.company}</span>
                      {job.location && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-2.5 h-2.5" />{job.location}
                        </span>
                      )}
                      {job.source && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Globe className="w-2.5 h-2.5" />{job.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={appliedStages.has(job.pipelineStage) ? "default" : job.resumeUsed ? "success" : "secondary"}>
                    {appliedStages.has(job.pipelineStage) ? "Applied" : job.resumeUsed ? "Tailored" : "Saved"}
                  </Badge>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center bg-gray-50/50">
            <div className="w-14 h-14 rounded-2xl gradient-card-indigo flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-7 h-7 text-indigo-500" />
            </div>
            <p className="text-sm font-bold text-gray-700 mb-1">No saved jobs yet</p>
            <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
              Save jobs from anywhere on the web using the extension or add them manually
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/dashboard/add-job">
                <Button size="sm" variant="outline">
                  <PlusCircle className="w-3.5 h-3.5" /> Add Job
                </Button>
              </Link>
              <Link href="/dashboard/extension">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Chrome className="w-3.5 h-3.5" /> Get Extension
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer links ──────────────────────────────────────────────── */}
      <div className="pt-6 border-t border-gray-100">
        <div className="grid sm:grid-cols-3 gap-3">
          <a href="mailto:support@yuktihire.com?subject=YuktiHire Feedback" className="block">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className="w-8 h-8 rounded-lg gradient-card-violet flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Send Feedback</p>
                <p className="text-[10px] text-gray-400">Help us improve YuktiHire</p>
              </div>
            </div>
          </a>
          <Link href="/dashboard/extension" className="block">
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className="w-8 h-8 rounded-lg gradient-card-emerald flex items-center justify-center shrink-0">
                <Chrome className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Get Extension</p>
                <p className="text-[10px] text-gray-400">Install guide + quick start</p>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-white">
            <div className="w-8 h-8 rounded-lg gradient-card-indigo flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-700">YuktiHire Beta</p>
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
  gradient = "gradient-card-indigo",
  iconColor = "text-indigo-600",
  accent,
}: {
  href: string
  icon: typeof FileText
  title: string
  description: string
  gradient?: string
  iconColor?: string
  accent?: boolean
}) {
  return (
    <Link href={href} className="block">
      <div className={`group flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer
        ${accent
          ? "border-indigo-200/60 bg-indigo-50/30 hover:bg-indigo-50/60 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50"
          : "border-gray-100 bg-white hover:bg-gray-50/50 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50"
        } hover:-translate-y-0.5`}
      >
        <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${accent ? "text-indigo-700" : "text-gray-800"}`}>{title}</p>
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
