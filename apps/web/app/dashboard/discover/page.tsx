"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search,
  MapPin,
  Building2,
  Briefcase,
  Clock,
  ExternalLink,
  Plus,
  Check,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { useDiscover, useRefreshSources } from "@/lib/hooks/useDiscover"
import { useAddToTracker } from "@/lib/hooks/useTracker"
import { cn } from "@/lib/utils/cn"

// -- Constants ----------------------------------------------------------------

const WORK_TYPES = ["All", "Remote", "Hybrid", "On-site"] as const

const EXPERIENCE_LEVELS = [
  { label: "All", value: "All" },
  { label: "0-2 years", value: "0-2 years" },
  { label: "1+ years", value: "1+ years" },
  { label: "3-5 years", value: "3-5 years" },
  { label: "5+ years", value: "5+ years" },
] as const

const INDUSTRIES = [
  "All",
  "Technology",
  "FinTech",
  "Healthcare",
  "AI/ML",
  "SaaS",
  "E-Commerce",
  "Education",
  "Cybersecurity",
] as const

const SOURCES = ["All", "Remotive", "Arbeitnow"] as const

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Salary (highest)", value: "salary" },
  { label: "Company A-Z", value: "company" },
] as const

// -- Helpers ------------------------------------------------------------------

function workTypeBadgeClass(type: string) {
  switch (type) {
    case "On-site":
      return "bg-emerald-100 text-emerald-700"
    case "Hybrid":
      return "bg-amber-100 text-amber-700"
    case "Remote":
      return "bg-blue-100 text-blue-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

function sourceBadgeClass(name: string) {
  switch (name) {
    case "Remotive":
      return "bg-green-100 text-green-700"
    case "Arbeitnow":
      return "bg-orange-100 text-orange-700"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

function formatSalary(
  salaryRaw?: string | null,
  salaryMin?: number | null,
  salaryMax?: number | null
) {
  if (salaryRaw) return salaryRaw
  if (salaryMin && salaryMax)
    return `$${salaryMin.toLocaleString()} - $${salaryMax.toLocaleString()}`
  if (salaryMin) return `$${salaryMin.toLocaleString()}+`
  if (salaryMax) return `Up to $${salaryMax.toLocaleString()}`
  return null
}

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

// -- Page Component -----------------------------------------------------------

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [workTypeFilter, setWorkTypeFilter] = useState("All")
  const [experienceFilter, setExperienceFilter] = useState("All")
  const [industryFilter, setIndustryFilter] = useState("All")
  const [sourceFilter, setSourceFilter] = useState("All")
  const [sortBy, setSortBy] = useState("newest")
  const [page, setPage] = useState(1)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Reset page on filter/sort change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, workTypeFilter, experienceFilter, industryFilter, sourceFilter, sortBy])

  const { data, isLoading, error, refetch } = useDiscover({
    search: debouncedSearch || undefined,
    workType: workTypeFilter !== "All" ? workTypeFilter : undefined,
    experienceLevel: experienceFilter !== "All" ? experienceFilter : undefined,
    industry: industryFilter !== "All" ? industryFilter : undefined,
    source: sourceFilter !== "All" ? sourceFilter : undefined,
    sort: sortBy,
    page,
    perPage: 20,
  })

  const jobs = data?.jobs ?? []
  const totalCount = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const { mutate: refreshSources, isPending: isRefreshing } = useRefreshSources()
  const { mutate: addToTracker, isPending: isSaving } = useAddToTracker()

  const handleSaveToTracker = useCallback(
    (job: (typeof jobs)[0]) => {
      addToTracker(
        {
          job_id: job.id,
          title: job.title,
          company: job.company,
          url: job.url,
          location: job.location,
          salary: job.salaryRaw,
          work_type: job.workType,
          experience_level: job.experienceLevel,
          industry: job.industry,
          skills: job.skills.map((s) => s.canonical),
          description: job.descriptionText,
          source: job.sources[0]?.name || "Discover",
        },
        {
          onSuccess: () => {
            setSavedJobIds((prev) => new Set([...prev, job.id]))
          },
        }
      )
    },
    [addToTracker]
  )

  return (
    <div className="space-y-6">
      {/* -- Header --------------------------------------------------------- */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discover</h1>
          <p className="text-sm text-gray-500">
            Find your next opportunity across{" "}
            <span className="font-medium text-indigo-600">
              {totalCount.toLocaleString()}
            </span>{" "}
            jobs
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          loading={isRefreshing}
          onClick={() => refreshSources()}
          className="gap-1.5"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
          Refresh Sources
        </Button>
      </div>

      {/* -- Search Bar ----------------------------------------------------- */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search jobs, companies, skills..."
          className="w-full h-12 rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm"
        />
      </div>

      {/* -- Filter Bar ----------------------------------------------------- */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <FilterSelect
          label="Work Type"
          value={workTypeFilter}
          onChange={setWorkTypeFilter}
          options={WORK_TYPES as unknown as string[]}
        />
        <FilterSelect
          label="Experience"
          value={experienceFilter}
          onChange={setExperienceFilter}
          options={EXPERIENCE_LEVELS.map((e) => e.value) as unknown as string[]}
          displayOptions={EXPERIENCE_LEVELS.map((e) => ({ value: e.value, label: e.label }))}
          className="hidden sm:block"
        />
        <FilterSelect
          label="Industry"
          value={industryFilter}
          onChange={setIndustryFilter}
          options={INDUSTRIES as unknown as string[]}
          className="hidden sm:block"
        />
        <FilterSelect
          label="Source"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={SOURCES as unknown as string[]}
          className="hidden sm:block"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
          aria-label="Sort"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* -- Error State ---------------------------------------------------- */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-col items-center text-center gap-2">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm font-medium text-red-700">Failed to load jobs</p>
          <p className="text-xs text-red-500">{(error as Error).message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-2 border-red-200 text-red-600 hover:bg-red-100"
          >
            Try again
          </Button>
        </div>
      )}

      {/* -- Job Cards ------------------------------------------------------ */}
      <div className="space-y-4">
        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-100 bg-white p-6"
              >
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-72" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && jobs.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 mb-1">No jobs found</p>
            <p className="text-xs text-gray-400">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {/* Job list */}
        {!isLoading &&
          jobs.map((job) => {
            const isSaved = savedJobIds.has(job.id)
            const salary = formatSalary(job.salaryRaw, job.salaryMin, job.salaryMax)
            const sourceName = job.sources?.[0]?.name
            const posted = timeAgo(job.postedAt)

            return (
              <div
                key={job.id}
                className="rounded-xl border border-gray-100 bg-white p-5 hover:shadow-md hover:border-indigo-200 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Left side */}
                  <div className="flex gap-3 flex-1 min-w-0">
                    {/* Company logo */}
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {job.companyLogoUrl ? (
                        <img
                          src={job.companyLogoUrl}
                          alt={job.company}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">
                          {job.company?.charAt(0)?.toUpperCase() ?? "?"}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* Title row */}
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-gray-900 leading-tight">
                          {job.title}
                        </h3>
                        {sourceName && (
                          <span
                            className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
                              sourceBadgeClass(sourceName)
                            )}
                          >
                            {sourceName}
                          </span>
                        )}
                      </div>

                      {/* Meta row */}
                      <p className="text-sm text-gray-500 flex flex-wrap items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 inline shrink-0" />
                        <span>{job.company}</span>
                        {job.location && (
                          <>
                            <span>&middot;</span>
                            <MapPin className="w-3.5 h-3.5 inline shrink-0" />
                            <span>{job.location}</span>
                          </>
                        )}
                        {posted && (
                          <>
                            <span>&middot;</span>
                            <Clock className="w-3.5 h-3.5 inline shrink-0" />
                            <span>{posted}</span>
                          </>
                        )}
                      </p>

                      {/* Tags row */}
                      <div className="flex flex-wrap gap-1.5">
                        {/* Work type */}
                        {job.workType && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              workTypeBadgeClass(job.workType)
                            )}
                          >
                            {job.workType}
                          </span>
                        )}

                        {/* Employment type */}
                        {job.employmentType && (
                          <Badge variant="outline">{job.employmentType}</Badge>
                        )}

                        {/* Skills */}
                        {job.skills?.slice(0, 5).map((skill) => (
                          <span
                            key={skill.name}
                            className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700"
                          >
                            {skill.name}
                          </span>
                        ))}
                        {job.skills?.length > 5 && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-400">
                            +{job.skills.length - 5} more
                          </span>
                        )}
                      </div>

                      {/* Salary + Experience row */}
                      {(salary || job.experienceLevel) && (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                          {salary && (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                              {salary}
                            </span>
                          )}
                          {job.experienceLevel && (
                            <>
                              {salary && <span>&middot;</span>}
                              <Briefcase className="w-3.5 h-3.5 inline shrink-0 text-gray-400" />
                              <span>{job.experienceLevel}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side -- action buttons */}
                  <div className="flex flex-row sm:flex-col gap-2 shrink-0 items-start">
                    {/* Save to Tracker */}
                    {isSaved ? (
                      <Button
                        size="sm"
                        disabled
                        className="bg-emerald-600 hover:bg-emerald-600 text-white cursor-default"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Saved
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        loading={isSaving}
                        onClick={() => handleSaveToTracker(job)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Save to Tracker
                      </Button>
                    )}

                    {/* Apply */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (job.url) window.open(job.url, "_blank")
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* -- Pagination ----------------------------------------------------- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 pb-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            &larr; Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

// -- FilterSelect -------------------------------------------------------------

function FilterSelect({
  label,
  value,
  onChange,
  options,
  displayOptions,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  displayOptions?: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer",
        className
      )}
      aria-label={label}
    >
      {displayOptions
        ? displayOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value === "All" ? `${label}: All` : opt.label}
            </option>
          ))
        : options.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "All" ? `${label}: All` : opt}
            </option>
          ))}
    </select>
  )
}
