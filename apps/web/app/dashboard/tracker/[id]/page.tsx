"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  useTrackerDetail,
  useUpdateTracker,
  useChangeStage,
  useAddEvent,
  useDeleteEvent,
  useDeleteTracked,
} from "@/lib/hooks/useTracker"
import type { PipelineStage, ApplicationEvent } from "@/types"
import {
  ArrowLeft,
  Trash2,
  ExternalLink,
  MapPin,
  Briefcase,
  Building2,
  DollarSign,
  Calendar,
  FileText,
  MessageSquare,
  Phone,
  Clock,
  Plus,
  X,
  Loader2,
  Star,
  Tag,
} from "lucide-react"

const ALL_STAGES: { key: PipelineStage; label: string; color: string; activeColor: string }[] = [
  { key: "INTERESTED", label: "Interested", color: "bg-gray-100 text-gray-600", activeColor: "bg-gray-700 text-white" },
  { key: "SHORTLISTED", label: "Shortlisted", color: "bg-blue-50 text-blue-600", activeColor: "bg-blue-600 text-white" },
  { key: "RESUME_TAILORED", label: "Resume Tailored", color: "bg-violet-50 text-violet-600", activeColor: "bg-violet-600 text-white" },
  { key: "APPLIED", label: "Applied", color: "bg-indigo-50 text-indigo-600", activeColor: "bg-indigo-600 text-white" },
  { key: "INTERVIEWING", label: "Interviewing", color: "bg-amber-50 text-amber-600", activeColor: "bg-amber-600 text-white" },
  { key: "OFFER", label: "Offer", color: "bg-emerald-50 text-emerald-600", activeColor: "bg-emerald-600 text-white" },
  { key: "REJECTED", label: "Rejected", color: "bg-red-50 text-red-600", activeColor: "bg-red-600 text-white" },
]

const EVENT_TYPES = [
  { value: "NOTE", label: "Note" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "OTHER", label: "Other" },
]

function getEventIcon(type: string) {
  switch (type) {
    case "NOTE":
      return <MessageSquare className="w-3.5 h-3.5" />
    case "INTERVIEW_SCHEDULED":
      return <Phone className="w-3.5 h-3.5" />
    case "FOLLOW_UP":
      return <Clock className="w-3.5 h-3.5" />
    case "STAGE_CHANGE":
      return <Tag className="w-3.5 h-3.5" />
    default:
      return <FileText className="w-3.5 h-3.5" />
  }
}

