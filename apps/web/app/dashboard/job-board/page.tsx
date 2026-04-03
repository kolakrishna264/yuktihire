"use client"

import { useState, useMemo, useEffect } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { useCreateJob } from "@/lib/hooks/useJobs"
import { useJobBoard } from "@/lib/hooks/useJobBoard"
import type { JobBoardItem } from "@/types"

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Page Component ───────────────────────────────────────────────────────────

export default function JobBoardPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [timeFilter, setTimeFilter] = useState<string>("Last 24 Hours")
  const [workTypeFilter, setWorkTypeFilter] = useState("All")
  const [levelFilter, setLevelFilter] = useState("All")
  const [industryFilter, setIndustryFilter] = useState("All")
  const [domainFilter, setDomainFilter] = useState("All")
  const [addedJobs, setAddedJobs] = useState<Set<string>>(new Set())

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const { data, isLoading } = useJobBoard({
    search: debouncedSearch || undefined,
    workType: workTypeFilter !== "All" ? workTypeFilter : undefined,
    limit: 50,
  })

  const jobs = data?.jobs ?? []
  const totalCount = data?.total ?? 0

  const { mutate: createJob, isPending: isCreating } = useCreateJob()

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

  function handleAddJob(job: JobBoardItem) {
    createJob(
      {
        title: job.title,
        company: job.company,
        url: job.url,
        status: "SAVED",
      },
      {
        onSuccess: () => {
          setAddedJobs((prev) => new Set(prev).add(job.id))
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Board</h1>
          <p className="text-sm text-gray-500">
            Browse jobs and add them to your resume queue.{" "}
            <span className="font-medium text-gray-700">
              Showing {filteredJobs.length} jobs
            </span>
          </p>
        </div>
        <p className="text-sm text-gray-500">
          You have <span className="font-bold text-indigo-600">15</span> tokens remaining
        </p>
      </div>

      {/* ── Time Filter Pills ──────────────────────────────────────────── */}
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

      {/* ── Search + Dropdown Filters ──────────────────────────────────── */}
      <div className="space-y-3">
        <Input
          placeholder="Search title or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />

        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Domain"
            value={domainFilter}
            onChange={setDomainFilter}
            options={DOMAINS as unknown as string[]}
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
          />
          <FilterSelect
            label="Industry"
            value={industryFilter}
            onChange={setIndustryFilter}
            options={industryOptions}
          />
          <FilterSelect
            label="Certification"
            value="All"
            onChange={() => {}}
            options={["All"]}
          />
        </div>
      </div>

      {/* ── Job Cards ──────────────────────────────────────────────────── */}
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

        {!isLoading && filteredJobs.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 mb-1">No jobs found</p>
            <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
          </div>
        )}

        {!isLoading &&
          filteredJobs.map((job) => {
            const isAdded = addedJobs.has(job.id)

            return (
              <div
                key={job.id}
                className="rounded-xl border border-gray-100 bg-white p-5 hover:shadow-md hover:border-indigo-200 transition-all flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
              >
                {/* Left side */}
                <div className="flex-1 min-w-0 space-y-2.5">
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    {job.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {job.company} &middot; {job.location} &middot; {job.postedDate}
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

                {/* Right side — action buttons */}
                <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={isAdded || isCreating}
                    onClick={() => handleAddJob(job)}
                    className={
                      isAdded
                        ? "bg-emerald-600 hover:bg-emerald-600 text-white cursor-default"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }
                  >
                    {isAdded ? "Added \u2713" : "Add Job"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(job.url, "_blank")}
                  >
                    Apply &#8599;
                  </Button>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

// ── FilterSelect ─────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
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
