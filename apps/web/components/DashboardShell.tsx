"use client"

import Link from "next/link"
import { FileText, Briefcase, Wand2, TrendingUp, ArrowRight } from "lucide-react"
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
const { data: usage } = useUsage()
const { data: tailoringSessions = [] } = useTailor()

const name = user?.email?.split("@")[0] ?? "there"

const resumeList = resumes?.resumes ?? []
const resumeCount = resumeList.length
const jobsCount = jobs.length
const tailoringCount = tailoringSessions.length

const tailoringUsed = tailoringCount
const tailoringMax = 3
const tailoringPct =
  tailoringMax > 0 ? Math.round((tailoringUsed / tailoringMax) * 100) : 0

const profileCompleteness = profile?.completeness ?? 0
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Good {getGreeting()}, {name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s what&apos;s happening with your job search
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Resumes"
          value={resumesLoading ? null : resumeCount}
          icon={FileText}
          href="/dashboard/resumes"
          color="text-blue-500"
        />
        <StatCard
          label="Applications"
          value={jobsCount}
          icon={Briefcase}
          href="/dashboard/jobs"
          color="text-purple-500"
        />
        <StatCard
          label="Tailoring Runs"
          value={tailoringCount}
          icon={Wand2}
          href="/dashboard/tailor"
          color="text-brand-500"
        />
        <StatCard
          label="Profile"
          value={profileLoading ? null : `${profileCompleteness}%`}
          icon={TrendingUp}
          href="/dashboard/profile"
          color="text-emerald-500"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Quick actions
          </h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <QuickAction
              href="/dashboard/tailor"
              icon={Wand2}
              title="Tailor Resume"
              description="AI-match your resume to a job"
              accent
            />
            <QuickAction
              href="/dashboard/resumes"
              icon={FileText}
              title="Edit Resume"
              description="Update your resume content"
            />
            <QuickAction
              href="/dashboard/jobs"
              icon={Briefcase}
              title="Track Applications"
              description="Update your job pipeline"
            />
            <QuickAction
              href="/dashboard/profile"
              icon={TrendingUp}
              title="Build Profile"
              description="Strengthen your career data"
            />
          </div>

          {resumeList.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Resumes
                </h2>
                <Link
                  href="/dashboard/resumes"
                  className="text-xs text-primary hover:underline"
                >
                  View all
                </Link>
              </div>

              <div className="space-y-2">
                {resumeList.slice(0, 3).map((r: any) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/resumes/${r.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{r.status}</Badge>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Current Plan</span>
                <Badge variant="default">Free</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tailoring runs</span>
                  <span>
                    {tailoringUsed} / {tailoringMax}
                  </span>
                </div>
                <Progress
                  value={tailoringPct}
                  barClassName={
                    tailoringPct >= 80 ? "bg-amber-500" : "bg-primary"
                  }
                />
              </div>

              <Link href="/dashboard/settings/billing">
                <Button variant="gradient" size="sm" className="w-full">
                  Upgrade to Pro
                </Button>
              </Link>
            </CardContent>
          </Card>

          {profile && profileCompleteness < 100 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Profile Strength</span>
                  <span className="text-sm font-bold text-primary">
                    {profileCompleteness}%
                  </span>
                </div>
                <Progress value={profileCompleteness} />
                <p className="text-xs text-muted-foreground">
                  A complete profile improves tailoring accuracy
                </p>
                <Link href="/dashboard/profile">
                  <Button variant="outline" size="sm" className="w-full">
                    Complete Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  color,
}: {
  label: string
  value: string | number | null
  icon: typeof FileText
  href: string
  color: string
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center ${color}`}
            >
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
          </div>

          {value === null ? (
            <Skeleton className="h-7 w-12 mb-1" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          )}

          <p className="text-xs text-muted-foreground font-medium">{label}</p>
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
    <Link href={href}>
      <div
        className={`
          group flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer
          ${
            accent
              ? "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50"
              : "border-border bg-card hover:bg-accent/50 hover:border-border/80"
          }
        `}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            accent ? "bg-primary/15" : "bg-accent"
          }`}
        >
          <Icon
            className={`w-4 h-4 ${
              accent ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </div>

        <div className="min-w-0">
          <p className={`text-sm font-semibold ${accent ? "text-primary" : ""}`}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto shrink-0 mt-1 transition-opacity" />
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