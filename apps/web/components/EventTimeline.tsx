"use client"

import { useState } from "react"
import { cn } from "@/lib/utils/cn"
import { Badge } from "@/components/ui/Badge"
import {
  Bookmark, Send, FileCheck, Phone, Calendar, MessageSquare,
  Award, XCircle, Archive, Clock, Trash2, Plus
} from "lucide-react"
import type { ApplicationEvent } from "@/types"

const EVENT_ICONS: Record<string, typeof Bookmark> = {
  status_change: Send,
  note: MessageSquare,
  interview: Calendar,
  follow_up: Phone,
  offer: Award,
  rejection: XCircle,
  archived: Archive,
}

const EVENT_COLORS: Record<string, string> = {
  status_change: "bg-indigo-100 text-indigo-600",
  note: "bg-gray-100 text-gray-600",
  interview: "bg-amber-100 text-amber-600",
  follow_up: "bg-blue-100 text-blue-600",
  offer: "bg-emerald-100 text-emerald-600",
  rejection: "bg-red-100 text-red-600",
  archived: "bg-gray-100 text-gray-500",
}

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return `Today at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
}

interface EventTimelineProps {
  events: ApplicationEvent[]
  onDelete?: (eventId: string) => void
  onAdd?: (data: { event_type: string; title: string; description?: string }) => void
  showAddForm?: boolean
}

export function EventTimeline({ events, onDelete, onAdd, showAddForm = true }: EventTimelineProps) {
  const [adding, setAdding] = useState(false)
  const [formType, setFormType] = useState("note")
  const [formTitle, setFormTitle] = useState("")
  const [formDesc, setFormDesc] = useState("")

  const handleAdd = () => {
    if (!formTitle.trim()) return
    onAdd?.({ event_type: formType, title: formTitle, description: formDesc || undefined })
    setFormTitle("")
    setFormDesc("")
    setAdding(false)
  }

  return (
    <div className="space-y-0">
      {/* Add event button */}
      {showAddForm && (
        <div className="mb-4">
          {adding ? (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
              <select
                value={formType}
                onChange={e => setFormType(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="note">Note</option>
                <option value="interview">Interview Scheduled</option>
                <option value="follow_up">Follow-up</option>
                <option value="status_change">Status Update</option>
              </select>
              <input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="What happened?"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
              <textarea
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Details (optional)"
                rows={2}
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 resize-none"
              />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Add Event</button>
                <button onClick={() => setAdding(false)} className="text-xs font-medium py-1.5 px-3 rounded-lg border text-gray-500">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Plus className="w-3 h-3" />
              Add event
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      {events.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No events yet</p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />

          {events.map((event, i) => {
            const Icon = EVENT_ICONS[event.eventType] || Clock
            const colorClass = EVENT_COLORS[event.eventType] || "bg-gray-100 text-gray-500"

            return (
              <div key={event.id} className="relative flex gap-3 pb-4 group">
                {/* Icon dot */}
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10", colorClass)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{event.title || event.eventType.replace(/_/g, " ")}</p>
                      {event.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{event.description}</p>
                      )}
                      {event.eventType === "status_change" && event.oldValue && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[10px]">{event.oldValue.replace(/_/g, " ")}</Badge>
                          <span className="text-[10px] text-gray-400">&rarr;</span>
                          <Badge className="text-[10px] bg-indigo-100 text-indigo-700">{(event.newValue || "").replace(/_/g, " ")}</Badge>
                        </div>
                      )}
                    </div>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(event.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{formatEventDate(event.eventDate || event.createdAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
