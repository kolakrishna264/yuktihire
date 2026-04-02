"use client"

import { useState } from "react"
import { useAllJobs, useCreateJob, useUpdateJob, useDeleteJob } from "@/lib/hooks/useJobs"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { EmptyState } from "@/components/EmptyState"
import { Briefcase, Plus, X, ExternalLink, Trash2 } from "lucide-react"
import type { JobApplication, ApplicationStatus } from "@/types"

const COLUMNS: { id: ApplicationStatus; label: string; color: string }[] = [
  { id: "SAVED", label: "Saved", color: "bg-slate-100 dark:bg-slate-800" },
  { id: "APPLIED", label: "Applied", color: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "INTERVIEWING", label: "Interviewing", color: "bg-amber-50 dark:bg-amber-900/20" },
  { id: "OFFER", label: "Offer", color: "bg-emerald-50 dark:bg-emerald-900/20" },
  { id: "REJECTED", label: "Rejected", color: "bg-red-50 dark:bg-red-900/20" },
]

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  SAVED: "secondary",
  APPLIED: "default",
  INTERVIEWING: "warning",
  OFFER: "success",
  REJECTED: "danger",
}

export default function JobsPage() {
  const { data: jobs = [], isLoading } = useAllJobs()
  const { mutate: createJob, isPending: creating } = useCreateJob()
  const { mutate: updateJob } = useUpdateJob()
  const { mutate: deleteJob } = useDeleteJob()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: "", company: "", url: "" })

  const handleAdd = () => {
    if (!form.title || !form.company) return
    createJob(
      { title: form.title, company: form.company, url: form.url || undefined, status: "SAVED" },
      { onSuccess: () => { setForm({ title: "", company: "", url: "" }); setShowAdd(false) } }
    )
  }

  const jobsByStatus = COLUMNS.reduce<Record<string, JobApplication[]>>((acc, col) => {
    acc[col.id] = jobs.filter((j) => j.status === col.id)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your applications across the pipeline
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" />
          Add Job
        </Button>
      </div>

      {/* Add job form */}
      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Add Job</p>
              <button onClick={() => setShowAdd(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Job title *"
                className="flex-1 min-w-[160px]"
              />
              <Input
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                placeholder="Company *"
                className="flex-1 min-w-[160px]"
              />
              <Input
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                placeholder="Job URL (optional)"
                className="flex-1 min-w-[200px]"
              />
              <Button loading={creating} disabled={!form.title || !form.company} onClick={handleAdd}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="w-64 shrink-0 space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
          ))}
        </div>
      ) : jobs.length === 0 && !showAdd ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs tracked yet"
          description="Add jobs to track your application progress across the pipeline"
          actionLabel="Add Your First Job"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colJobs = jobsByStatus[col.id] ?? []
            return (
              <div key={col.id} className="w-72 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary">{colJobs.length}</Badge>
                </div>

                <div className={`rounded-xl p-3 min-h-[200px] space-y-2 ${col.color}`}>
                  {colJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      columns={COLUMNS}
                      onStatusChange={(status) => updateJob({ id: job.id, data: { status } })}
                      onDelete={() => deleteJob(job.id)}
                    />
                  ))}
                  {colJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No jobs here
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function JobCard({
  job,
  columns,
  onStatusChange,
  onDelete,
}: {
  job: JobApplication
  columns: typeof COLUMNS
  onStatusChange: (status: ApplicationStatus) => void
  onDelete: () => void
}) {
  const [showMove, setShowMove] = useState(false)

  return (
    <div className="bg-card rounded-xl border border-border p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{job.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
        </div>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive transition-colors p-0.5 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {job.url && (
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-primary flex items-center gap-1 mt-1.5 hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          View posting
        </a>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setShowMove(!showMove)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            Move to…
          </button>
          {showMove && (
            <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[140px] z-10">
              {columns
                .filter((c) => c.id !== job.status)
                .map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent rounded-md transition-colors"
                    onClick={() => { onStatusChange(c.id); setShowMove(false) }}
                  >
                    {c.label}
                  </button>
                ))}
            </div>
          )}
        </div>
        <Badge variant={(STATUS_BADGE[job.status] as any) ?? "secondary"}>
          {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
        </Badge>
      </div>
    </div>
  )
}