// ── Skeleton ─────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-pulse">
      <div className="h-5 w-20 bg-gray-200 rounded mb-6" />
      <div className="h-8 w-80 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-40 bg-gray-200 rounded mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function TrackerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: job, isLoading, error } = useTrackerDetail(id)
  const updateMutation = useUpdateTracker()
  const changeStageMutation = useChangeStage()
  const addEventMutation = useAddEvent()
  const deleteEventMutation = useDeleteEvent()
  const deleteMutation = useDeleteTracked()

  const [notes, setNotes] = useState<string | null>(null)
  const [notesDirty, setNotesDirty] = useState(false)
  const [eventForm, setEventForm] = useState({ type: "NOTE", title: "", description: "" })
  const [showEventForm, setShowEventForm] = useState(false)

  // Sync notes from server
  const currentNotes = notesDirty ? (notes ?? "") : (job?.notes ?? "")

  if (isLoading) return <DetailSkeleton />

  if (error || !job) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-gray-700 mb-2">Job not found</p>
          <p className="text-sm text-gray-400 mb-4">This tracked job may have been deleted.</p>
          <Link
            href="/dashboard/tracker"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            &larr; Back to Tracker
          </Link>
        </div>
      </div>
    )
  }

  const handleSaveNotes = () => {
    updateMutation.mutate(
      { id: job.id, data: { notes: notes ?? "" } },
      { onSuccess: () => setNotesDirty(false) }
    )
  }

  const handleStageChange = (stage: PipelineStage) => {
    if (stage !== job.pipelineStage) {
      changeStageMutation.mutate({ id: job.id, stage })
    }
  }

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventForm.title.trim()) return
    addEventMutation.mutate(
      {
        trackerId: job.id,
        data: {
          event_type: eventForm.type,
          title: eventForm.title.trim(),
          description: eventForm.description.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setEventForm({ type: "NOTE", title: "", description: "" })
          setShowEventForm(false)
        },
      }
    )
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this tracked job?")) {
      deleteMutation.mutate(job.id, {
        onSuccess: () => router.push("/dashboard/tracker"),
      })
    }
  }

  const events = job.events ?? []

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/tracker"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tracker
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{job.company}</p>
      </div>

      {/* Stage pills */}
      <div className="flex flex-wrap gap-1.5 mb-8">
        {ALL_STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => handleStageChange(s.key)}
            disabled={changeStageMutation.isPending}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              job.pipelineStage === s.key ? s.activeColor : s.color + " hover:opacity-80"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {job.location && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {job.location}
                </div>
              )}
              {job.salary && (
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  {job.salary}
                </div>
              )}
              {job.workType && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  {job.workType}
                </div>
              )}
              {job.experienceLevel && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Star className="w-4 h-4 text-gray-400" />
                  {job.experienceLevel}
                </div>
              )}
              {job.industry && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {job.industry}
                </div>
              )}
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Job Posting
                </a>
              )}
            </div>
            {job.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {job.description.length > 300
                    ? job.description.slice(0, 300) + "..."
                    : job.description}
                </p>
              </div>
            )}
          </div>

          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Notes</h2>
            <textarea
              value={currentNotes}
              onChange={(e) => {
                setNotes(e.target.value)
                setNotesDirty(true)
              }}
              placeholder="Add notes about this application..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
            {notesDirty && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Notes"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Quick Info</h2>
            <dl className="space-y-3 text-sm">
              {job.source && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Source</dt>
                  <dd className="text-gray-700 font-medium">{job.source}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-400">Added</dt>
                <dd className="text-gray-700">{new Date(job.createdAt).toLocaleDateString()}</dd>
              </div>
              {job.appliedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Applied</dt>
                  <dd className="text-gray-700">{new Date(job.appliedAt).toLocaleDateString()}</dd>
                </div>
              )}
              {job.resumeUsed && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Resume</dt>
                  <dd className="text-gray-700 truncate max-w-[150px]">{job.resumeUsed}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-400">Priority</dt>
                <dd className="text-gray-700">{job.priority ?? 0}</dd>
              </div>
            </dl>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-800">Timeline</h2>
              <button
                onClick={() => setShowEventForm((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {/* Add event form */}
            {showEventForm && (
              <form onSubmit={handleAddEvent} className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Title *"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  required
                />
                <textarea
                  placeholder="Description (optional)"
                  value={eventForm.description}
                  onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEventForm(false)}
                    className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addEventMutation.isPending}
                    className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {addEventMutation.isPending ? "Adding..." : "Add Event"}
                  </button>
                </div>
              </form>
            )}

            {/* Events list */}
            {events.length === 0 && !showEventForm && (
              <p className="text-xs text-gray-400 text-center py-4">No events yet</p>
            )}
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex gap-2.5 group">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-500">
                    {getEventIcon(event.eventType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {event.title && (
                      <p className="text-xs font-semibold text-gray-700">{event.title}</p>
                    )}
                    {event.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
                    )}
                    {!event.title && !event.description && event.newValue && (
                      <p className="text-xs text-gray-500">
                        Stage changed to <span className="font-medium">{event.newValue}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-1">
                      {new Date(event.eventDate ?? event.createdAt).toLocaleDateString()} &middot;{" "}
                      {event.eventType.replace(/_/g, " ")}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      deleteEventMutation.mutate({ trackerId: job.id, eventId: event.id })
                    }
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all shrink-0"
                    title="Delete event"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
