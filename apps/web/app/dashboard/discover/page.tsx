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
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { useDiscover, useRefreshSources, useRecommendations } from "@/lib/hooks/useDiscover"
import { useAddToTracker, useTrackerList } from "@/lib/hooks/useTracker"
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

const FRESHNESS_OPTIONS = [
  { label: "Any time", value: "any" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
] as const

const SORT_OPTIONS = [
  { label: "Best Match", value: "best_match" },
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
  const [titleFilter, setTitleFilter] = useState("")
  const [debouncedTitle, setDebouncedTitle] = useState("")
  const [workTypeFilter, setWorkTypeFilter] = useState("All")
  const [experienceFilter, setExperienceFilter] = useState("All")
  const [industryFilter, setIndustryFilter] = useState("All")
  const [sourceFilter, setSourceFilter] = useState("All")
  const [countryFilter, setCountryFilter] = useState("us_eligible")
  const [freshnessFilter, setFreshnessFilter] = useState("any")
  const [sortBy, setSortBy] = useState("best_match")
  const [page, setPage] = useState(1)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Debounce title filter
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(titleFilter), 300)
    return () => clearTimeout(t)
  }, [titleFilter])

  // Reset page on filter/sort change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, debouncedTitle, workTypeFilter, experienceFilter, industryFilter, sourceFilter, countryFilter, freshnessFilter, sortBy])

  const { data, isLoading, error, refetch } = useDiscover({
    q: debouncedSearch || undefined,
    workType: workTypeFilter !== "All" ? workTypeFilter : undefined,
    experienceLevel: experienceFilter !== "All" ? experienceFilter : undefined,
    industry: industryFilter !== "All" ? industryFilter : undefined,
    source: sourceFilter !== "All" ? sourceFilter : undefined,
    country: countryFilter || undefined,
    sort: sortBy,
    page,
    perPage: 20,
  })

  const rawJobs = data?.jobs ?? []

  // Client-side freshness filter
  const jobs = rawJobs.filter((job) => {
    // Freshness filter
    if (freshnessFilter !== "any" && job.postedAt) {
      const postedDate = new Date(job.postedAt)
      const now = new Date()
      const diffMs = now.getTime() - postedDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      if (freshnessFilter === "24h" && diffDays > 1) return false
      if (freshnessFilter === "7d" && diffDays > 7) return false
      if (freshnessFilter === "30d" && diffDays > 30) return false
    }
    // Title filter (client-side)
    if (debouncedTitle) {
      const titleLower = debouncedTitle.toLowerCase()
      if (!job.title?.toLowerCase().includes(titleLower)) return false
    }
    return true
  })

  const totalCount = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const { data: recsData } = useRecommendations(8)
  const recommendations = recsData?.recommendations ?? []

  // Load tracked jobs for badges
  const { data: trackedJobs = [] } = useTrackerList()
  const trackedUrls = new Set((trackedJobs as any[]).map((j: any) => j.url).filter(Boolean))
  const trackedMap = new Map((trackedJobs as any[]).filter((j: any) => j.url).map((j: any) => [j.url, j]))

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
          <h1 className="text-2xl font-bold text-gray-900">Discover Jobs</h1>
          <p className="text-sm text-gray-500">
            Browse{" "}
            <span className="font-medium text-indigo-600">
              {totalCount.toLocaleString()}
            </span>{" "}
            opportunities from top companies — save, tailor, and apply
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

      {/* -- Recommended for You --------------------------------------------- */}
      {recommendations.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recommended for You</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recommendations.slice(0, 4).map(rec => (
              <div key={rec.jobId} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-indigo-200 transition-all">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-sm font-bold text-gray-400">
                    {rec.companyLogoUrl ? <img src={rec.companyLogoUrl} alt="" className="w-full h-full object-contain rounded-lg" /> : rec.company.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{rec.title}</p>
                    <p className="text-xs text-gray-500 truncate">{rec.company}</p>
                  </div>
                </div>
                {/* Score + badges */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    rec.score >= 70 ? "bg-emerald-100 text-emerald-700" :
                    rec.score >= 40 ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  )}>
                    {rec.score}% match
                  </span>
                  {rec.badges.slice(0, 2).map(b => (
                    <span key={b} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{b}</span>
                  ))}
                </div>
                {/* Reasons */}
                <p className="text-[11px] text-gray-400 line-clamp-2">{rec.reasons[0]}</p>
                {/* Save button */}
                <button
                  onClick={() => addToTracker({
                    job_id: rec.jobId, title: rec.title, company: rec.company,
                    url: rec.url, location: rec.location, work_type: rec.workType,
                    industry: rec.industry, source: "Recommendation",
                  })}
                  className="mt-2 w-full text-xs font-medium py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  Save & Tailor
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <input
          type="text"
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
          placeholder="Filter by title..."
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors w-40"
        />
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
          value={countryFilter}
          onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
          aria-label="Country"
        >
          <option value="">All Countries</option>
          <option value="us_eligible">US & Remote</option>
          <option value="US">United States Only</option>
          <option value="REMOTE_US">Remote (US)</option>
          <option value="REMOTE">Remote (Worldwide)</option>
        </select>
        <select
          value={freshnessFilter}
          onChange={(e) => setFreshnessFilter(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
          aria-label="Freshness"
        >
          {FRESHNESS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
                        <button
                          onClick={() => setSelectedJobId(job.id)}
                          className="text-base font-bold text-gray-900 leading-tight hover:text-indigo-600 transition-colors text-left"
                        >
                          {job.title}
                        </button>
                        {job.matchScore !== undefined && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            job.matchScore >= 70 ? "bg-emerald-100 text-emerald-700" :
                            job.matchScore >= 40 ? "bg-amber-100 text-amber-700" :
                            "bg-gray-100 text-gray-500"
                          )}>
                            {job.matchScore}% match
                          </span>
                        )}
                        {job.matchBadges?.slice(0, 2).map((b: string) => (
                          <span key={b} className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{b}</span>
                        ))}
                        {trackedUrls.has(job.url) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Tracked
                          </span>
                        )}
                        {trackedMap.get(job.url)?.pipelineStage === "APPLIED" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Applied
                          </span>
                        )}
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
                        {job.country === "US" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">US</span>
                        )}
                        {job.country === "REMOTE_US" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Remote US</span>
                        )}
                        {job.country === "REMOTE" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Remote</span>
                        )}
                        {job.country === "NON_US" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">International</span>
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
                    {/* Save & Tailor */}
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
                        Save & Tailor
                      </Button>
                    )}

                    {/* Apply on original site */}
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Apply on Site
                      </a>
                    )}
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

      {/* Job Detail Drawer */}
      {(() => {
        const selectedJob = jobs.find(j => j.id === selectedJobId)
        if (!selectedJob) return null
        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedJobId(null)} />
            <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 truncate">{selectedJob.title}</h2>
                <button onClick={() => setSelectedJobId(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="p-5 space-y-4">
                {/* Company + Location */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-400">
                    {selectedJob.companyLogoUrl ? <img src={selectedJob.companyLogoUrl} alt="" className="w-full h-full object-contain rounded-xl" /> : selectedJob.company.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedJob.company}</p>
                    <p className="text-xs text-gray-500">{selectedJob.location}</p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.workType && <Badge>{selectedJob.workType}</Badge>}
                  {selectedJob.experienceLevel && <Badge variant="secondary">{selectedJob.experienceLevel}</Badge>}
                  {selectedJob.industry && <Badge variant="secondary">{selectedJob.industry}</Badge>}
                  {selectedJob.salaryRaw && <Badge variant="secondary" className="text-emerald-700 bg-emerald-50">{selectedJob.salaryRaw}</Badge>}
                </div>

                {/* Skills */}
                {selectedJob.skills?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.skills.map(s => (
                        <span key={s.name} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{s.canonical || s.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sources */}
                {selectedJob.sources?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sources</p>
                    <div className="flex gap-2">
                      {selectedJob.sources.map(s => (
                        <a key={s.slug} href={s.sourceUrl} target="_blank" rel="noopener" className="text-xs text-indigo-600 hover:underline">{s.name}</a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedJob.descriptionText && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{selectedJob.descriptionText}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { addToTracker({ job_id: selectedJob.id, title: selectedJob.title, company: selectedJob.company, url: selectedJob.url, location: selectedJob.location, source: selectedJob.sources?.[0]?.name || "Discover" }); setSelectedJobId(null) }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                  >
                    Save & Tailor
                  </button>
                  {selectedJob.url && (
                    <a href={selectedJob.url} target="_blank" rel="noopener" className="flex-1 py-2.5 rounded-xl border border-gray-200 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50">
                      Apply &nearr;
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
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
