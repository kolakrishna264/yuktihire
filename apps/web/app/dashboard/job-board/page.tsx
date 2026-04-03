"use client"

import { useState, useMemo, useEffect } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { useCreateJob, useSavedJobUrls } from "@/lib/hooks/useJobs"
import { useJobBoard } from "@/lib/hooks/useJobBoard"
import { cn } from "@/lib/utils/cn"
import type { JobBoardItem } from "@/types"

// -- Helpers ------------------------------------------------------------------

const TIME_FILTERS = ["Last 24 Hours", "Last 3 Days", "Last 7 Days", "Last 30 Days"] as const

const DOMAINS = ["All", "Engineering", "Design", "Product", "Data", "Marketing", "Security"] as const

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

// -- Page Component -----------------------------------------------------------

export default function JobBoardPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [timeFilter, setTimeFilter] = useState<string>("Last 24 Hours")
  const [workTypeFilter, setWorkTypeFilter] = useState("All")
  const [levelFilter, setLevelFilter] = useState("All")
  const [industryFilter, setIndustryFilter] = useState("All")
  const [domainFilter, setDomainFilter] = useState("All")
  const [sortBy, setSortBy] = useState("newest")
  const [page, setPage] = useState(1)
  const [addedJobs, setAddedJobs] = useState<Set<string>>(new Set())
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set())

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Reset page on filter/sort change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, workTypeFilter, levelFilter, industryFilter, sortBy])

  const { data, isLoading, error, refetch } = useJobBoard({
    search: debouncedSearch || undefined,
    workType: workTypeFilter !== "All" ? workTypeFilter : undefined,
    sort: sortBy,
    page,
    perPage: 20,
  })

  const jobs = data?.jobs ?? []
  const totalCount = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const { mutate: createJob, isPending: isCreating } = useCreateJob()

  // Load saved job URLs to detect duplicates
  const { data: savedData } = useSavedJobUrls()
  const savedUrls = new Set(savedData?.urls ?? [])
  const savedExtIds = new Set(savedData?.externalJobIds ?? [])

  const isJobSaved = (job: JobBoardItem) => {
    if (job.url && savedUrls.has(job.url)) return true
    if (job.id && savedExtIds.has(job.id)) return true
    return false
  }

  // Derive dynamic filter options from loaded data
  const workTypeOptions = useMemo(() => {
    const types = Array.from(new Set(jobs.map((j) => j.workType).filter(Boolean)))
    return ["All", ...types.sort()]
  }, [jobs])

  const levelOptions = useMemo(() => {
    const levels = Array.from(new Set(jobs.map((j) => j.experienceLevel).filter(Boolean)))
    return ["All", ...levels.sort()]
  }, [jobs])

  const industryOptions = useMemo(() => {
    const industries = Array.from(
      new Set(jobs.map((j) => j.industry).filter((v): v is string => !!v))
    )
    return ["All", ...industries.sort()]
  }, [jobs])

  // Client-side filtering for filters the backend doesn't handle
  const filteredJobs = useMemo(() => {
    let result = jobs
    if (levelFilter && levelFilter !== "All") {
      result = result.filter((j) => j.experienceLevel === levelFilter)
    }
    if (industryFilter && industryFilter !== "All") {
      result = result.filter((j) =>
        j.industry?.toLowerCase().includes(industryFilter.toLowerCase())
      )
    }
    return result
  }, [jobs, levelFilter, industryFilter])

  function buildJobPayload(job: JobBoardItem, status: "SAVED" | "APPLIED") {
    return {
      title: job.title,
      company: job.company,
      url: job.url,
      location: job.location,
      salary: job.salaryRange,
      source: job.source || "Job Board",
      work_type: job.workType,
      experience_level: job.experienceLevel,
      industry: job.industry,
      skills: job.skills,
      description: job.description,
      external_job_id: job.id,
      posted_at: job.postedDate,
      status,
    }
  }

  function handleAddJob(job: JobBoardItem) {
    createJob(buildJobPayload(job, "SAVED"), {
      onSuccess: () => {
        setAddedJobs((prev) => new Set([...prev, job.id]))
      },
    })
  }

  function handleMarkApplied(job: JobBoardItem) {
    createJob(buildJobPayload(job, "APPLIED"), {
      onSuccess: () => {
        setAppliedJobs((prev) => new Set([...prev, job.id]))
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* -- Header --------------------------------------------------------- */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Board</h1>
          <p className="text-sm text-gray-500">
            Browse jobs and add them to your resume queue.{" "}
            <span className="font-medium text-gray-700">
              Showing {filteredJobs.length} of {totalCount} jobs
            </span>
          </p>
        </div>
        <p className="text-sm text-gray-500">
          You have <span className="font-bold text-indigo-600">15</span> tokens remaining
        </p>
      </div>

      {/* -- Time Filter Pills ---------------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        {TIME_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTimeFilter(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
              timeFilter === t
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* -- Search + Sort + Dropdown Filters ------------------------------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search title or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] max-w-md"
          />

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
            aria-label="Sort"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="salary">Salary (highest)</option>
            <option value="company">Company A-Z</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <FilterSelect
            label="Domain"
            value={domainFilter}
            onChange={setDomainFilter}
            options={DOMAINS as unknown as string[]}
            className="hidden sm:block"
          />
          <FilterSelect
            label="Work Type"
            value={workTypeFilter}
            onChange={setWorkTypeFilter}
            options={workTypeOptions}
          />
          <FilterSelect
            label="Level"
            value={levelFilter}
            onChange={setLevelFilter}
            options={levelOptions}
            className="hidden sm:block"
          />
          <FilterSelect
            label="Industry"
            value={industryFilter}
            onChange={setIndustryFilter}
            options={industryOptions}
            className="hidden sm:block"
          />
          <FilterSelect
            label="Certification"
            value="All"
            onChange={() => {}}
            options={["All"]}
            className="hidden sm:block"
          />
        </div>
      </div>

      {/* -- Error State ----------------------------------------------------- */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700 mb-1">Failed to load jobs</p>
          <p className="text-xs text-red-500">{(error as Error).message}</p>
          <button onClick={() => refetch()} className="mt-3 text-sm text-red-600 underline">
            Try again
          </button>
        </div>
      )}

      {/* -- Job Cards ------------------------------------------------------- */}
      <div className="space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-white p-6">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-72 mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && filteredJobs.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 mb-1">No jobs found</p>
            <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}

        {!isLoading &&
          filteredJobs.map((job) => {
            const isSaved = isJobSaved(job) || addedJobs.has(job.id)
            const isApplied = appliedJobs.has(job.id)

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
                      {job.companyLogo ? (
                        <img src={job.companyLogo} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">
                          {job.company.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2.5">
                      <h3 className="text-base font-bold text-gray-900 leading-tight">
                        {job.title}
                      </h3>
                      <p className="text-sm text-gray-500 flex flex-wrap items-center gap-1">
                        {job.company}
                        {/* Source badge */}
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                            job.source === "Remotive"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          )}
                        >
                          {job.source}
                        </span>
                        <span>&middot;</span>
                        <span>{job.location}</span>
                        <span>&middot;</span>
                        <span>{job.postedDate}</span>
                      </p>

                      {/* Tags row */}
                      <div className="flex flex-wrap gap-1.5">
                        {/* Work type */}
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${workTypeBadgeClass(job.workType)}`}
                        >
                          {job.workType}
                        </span>

                        {/* Experience level */}
                        <Badge variant="secondary">{job.experienceLevel}</Badge>

                        {/* Salary */}
                        {job.salaryRange && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {job.salaryRange}
                          </span>
                        )}

                        {/* Employment type */}
                        {job.employmentType && (
                          <Badge variant="outline">{job.employmentType}</Badge>
                        )}

                        {/* Industry */}
                        {job.industry && (
                          <Badge variant="default">{job.industry}</Badge>
                        )}

                        {/* Skills */}
                        {job.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-400">
                            +{job.skills.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side -- action buttons */}
                  <div className="flex flex-row sm:flex-col gap-2 shrink-0 items-start">
                    {/* Save / Add Job button */}
                    {isSaved ? (
                      <Button
                        size="sm"
                        disabled
                        className="bg-emerald-600 hover:bg-emerald-600 text-white cursor-default"
                      >
                        {addedJobs.has(job.id) ? "Added \u2713" : "Saved \u2713"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isCreating}
                        onClick={() => handleAddJob(job)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Add Job
                      </Button>
                    )}

                    {/* Apply button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (job.url) window.open(job.url, "_blank")
                      }}
                    >
                      Apply &#8599;
                    </Button>

                    {/* Mark as Applied link */}
                    {isApplied ? (
                      <span className="text-xs text-emerald-600 font-medium">Applied &#10003;</span>
                    ) : isSaved ? (
                      <button
                        onClick={() => handleMarkApplied(job)}
                        disabled={isCreating}
                        className="text-xs text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50"
                      >
                        Mark as Applied
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* -- Pagination ------------------------------------------------------ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 pb-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &larr; Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
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
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt === "All" ? `${label}: All` : opt}
        </option>
      ))}
    </select>
  )
}
