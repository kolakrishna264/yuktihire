"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  useTrackerKanban,
  useChangeStage,
  useDeleteTracked,
  useArchiveTracked,
  useAddToTracker,
  useBulkStageChange,
  useBulkArchive,
  useBulkDelete,
} from "@/lib/hooks/useTracker"
import type { TrackedJob, PipelineStage, KanbanData } from "@/types"
import {
  Plus,
  X,
  ChevronDown,
  Kanban,
  List,
  Loader2,
  MapPin,
  ExternalLink,
  Trash2,
  Archive,
  Search,
} from "lucide-react"

const VISIBLE_STAGES: { key: PipelineStage; label: string; color: string }[] = [
  { key: "INTERESTED", label: "Interested", color: "bg-gray-100 text-gray-700" },
  { key: "SHORTLISTED", label: "Shortlisted", color: "bg-blue-100 text-blue-700" },
  { key: "RESUME_TAILORED", label: "Resume Tailored", color: "bg-violet-100 text-violet-700" },
  { key: "APPLIED", label: "Applied", color: "bg-indigo-100 text-indigo-700" },
  { key: "INTERVIEWING", label: "Interviewing", color: "bg-amber-100 text-amber-700" },
  { key: "OFFER", label: "Offer", color: "bg-emerald-100 text-emerald-700" },
  { key: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-700" },
]

const STAGE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  VISIBLE_STAGES.map((s) => [s.key, s.color])
)

const COMPANY_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
]

function getCompanyColor(company: string) {
  let hash = 0
  for (let i = 0; i < company.length; i++) {
    hash = company.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COMPANY_COLORS[Math.abs(hash) % COMPANY_COLORS.length]
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])
  return matches
}

// ── Add Job Form ─────────────────────────────────────────────────────────

