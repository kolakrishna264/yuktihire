"use client"

import { useState, useMemo } from "react"
import { useAllJobs } from "@/lib/hooks/useJobs"
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
  Calendar,
  FileText,
  Briefcase,
} from "lucide-react"
import type { JobApplication, ApplicationStatus } from "@/types"
import Link from "next/link"
import { toast } from "sonner"

// ── Status badge variant map ─────────────────────────────────────────────────

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

// ── Short date formatter: "Mar 20" ───────────────────────────────────────────

function shortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Status label ─────────────────────────────────────────────────────────────

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

  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filter: only non-SAVED jobs
  const appliedJobs = useMemo(() => {
    let filtered = jobs.filter((j) => j.status !== "SAVED")

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (j) =>
          j.company.toLowerCase().includes(q) ||
          j.title.toLowerCase().includes(q) ||
          (j.notes && j.notes.toLowerCase().includes(q))
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
  }, [jobs, search, dateFrom, dateTo])

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
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

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!isLoading && appliedJobs.length === 0 && !search && !dateFrom && !dateTo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <Briefcase className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">No applications yet</h2>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Browse the Job Board to get started tracking your applications.
        </p>
        <Link href="/dashboard/job-board">
          <Button>Browse Job Board</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Applied</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {appliedJobs.length} application{appliedJobs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, title, or description..."
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

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {appliedJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Search className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-500">No results match your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[40px_1.2fr_1.5fr_100px_100px_80px] gap-2 px-4 py-3 bg-indigo-50/70 rounded-t-xl text-xs font-bold text-gray-600 uppercase tracking-wide">
            <span />
            <span>Company</span>
            <span>Job Title</span>
            <span>Applied</span>
            <span>Resume</span>
            <span>Link</span>
          </div>

          {/* Rows */}
          {appliedJobs.map((job) => {
            const isExpanded = expandedId === job.id
            return (
              <div key={job.id}>
                {/* Main row */}
                <button
                  onClick={() => toggleExpand(job.id)}
                  className={cn(
                    "w-full grid grid-cols-[40px_1.2fr_1.5fr_100px_100px_80px] gap-2 px-4 py-3 items-center text-left border-b border-gray-50 transition-colors",
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
                  <span className="text-sm text-gray-700 truncate">{job.title}</span>

                  {/* Applied date */}
                  <span className="text-sm text-gray-500">
                    {shortDate(job.appliedAt ?? job.createdAt)}
                  </span>

                  {/* Resume — stop propagation so click doesn't toggle row */}
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="flex"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        toast.info("Resume download coming soon")
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") toast.info("Resume download coming soon")
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </span>
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
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium underline inline-flex items-center gap-1"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-300 text-sm">--</span>
                    )}
                  </span>
                </button>

                {/* Expanded detail row */}
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 space-y-3">
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

                    {/* Metadata grid */}
                    <div className="flex flex-wrap gap-x-8 gap-y-2">
                      {/* Status */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Status
                        </p>
                        <Badge variant={STATUS_BADGE[job.status]}>
                          {statusLabel(job.status)}
                        </Badge>
                      </div>

                      {/* Source */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Source
                        </p>
                        <p className="text-sm text-gray-700">
                          {job.source || "Direct"}
                        </p>
                      </div>

                      {/* Resume used */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Resume Used
                        </p>
                        <p className="text-sm text-gray-700 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          {job.resumeUsed || "\u2014"}
                        </p>
                      </div>

                      {/* Location */}
                      {job.location && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Location
                          </p>
                          <p className="text-sm text-gray-700">{job.location}</p>
                        </div>
                      )}

                      {/* Salary */}
                      {job.salary && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Salary
                          </p>
                          <p className="text-sm text-gray-700">{job.salary}</p>
                        </div>
                      )}
                    </div>

                    {/* URL */}
                    {job.url && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          URL
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
