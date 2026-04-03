"use client"

import { useState, useMemo } from "react"
import { useAllJobs, useUpdateJob, useDeleteJob } from "@/lib/hooks/useJobs"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { cn } from "@/lib/utils/cn"
import {
  ChevronRight,
  Download,
  ExternalLink,
  Search,
  Briefcase,
  Trash2,
  Calendar,
} from "lucide-react"
import Link from "next/link"
import type { JobApplication, ApplicationStatus } from "@/types"
import { toast } from "sonner"

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: "ALL" | ApplicationStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SAVED", label: "Saved" },
  { value: "APPLIED", label: "Applied" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offers" },
  { value: "REJECTED", label: "Rejected" },
]

const STATUS_BADGE: Record<
  ApplicationStatus,
  "secondary" | "default" | "warning" | "success" | "danger"
> = {
  SAVED: "secondary",
  APPLIED: "default",
  PHONE_SCREEN: "default",
  INTERVIEWING: "warning",
  OFFER: "success",
  REJECTED: "danger",
  WITHDRAWN: "secondary",
}

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "SAVED", label: "Saved" },
  { value: "APPLIED", label: "Applied" },
  { value: "PHONE_SCREEN", label: "Phone Screen" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offer" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return "—"
  }
}

function statusLabel(status: ApplicationStatus): string {
  const map: Record<ApplicationStatus, string> = {
    SAVED: "Saved",
    APPLIED: "Applied",
    PHONE_SCREEN: "Phone Screen",
    INTERVIEWING: "Interviewing",
    OFFER: "Offer",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
  }
  return map[status] ?? status
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AppliedPage() {
  const { data: jobs = [], isLoading } = useAllJobs()
  const updateJob = useUpdateJob()
  const deleteJob = useDeleteJob()

  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [activeTab, setActiveTab] = useState<"ALL" | ApplicationStatus>("ALL")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Counts per status (for pill badges) ────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: jobs.length }
    for (const j of jobs) {
      counts[j.status] = (counts[j.status] || 0) + 1
    }
    return counts
  }, [jobs])

  // ── Filtered jobs ──────────────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    let filtered = [...jobs]

    // Status tab filter
    if (activeTab !== "ALL") {
      filtered = filtered.filter((j) => j.status === activeTab)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (j) =>
          j.company.toLowerCase().includes(q) ||
          j.title.toLowerCase().includes(q)
      )
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter((j) => {
        const d = new Date(j.appliedAt ?? j.createdAt)
        return d >= from
      })
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      filtered = filtered.filter((j) => {
        const d = new Date(j.appliedAt ?? j.createdAt)
        return d <= to
      })
    }

    return filtered
  }, [jobs, search, dateFrom, dateTo, activeTab])

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id))

  const handleStatusChange = (job: JobApplication, newStatus: ApplicationStatus) => {
    if (newStatus === job.status) return
    updateJob.mutate(
      { id: job.id, data: { status: newStatus } as Partial<JobApplication> },
      { onSuccess: () => toast.success(`Status updated to ${statusLabel(newStatus)}`) }
    )
  }

  const handleDelete = (job: JobApplication) => {
    if (!confirm(`Delete "${job.title}" at ${job.company}?`)) return
    deleteJob.mutate(job.id, {
      onSuccess: () => {
        toast.success("Job deleted")
        if (expandedId === job.id) setExpandedId(null)
      },
    })
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 flex-1 max-w-sm" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <Skeleton className="h-12 w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state (no jobs at all) ───────────────────────────────────────────
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <Briefcase className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          No tracked jobs yet
        </h2>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Browse the Job Board to find and save jobs.
        </p>
        <Link href="/dashboard/job-board">
          <Button>Browse Job Board</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Applied</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} tracked
        </p>
      </div>

      {/* ── Status filter pills ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count = statusCounts[tab.value] ?? 0
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab.label} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Search & date filters ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or title..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Search className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-500">No jobs match your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[40px_1.2fr_1.5fr_100px_90px_100px_80px] gap-2 px-4 py-3 bg-indigo-50 rounded-t-xl text-xs font-bold text-gray-600 uppercase tracking-wide">
            <span />
            <span>Company</span>
            <span>Job Title</span>
            <span>Status</span>
            <span>Applied</span>
            <span>Resume</span>
            <span>Link</span>
          </div>

          {/* Rows */}
          {filteredJobs.map((job) => {
            const isExpanded = expandedId === job.id
            return (
              <div key={job.id}>
                {/* Main row */}
                <button
                  onClick={() => toggleExpand(job.id)}
                  className={cn(
                    "w-full grid grid-cols-[40px_1.2fr_1.5fr_100px_90px_100px_80px] gap-2 px-4 py-3 items-center text-left border-b border-gray-50 transition-colors cursor-pointer",
                    "hover:bg-gray-50/50",
                    isExpanded && "bg-gray-50/30"
                  )}
                >
                  {/* Chevron */}
                  <span className="flex items-center justify-center">
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-gray-400 transition-transform duration-200",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </span>

                  {/* Company */}
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {job.company}
                  </span>

                  {/* Title */}
                  <span className="text-sm text-gray-600 truncate">
                    {job.title}
                  </span>

                  {/* Status badge */}
                  <span onClick={(e) => e.stopPropagation()}>
                    <Badge variant={STATUS_BADGE[job.status]}>
                      {statusLabel(job.status)}
                    </Badge>
                  </span>

                  {/* Applied date */}
                  <span className="text-sm text-gray-500">
                    {formatShortDate(job.appliedAt ?? job.createdAt)}
                  </span>

                  {/* Resume */}
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="flex"
                  >
                    {job.resumeUsed ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          toast.info("Resume download coming soon")
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            toast.info("Resume download coming soon")
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-1.5 text-sm font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </span>
                    ) : (
                      <span className="bg-gray-200 text-gray-400 rounded-lg px-4 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5 cursor-default">
                        <Download className="w-3.5 h-3.5" />
                        N/A
                      </span>
                    )}
                  </span>

                  {/* Link */}
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="flex"
                  >
                    {job.url ? (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </span>
                </button>

                {/* Expanded detail row */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    isExpanded
                      ? "max-h-[600px] opacity-100"
                      : "max-h-0 opacity-0"
                  )}
                >
                  <div className="px-6 py-5 bg-gray-50/30 border-b border-gray-100 space-y-4">
                    {/* Description */}
                    {job.description && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Description
                        </p>
                        <p className="text-sm text-gray-700">
                          {job.description.length > 200
                            ? job.description.slice(0, 200) + "..."
                            : job.description}
                        </p>
                      </div>
                    )}

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-3">
                      {job.location && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Location
                          </p>
                          <p className="text-sm text-gray-700">
                            {job.location}
                          </p>
                        </div>
                      )}

                      {job.salary && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Salary
                          </p>
                          <p className="text-sm text-gray-700">{job.salary}</p>
                        </div>
                      )}

                      {job.workType && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Work Type
                          </p>
                          <p className="text-sm text-gray-700">
                            {job.workType}
                          </p>
                        </div>
                      )}

                      {job.experienceLevel && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Experience
                          </p>
                          <p className="text-sm text-gray-700">
                            {job.experienceLevel}
                          </p>
                        </div>
                      )}

                      {job.industry && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Industry
                          </p>
                          <p className="text-sm text-gray-700">
                            {job.industry}
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Source
                        </p>
                        <p className="text-sm text-gray-700">
                          {job.source || "Direct"}
                        </p>
                      </div>

                      {job.postedAt && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Posted
                          </p>
                          <p className="text-sm text-gray-700">
                            {formatShortDate(job.postedAt)}
                          </p>
                        </div>
                      )}

                      {job.resumeUsed && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Resume Used
                          </p>
                          <p className="text-sm text-gray-700">
                            {job.resumeUsed}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Skills */}
                    {job.skills && job.skills.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {job.skills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {job.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Notes
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {job.notes}
                        </p>
                      </div>
                    )}

                    {/* Job URL */}
                    {job.url && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Job URL
                        </p>
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                        >
                          {job.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      {/* Status update dropdown */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-500">
                          Update Status
                        </label>
                        <select
                          value={job.status}
                          onChange={(e) =>
                            handleStatusChange(
                              job,
                              e.target.value as ApplicationStatus
                            )
                          }
                          className="h-8 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDelete(job)}
                        disabled={deleteJob.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
