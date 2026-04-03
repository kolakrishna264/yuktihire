"use client"

import { useInsightsOverview, useInsightsPipeline, useInsightsActivity, useInsightsSkills, useInsightsIndustries, useInsightsLocations } from "@/lib/hooks/useInsights"
import { useUpcomingReminders } from "@/lib/hooks/useReminders"
import Link from "next/link"
import { BarChart3, Briefcase, Send, TrendingUp, Award, Bell, MapPin, Building2, Cpu } from "lucide-react"

/* ── tiny helpers ─────────────────────────────────────────────────────── */

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

const STAGE_COLORS: Record<string, string> = {
  INTERESTED: "bg-gray-400",
  SHORTLISTED: "bg-blue-500",
  RESUME_TAILORED: "bg-violet-500",
  APPLIED: "bg-indigo-500",
  INTERVIEWING: "bg-amber-500",
  OFFER: "bg-emerald-500",
  REJECTED: "bg-red-500",
}

const STAGE_LABELS: Record<string, string> = {
  INTERESTED: "Interested",
  SHORTLISTED: "Shortlisted",
  RESUME_TAILORED: "Resume Tailored",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return iso
  }
}

/* ── KPI card ─────────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

/* ── main page ────────────────────────────────────────────────────────── */

export default function InsightsPage() {
  const overview = useInsightsOverview()
  const pipeline = useInsightsPipeline()
  const activity = useInsightsActivity()
  const skills = useInsightsSkills()
  const industries = useInsightsIndustries()
  const locations = useInsightsLocations()
  const reminders = useUpcomingReminders()

  const ov = overview.data
  const isLoading = overview.isLoading

  /* empty state — everything zero */
  const allZero =
    ov &&
    ov.totalTracked === 0 &&
    ov.totalApplied === 0 &&
    ov.totalOffers === 0

  if (!isLoading && allZero) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
          <p className="text-sm text-gray-500 mt-1">Analytics from your job search</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-lg font-semibold text-gray-700 mb-1">No data yet</p>
          <p className="text-sm text-gray-400 max-w-sm mb-4">
            Start tracking jobs to see your insights
          </p>
          <Link
            href="/dashboard/discover"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Discover Jobs
          </Link>
        </div>
      </div>
    )
  }

  /* pipeline helpers */
  const pipelineData = pipeline.data ?? []
  const maxPipelineCount = Math.max(...pipelineData.map((p) => p.count), 1)

  /* activity helpers */
  const activityData = (activity.data ?? []).slice(-12)
  const maxActivity = Math.max(...activityData.map((a) => a.count), 1)

  /* skills helpers */
  const skillsData = (skills.data ?? []).slice(0, 10)
  const maxSkill = Math.max(...skillsData.map((s) => s.count), 1)

  /* industries / locations */
  const industriesData = (industries.data ?? []).slice(0, 8)
  const locData = locations.data

  /* reminders */
  const upcomingReminders = (reminders.data ?? []).slice(0, 5)

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="text-sm text-gray-500 mt-1">Analytics from your job search</p>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </>
        ) : (
          <>
            <KpiCard icon={Briefcase} label="Total Tracked" value={ov?.totalTracked ?? 0} color="bg-gray-100 text-gray-600" />
            <KpiCard icon={Send} label="Applied" value={ov?.totalApplied ?? 0} color="bg-indigo-50 text-indigo-600" />
            <KpiCard
              icon={TrendingUp}
              label="Response Rate"
              value={`${(ov?.responseRate ?? 0).toFixed(0)}%`}
              color={(ov?.responseRate ?? 0) > 20 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}
            />
            <KpiCard icon={Award} label="Offers" value={ov?.totalOffers ?? 0} color="bg-emerald-50 text-emerald-600" />
          </>
        )}
      </div>

      {/* ── Pipeline funnel ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Funnel</h2>
        {pipeline.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : pipelineData.length === 0 ? (
          <p className="text-sm text-gray-400">No pipeline data yet</p>
        ) : (
          <div className="space-y-3">
            {pipelineData.map((p) => {
              const pct = ((p.count / maxPipelineCount) * 100).toFixed(0)
              const total = pipelineData.reduce((s, x) => s + x.count, 0)
              const stagePct = total > 0 ? ((p.count / total) * 100).toFixed(0) : "0"
              return (
                <div key={p.stage} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-600 shrink-0">
                    {STAGE_LABELS[p.stage] ?? p.stage}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STAGE_COLORS[p.stage] ?? "bg-gray-400"} transition-all`}
                      style={{ width: `${(p.count / maxPipelineCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-sm font-medium text-gray-700 shrink-0">
                    {p.count} ({stagePct}%)
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Activity + Skills ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Applications per Week</h2>
          {activity.isLoading ? (
            <div className="flex items-end gap-2 h-40">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="flex-1 h-full" />
              ))}
            </div>
          ) : activityData.length === 0 ? (
            <p className="text-sm text-gray-400">No activity data yet</p>
          ) : (
            <div className="flex items-end gap-2 h-44">
              {activityData.map((w) => {
                const hPct = (w.count / maxActivity) * 100
                return (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-600">{w.count}</span>
                    <div className="w-full bg-gray-100 rounded-t flex flex-col justify-end" style={{ height: "8rem" }}>
                      <div
                        className="w-full bg-indigo-500 rounded-t transition-all"
                        style={{ height: `${Math.max(hPct, 2)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 truncate w-full text-center">{w.week}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Skills */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Requested Skills</h2>
          {skills.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : skillsData.length === 0 ? (
            <p className="text-sm text-gray-400">No skills data yet</p>
          ) : (
            <div className="space-y-3">
              {skillsData.map((s) => (
                <div key={s.skill}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{s.skill}</span>
                    <span className="text-gray-500">{s.count}</span>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${(s.count / maxSkill) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Industries + Locations ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industries */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Top Industries</h2>
          </div>
          {industries.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : industriesData.length === 0 ? (
            <p className="text-sm text-gray-400">No industry data yet</p>
          ) : (
            <ul className="space-y-2">
              {industriesData.map((ind, idx) => (
                <li key={ind.industry} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    <span className="text-gray-400 mr-2">{idx + 1}.</span>
                    {ind.industry}
                  </span>
                  <span className="font-medium text-gray-600">{ind.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Locations */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Top Locations</h2>
          </div>
          {locations.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : !locData ? (
            <p className="text-sm text-gray-400">No location data yet</p>
          ) : (
            <>
              {locData.remoteRatio > 0 && (
                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium">
                  <Cpu className="w-4 h-4" />
                  Remote ratio: {(locData.remoteRatio * 100).toFixed(0)}%
                </div>
              )}
              <ul className="space-y-2">
                {locData.topLocations.slice(0, 8).map((loc, idx) => (
                  <li key={loc.location} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      <span className="text-gray-400 mr-2">{idx + 1}.</span>
                      {loc.location}
                    </span>
                    <span className="font-medium text-gray-600">{loc.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ── Upcoming Reminders ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Reminders</h2>
        </div>
        {reminders.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : upcomingReminders.length === 0 ? (
          <p className="text-sm text-gray-400">No upcoming reminders</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcomingReminders.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.title}</p>
                  {r.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0 ml-4">{fmtDate(r.remindAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
