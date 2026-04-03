"use client"

import { useState } from "react"
import Link from "next/link"
import { useTrackerList } from "@/lib/hooks/useTracker"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import {
  Briefcase,
  Search,
  MapPin,
  Calendar,
  ExternalLink,
  Wand2,
  ChevronDown,
  ChevronUp,
  Globe,
  PlusCircle,
  Chrome,
  Loader2,
} from "lucide-react"
import type { TrackedJob, PipelineStage } from "@/types"

type FilterStatus = "ALL" | "SAVED" | "TAILORED" | "APPLIED"

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "secondary" | "warning" | "success" | "default"; spinning?: boolean }
> = {
  SAVED: { label: "Saved", variant: "secondary" },
  TAILORING: { label: "Tailoring", variant: "warning", spinning: true },
  TAILORED: { label: "Tailored", variant: "success" },
  APPLIED: { label: "Applied", variant: "default" },
  PHONE_SCREEN: { label: "Applied", variant: "default" },
  INTERVIEWING: { label: "Applied", variant: "default" },
  OFFER: { label: "Applied", variant: "default" },
}

const APPLIED_STAGES = new Set(["APPLIED", "PHONE_SCREEN", "INTERVIEWING", "OFFER"])

function getDisplayStatus(job: TrackedJob): string {
  if (APPLIED_STAGES.has(job.pipelineStage)) {
    return "APPLIED"
  }
  // Check if the job has been tailored (has resumeUsed or resumeVersionId)
  if (job.resumeUsed || job.resumeVersionId) {
    return "TAILORED"
  }
  return "SAVED"
}

function shortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function MyJobsPage() {
  const { data: jobs = [], isLoading } = useTrackerList()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterStatus>("ALL")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filter logic
  const filtered = jobs
    .filter((job) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.location?.toLowerCase().includes(q) ?? false)
      )
    })
    .filter((job) => {
      if (filter === "ALL") return true
      const status = getDisplayStatus(job)
      return status === filter
    })

  const filterButtons: { value: FilterStatus; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "SAVED", label: "Saved" },
    { value: "TAILORED", label: "Tailored" },
    { value: "APPLIED", label: "Applied" },
  ]

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              My Jobs
              {!isLoading && (
                <span className="text-base font-normal text-gray-400">
                  ({jobs.length})
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Jobs you&apos;ve saved from the web &mdash; tailored and tracked
            </p>
          </div>
          <Link href="/dashboard/add-job">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <PlusCircle className="w-4 h-4" />
              Add Job
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filter === btn.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 && jobs.length === 0 ? (
        /* Empty state — no jobs at all */
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">No jobs saved yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Find a job on any website and use the YuktiHire extension to save it, or add one manually.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/add-job">
              <Button variant="outline">
                <PlusCircle className="w-4 h-4" />
                Add Job Manually
              </Button>
            </Link>
            <Link href="/dashboard/extension">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Chrome className="w-4 h-4" />
                Get Extension
              </Button>
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty filtered state */
        <div className="rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No jobs match your search or filter.</p>
        </div>
      ) : (
        /* Job cards */
        <div className="space-y-3">
          {filtered.map((job) => {
            const displayStatus = getDisplayStatus(job)
            const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.SAVED
            const isExpanded = expandedId === job.id

            return (
              <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-bold text-gray-900 truncate">
                          {job.title}
                        </h3>
                        <Badge variant={config.variant}>
                          {config.spinning && (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          )}
                          {config.label}
                        </Badge>
                        {/* ATS score badge if available */}
                        {job.resumeUsed && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-700 border-emerald-200">
                            Tailored
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 font-medium">{job.company}</p>

                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {job.location && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                        )}
                        {job.source && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Globe className="w-3 h-3" />
                            {job.source}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {shortDate(job.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/dashboard/tailor?tracker=${job.id}`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          <Wand2 className="w-3.5 h-3.5" />
                          Tailor Resume
                        </Button>
                      </Link>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="text-xs text-indigo-600">
                            Apply on Site
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : job.id)}
                    className="flex items-center gap-1 mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        View Details
                      </>
                    )}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {job.description && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Job Description
                          </p>
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {job.description}
                          </p>
                        </div>
                      )}
                      {job.skills && job.skills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Skills
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {job.skills.map((skill) => (
                              <span
                                key={skill}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {job.notes && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Notes
                          </p>
                          <p className="text-sm text-gray-600">{job.notes}</p>
                        </div>
                      )}
                      {!job.description && !job.notes && (!job.skills || job.skills.length === 0) && (
                        <p className="text-sm text-gray-400 italic">No additional details available.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
