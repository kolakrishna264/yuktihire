"use client"

import { useState, useRef, Fragment } from "react"
import { useAllJobs, useCreateJob, useUpdateJob, useDeleteJob } from "@/lib/hooks/useJobs"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Skeleton } from "@/components/ui/Skeleton"
import { EmptyState } from "@/components/EmptyState"
import {
  Briefcase, Plus, X, ExternalLink, Trash2,
  ChevronDown, MapPin, DollarSign, StickyNote,
  Calendar, Building2, Link as LinkIcon,
} from "lucide-react"
import type { JobApplication, ApplicationStatus } from "@/types"
import { formatDate } from "@/lib/utils/format"

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: {
  id: ApplicationStatus
  label: string
  colBg: string
  headerColor: string
  dotColor: string
}[] = [
  {
    id: "SAVED",
    label: "Saved",
    colBg: "bg-slate-50 dark:bg-slate-800/40",
    headerColor: "text-slate-600 dark:text-slate-300",
    dotColor: "bg-slate-400",
  },
  {
    id: "APPLIED",
    label: "Applied",
    colBg: "bg-blue-50/60 dark:bg-blue-900/20",
    headerColor: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  {
    id: "INTERVIEWING",
    label: "Interviewing",
    colBg: "bg-amber-50/60 dark:bg-amber-900/20",
    headerColor: "text-amber-600 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  {
    id: "OFFER",
    label: "Offer",
    colBg: "bg-emerald-50/60 dark:bg-emerald-900/20",
    headerColor: "text-emerald-600 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  {
    id: "REJECTED",
    label: "Rejected",
    colBg: "bg-red-50/60 dark:bg-red-900/20",
    headerColor: "text-red-500 dark:text-red-400",
    dotColor: "bg-red-500",
  },
]

const STATUS_BADGE: Record<ApplicationStatus, "secondary" | "default" | "warning" | "success" | "danger"> = {
  SAVED: "secondary",
  APPLIED: "default",
  INTERVIEWING: "warning",
  OFFER: "success",
  REJECTED: "danger",
}

// ── Empty job form ────────────────────────────────────────────────────────────

type JobForm = {
  title: string
  company: string
  url: string
  location: string
  salary: string
  status: ApplicationStatus
  notes: string
}

const EMPTY_FORM: JobForm = {
  title: "",
  company: "",
  url: "",
  location: "",
  salary: "",
  status: "SAVED",
  notes: "",
}

// ── Tiny date formatter: "Mar 15" ─────────────────────────────────────────────

function shortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const { data: jobs = [], isLoading } = useAllJobs()
  const { mutate: createJob, isPending: creating } = useCreateJob()
  const { mutate: updateJob } = useUpdateJob()
  const { mutate: deleteJob } = useDeleteJob()

  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | "ALL">("ALL")
  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; job: JobApplication }
    | null
  >(null)
  const [form, setForm] = useState<JobForm>(EMPTY_FORM)

  // Drag-and-drop state
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  // Ref used to avoid flickering when pointer moves over child elements
  const dragEnterCounters = useRef<Record<string, number>>({})

  const openCreate = (defaultStatus: ApplicationStatus = "SAVED") => {
    setForm({ ...EMPTY_FORM, status: defaultStatus })
    setModal({ mode: "create" })
  }

  const openEdit = (job: JobApplication) => {
    setForm({
      title: job.title,
      company: job.company,
      url: job.url ?? "",
      location: (job as any).location ?? "",
      salary: (job as any).salary ?? "",
      status: job.status,
      notes: job.notes ?? "",
    })
    setModal({ mode: "edit", job })
  }

  const closeModal = () => {
    setModal(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = () => {
    if (!form.title.trim() || !form.company.trim()) return
    const payload = {
      title: form.title.trim(),
      company: form.company.trim(),
      url: form.url.trim() || undefined,
      location: form.location.trim() || undefined,
      salary: form.salary.trim() || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
    }
    if (modal?.mode === "create") {
      createJob(payload, { onSuccess: closeModal })
    } else if (modal?.mode === "edit") {
      updateJob({ id: modal.job.id, data: payload }, { onSuccess: closeModal })
    }
  }

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, jobId: string) => {
    e.dataTransfer.setData("jobId", jobId)
    e.dataTransfer.effectAllowed = "move"
    setDraggingJobId(jobId)
  }

  const handleDragEnd = () => {
    setDraggingJobId(null)
    setDragOverColumn(null)
    dragEnterCounters.current = {}
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, colId: string) => {
    e.preventDefault()
    dragEnterCounters.current[colId] = (dragEnterCounters.current[colId] ?? 0) + 1
    setDragOverColumn(colId)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, colId: string) => {
    dragEnterCounters.current[colId] = (dragEnterCounters.current[colId] ?? 1) - 1
    if (dragEnterCounters.current[colId] <= 0) {
      dragEnterCounters.current[colId] = 0
      setDragOverColumn((prev) => (prev === colId ? null : prev))
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: ApplicationStatus) => {
    e.preventDefault()
    const jobId = e.dataTransfer.getData("jobId")
    if (!jobId) return
    const job = jobs.find((j) => j.id === jobId)
    if (job && job.status !== newStatus) {
      updateJob({ id: jobId, data: { status: newStatus } })
    }
    setDragOverColumn(null)
    dragEnterCounters.current = {}
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const visibleJobs = filterStatus === "ALL"
    ? jobs
    : jobs.filter((j) => j.status === filterStatus)

  const jobsByStatus = COLUMNS.reduce<Record<string, JobApplication[]>>((acc, col) => {
    acc[col.id] = visibleJobs.filter((j) => j.status === col.id)
    return acc
  }, {})

  const totalByStatus = COLUMNS.reduce<Record<string, number>>((acc, col) => {
    acc[col.id] = jobs.filter((j) => j.status === col.id).length
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-6 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Job Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your applications across the pipeline
            </p>
          </div>
          <Button onClick={() => openCreate()}>
            <Plus className="w-4 h-4" />
            Add Job
          </Button>
        </div>

        {/* Status summary row */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={[
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
              filterStatus === "ALL"
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/30",
            ].join(" ")}
          >
            All
            <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {jobs.length}
            </span>
          </button>
          {COLUMNS.map((col) => (
            <button
              key={col.id}
              onClick={() => setFilterStatus(filterStatus === col.id ? "ALL" : col.id)}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
                filterStatus === col.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/30",
              ].join(" ")}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />
              {col.label}
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                {totalByStatus[col.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto px-6 pb-6 flex-1">
          {COLUMNS.map((col) => (
            <div key={col.id} className="w-72 shrink-0 space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-6 pb-6">
          <EmptyState
            icon={Briefcase}
            title="No jobs tracked yet"
            description="Add jobs to track your application progress across the pipeline"
            actionLabel="Add Your First Job"
            onAction={() => openCreate()}
          />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto px-6 pb-6 flex-1 min-h-0">
          {COLUMNS.map((col) => {
            const colJobs = jobsByStatus[col.id] ?? []
            const isOver = dragOverColumn === col.id
            return (
              <div key={col.id} className="w-72 shrink-0 flex flex-col min-h-0">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className={`text-sm font-semibold ${col.headerColor}`}>{col.label}</span>
                  <Badge variant="secondary" className="ml-auto">{colJobs.length}</Badge>
                  <button
                    onClick={() => openCreate(col.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md hover:bg-accent"
                    title={`Add to ${col.label}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Column body — drop target */}
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, col.id)}
                  onDragLeave={(e) => handleDragLeave(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={[
                    "flex-1 rounded-xl p-2.5 space-y-2 overflow-y-auto transition-colors duration-150",
                    col.colBg,
                    isOver ? "border-2 border-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/20" : "border-2 border-transparent",
                  ].join(" ")}
                >
                  {colJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <p className="text-xs text-muted-foreground text-center">No jobs here</p>
                      <button
                        onClick={() => openCreate(col.id)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        + Add one
                      </button>
                    </div>
                  ) : (
                    colJobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        columns={COLUMNS}
                        isDragging={draggingJobId === job.id}
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={handleDragEnd}
                        onEdit={() => openEdit(job)}
                        onStatusChange={(status) => updateJob({ id: job.id, data: { status } })}
                        onDelete={() => deleteJob(job.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <JobModal
          mode={modal.mode}
          form={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={handleSubmit}
          onClose={closeModal}
          isSubmitting={creating}
        />
      )}
    </div>
  )
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  columns,
  isDragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  job: JobApplication
  columns: typeof COLUMNS
  isDragging: boolean
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onEdit: () => void
  onStatusChange: (status: ApplicationStatus) => void
  onDelete: () => void
}) {
  const [showMove, setShowMove] = useState(false)

  const notesPreview = job.notes ? job.notes.slice(0, 60) + (job.notes.length > 60 ? "…" : "") : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={[
        "bg-card rounded-xl border border-border p-3 shadow-sm hover:shadow-md transition-all group",
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-grab",
      ].join(" ")}
    >
      {/* Top row: title + delete */}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onEdit}
          className="text-left min-w-0 flex-1 group/title"
        >
          <p className="text-sm font-semibold leading-tight truncate group-hover/title:text-primary transition-colors">
            {job.title}
          </p>
        </button>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors p-0.5 shrink-0 opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Company + applied date */}
      <div className="flex items-center justify-between gap-1 mt-1">
        <div className="flex items-center gap-1 min-w-0">
          <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground truncate">{job.company}</p>
        </div>
        {(job as any).createdAt && (
          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
            {shortDate((job as any).createdAt)}
          </span>
        )}
      </div>

      {/* Quick notes preview */}
      {notesPreview && (
        <p className="text-[11px] text-muted-foreground mt-1.5 italic leading-snug">
          {notesPreview}
        </p>
      )}

      {/* Location / salary snippets */}
      {((job as any).location || (job as any).salary) && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {(job as any).location && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="w-2.5 h-2.5" />
              {(job as any).location}
            </span>
          )}
          {(job as any).salary && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <DollarSign className="w-2.5 h-2.5" />
              {(job as any).salary}
            </span>
          )}
        </div>
      )}

      {/* Link */}
      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-primary flex items-center gap-1 mt-2 hover:underline w-fit"
        >
          <ExternalLink className="w-3 h-3" />
          View posting
        </a>
      )}

      {/* Footer: status + move */}
      <div className="mt-2.5 flex items-center justify-end gap-2 pt-2 border-t border-border/50">
        <div className="relative">
          <button
            onClick={() => setShowMove(!showMove)}
            className="flex items-center gap-0.5 transition-opacity hover:opacity-80"
          >
            <Badge variant={STATUS_BADGE[job.status]}>
              {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
            </Badge>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {showMove && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMove(false)}
              />
              <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[150px] z-20">
                {columns.map((c) => (
                  <button
                    key={c.id}
                    className={[
                      "w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2",
                      c.id === job.status
                        ? "bg-accent font-semibold"
                        : "hover:bg-accent",
                    ].join(" ")}
                    onClick={() => {
                      if (c.id !== job.status) onStatusChange(c.id)
                      setShowMove(false)
                    }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dotColor}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function JobModal({
  mode,
  form,
  onChange,
  onSubmit,
  onClose,
  isSubmitting,
}: {
  mode: "create" | "edit"
  form: JobForm
  onChange: (patch: Partial<JobForm>) => void
  onSubmit: () => void
  onClose: () => void
  isSubmitting: boolean
}) {
  const isValid = form.title.trim() && form.company.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">
            {mode === "create" ? "Add Job" : "Edit Job"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Role + Company */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Job Title <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="e.g. Software Engineer"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Company <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.company}
                onChange={(e) => onChange({ company: e.target.value })}
                placeholder="e.g. Google"
              />
            </div>
          </div>

          {/* Location + Salary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Location
              </label>
              <Input
                value={form.location}
                onChange={(e) => onChange({ location: e.target.value })}
                placeholder="e.g. Remote / NYC"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Salary / Range
              </label>
              <Input
                value={form.salary}
                onChange={(e) => onChange({ salary: e.target.value })}
                placeholder="e.g. $120k–$150k"
              />
            </div>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> Job Posting URL
            </label>
            <Input
              value={form.url}
              onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://..."
              type="url"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <div className="flex flex-wrap gap-2">
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onChange({ status: col.id })}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    form.status === col.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/40",
                  ].join(" ")}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor}`} />
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Notes
            </label>
            <Textarea
              value={form.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Interview notes, contact info, follow-up dates..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            loading={isSubmitting}
            disabled={!isValid}
          >
            {mode === "create" ? "Add Job" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