function AddJobForm({ onClose }: { onClose: () => void }) {
  const addMutation = useAddToTracker()
  const [form, setForm] = useState({ title: "", company: "", url: "", location: "" })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.company.trim()) return
    addMutation.mutate(
      {
        title: form.title.trim(),
        company: form.company.trim(),
        url: form.url.trim() || undefined,
        location: form.location.trim() || undefined,
        source: "manual",
      },
      {
        onSuccess: () => {
          setForm({ title: "", company: "", url: "", location: "" })
          onClose()
        },
      }
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Add Job Manually</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          placeholder="Job Title *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          required
        />
        <input
          placeholder="Company *"
          value={form.company}
          onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          required
        />
        <input
          placeholder="URL"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        />
        <input
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        />
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {addMutation.isPending ? "Adding..." : "Add Job"}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Job Card ─────────────────────────────────────────────────────────────

function JobCard({
  job,
  onStageChange,
  selected,
  onToggleSelect,
}: {
  job: TrackedJob
  onStageChange: (id: string, stage: PipelineStage) => void
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const router = useRouter()

  return (
    <div
      onClick={() => router.push(`/dashboard/tracker/${job.id}`)}
      className="bg-white rounded-lg border border-gray-100 p-3 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-start gap-2.5">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 mt-1"
          />
        )}
        <div
          className={`w-8 h-8 rounded-full ${getCompanyColor(job.company)} flex items-center justify-center shrink-0`}
        >
          <span className="text-xs font-bold text-white">
            {job.company?.[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{job.title}</p>
          <p className="text-xs text-gray-500 truncate">{job.company}</p>
          {job.location && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {job.location}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5 gap-2">
        {job.source && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
            {job.source}
          </span>
        )}
        <select
          value={job.pipelineStage}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation()
            onStageChange(job.id, e.target.value as PipelineStage)
          }}
          className="text-[11px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 ml-auto"
        >
          {VISIBLE_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="min-w-[280px] max-w-[320px] bg-gray-50/50 rounded-xl p-3 animate-pulse">
          <div className="h-5 w-24 bg-gray-200 rounded mb-3" />
          {Array.from({ length: 3 - i % 2 }).map((_, j) => (
            <div key={j} className="bg-white rounded-lg border border-gray-100 p-3 mb-2">
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
                  <div className="h-3 w-1/2 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── List View ────────────────────────────────────────────────────────────

function ListView({
  data,
  onStageChange,
  selectedIds,
  onToggleSelect,
  searchFilter,
}: {
  data: KanbanData
  onStageChange: (id: string, stage: PipelineStage) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  searchFilter: string
}) {
  const router = useRouter()
  const allJobs = VISIBLE_STAGES.flatMap((s) => data.stages[s.key]?.jobs ?? []).filter(j =>
    !searchFilter || j.title.toLowerCase().includes(searchFilter.toLowerCase()) || j.company.toLowerCase().includes(searchFilter.toLowerCase())
  )

  if (allJobs.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="px-4 py-3 w-8"></th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {allJobs.map((job) => {
            const stageInfo = VISIBLE_STAGES.find((s) => s.key === job.pipelineStage)
            return (
              <tr
                key={job.id}
                onClick={() => router.push(`/dashboard/tracker/${job.id}`)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(job.id)}
                    onChange={() => onToggleSelect(job.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full ${getCompanyColor(job.company)} flex items-center justify-center shrink-0`}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {job.company?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <span className="text-gray-700 font-medium truncate max-w-[150px]">{job.company}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-800 font-medium truncate max-w-[200px]">{job.title}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageInfo?.color ?? "bg-gray-100 text-gray-600"}`}>
                    {stageInfo?.label ?? job.pipelineStage}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(job.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={job.pipelineStage}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation()
                      onStageChange(job.id, e.target.value as PipelineStage)
                    }}
                    className="text-xs px-2 py-1 rounded border border-gray-200 bg-white text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    {VISIBLE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const { data, isLoading } = useTrackerKanban()
  const changeStageMutation = useChangeStage()
  const { mutate: bulkStageChange } = useBulkStageChange()
  const { mutate: bulkArchive } = useBulkArchive()
  const { mutate: bulkDelete } = useBulkDelete()
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchFilter, setSearchFilter] = useState("")

  // Selection state for bulk ops
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = (jobs: TrackedJob[]) => setSelectedIds(new Set(jobs.map(j => j.id)))
  const clearSelection = () => setSelectedIds(new Set())

  // Auto-switch to list on mobile
  useEffect(() => {
    if (isMobile) setViewMode("list")
  }, [isMobile])

  const handleStageChange = (id: string, stage: PipelineStage) => {
    changeStageMutation.mutate({ id, stage })
  }

  const isEmpty =
    data && VISIBLE_STAGES.every((s) => (data.stages[s.key]?.count ?? 0) === 0)

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your job pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "kanban"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          {/* Add job button */}
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Job
          </button>
        </div>
      </div>

      {/* Add job form */}
      {showAddForm && <AddJobForm onClose={() => setShowAddForm(false)} />}

      {/* Search filter */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Filter jobs by title or company..."
          className="w-full h-10 rounded-xl border border-gray-200 bg-white pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm"
        />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl mb-4">
          <span className="text-sm font-medium text-indigo-700">{selectedIds.size} selected</span>
          <select
            onChange={e => {
              if (e.target.value) {
                bulkStageChange({ ids: Array.from(selectedIds), stage: e.target.value as PipelineStage })
                clearSelection()
              }
            }}
            className="text-xs border border-indigo-200 rounded-lg px-2 py-1"
            defaultValue=""
          >
            <option value="" disabled>Move to...</option>
            {VISIBLE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button onClick={() => { bulkArchive(Array.from(selectedIds)); clearSelection() }} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Archive</button>
          <button onClick={() => { bulkDelete(Array.from(selectedIds)); clearSelection() }} className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
          <button onClick={clearSelection} className="ml-auto text-xs text-gray-500">Clear</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && <KanbanSkeleton />}

      {/* Empty state */}
      {!isLoading && isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <Kanban className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-lg font-semibold text-gray-700 mb-1">No tracked jobs yet</p>
          <p className="text-sm text-gray-400 max-w-sm mb-4">
            Discover jobs to start building your pipeline.
          </p>
          <Link
            href="/dashboard/discover"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Go to Discover &rarr;
          </Link>
        </div>
      )}

      {/* Kanban view */}
      {!isLoading && data && !isEmpty && viewMode === "kanban" && (
        <div className="overflow-x-auto flex gap-4 pb-4">
          {VISIBLE_STAGES.map((stage) => {
            const stageData = data.stages[stage.key]
            const stageJobs = stageData?.jobs ?? []
            const filteredJobs = stageJobs.filter(j =>
              !searchFilter || j.title.toLowerCase().includes(searchFilter.toLowerCase()) || j.company.toLowerCase().includes(searchFilter.toLowerCase())
            )
            const count = filteredJobs.length
            return (
              <div
                key={stage.key}
                className="min-w-[280px] max-w-[320px] bg-gray-50/50 rounded-xl p-3 flex flex-col shrink-0"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stage.color}`}>
                    {stage.label}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">{count}</span>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                  {filteredJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onStageChange={handleStageChange}
                      selected={selectedIds.has(job.id)}
                      onToggleSelect={() => toggleSelect(job.id)}
                    />
                  ))}
                  {filteredJobs.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-6">No jobs</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* List view */}
      {!isLoading && data && !isEmpty && viewMode === "list" && (
        <ListView data={data} onStageChange={handleStageChange} selectedIds={selectedIds} onToggleSelect={toggleSelect} searchFilter={searchFilter} />
      )}
    </div>
  )
}
