"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import {
  Rss, Briefcase, ExternalLink, MapPin, Wand2, Bookmark,
  Search, SlidersHorizontal, Clock, Building, DollarSign, X, Plus,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function FeedPage() {
  const [search, setSearch] = useState("")
  const [workType, setWorkType] = useState("")
  const [page, setPage] = useState(1)
  const [showPrefs, setShowPrefs] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const queryClient = useQueryClient()

  const { data: feedData, isLoading } = useQuery({
    queryKey: ["feed", search, workType, page],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (workType) params.set("work_type", workType)
      params.set("page", String(page))
      return apiFetch(`/feed?${params.toString()}`)
    },
  })

  const { data: prefsData } = useQuery({
    queryKey: ["feed-prefs"],
    queryFn: () => apiFetch("/feed/preferences"),
  })

  const updatePrefs = useMutation({
    mutationFn: (prefs: any) => apiFetch("/feed/preferences", {
      method: "POST",
      body: JSON.stringify(prefs),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] })
      queryClient.invalidateQueries({ queryKey: ["feed-prefs"] })
      toast.success("Preferences updated")
    },
  })

  const prefs = prefsData?.preferences
  const jobs = feedData?.jobs || []
  const total = feedData?.total || 0
  const totalPages = feedData?.totalPages || 1

  const addTitle = () => {
    if (!newTitle.trim()) return
    const current = prefs?.preferredTitles || []
    if (current.includes(newTitle.trim())) return
    updatePrefs.mutate({ preferred_titles: [...current, newTitle.trim()] })
    setNewTitle("")
  }

  const removeTitle = (t: string) => {
    const current = prefs?.preferredTitles || []
    updatePrefs.mutate({ preferred_titles: current.filter((x: string) => x !== t) })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rss className="w-5 h-5 text-primary" />
            Job Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0 ? `${total} jobs matching your preferences` : "Set your preferences to see matched jobs"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPrefs(!showPrefs)}>
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Preferences
        </Button>
      </div>

      {/* Preferences Panel */}
      {showPrefs && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="font-semibold text-sm">Job Search Preferences</p>

            {/* Preferred titles */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Job Titles I'm Looking For
              </label>
              <div className="flex gap-2 flex-wrap mb-2">
                {(prefs?.preferredTitles || []).map((t: string) => (
                  <Badge key={t} variant="secondary" className="flex items-center gap-1">
                    {t}
                    <button onClick={() => removeTitle(t)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTitle()}
                  placeholder="e.g. ML Engineer, Data Scientist, AI Engineer..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button size="sm" variant="outline" onClick={addTitle}>
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            </div>

            {/* Work type */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Work Type
              </label>
              <div className="flex gap-2">
                {["", "remote", "hybrid", "onsite"].map(wt => (
                  <button
                    key={wt}
                    onClick={() => {
                      setWorkType(wt)
                      if (wt) updatePrefs.mutate({ preferred_work_types: [wt] })
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      workType === wt ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {wt || "All"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active filters */}
      {(prefs?.preferredTitles?.length > 0) && !showPrefs && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Matching:</span>
          {prefs.preferredTitles.map((t: string) => (
            <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search jobs by title, company, or keywords..."
          className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Jobs list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold mb-1">No jobs found</p>
            <p className="text-sm text-muted-foreground mb-4">
              {prefs?.preferredTitles?.length ? "Try adjusting your search or preferences" : "Add your preferred job titles to see matched jobs"}
            </p>
            <Button variant="outline" onClick={() => setShowPrefs(true)}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Set Preferences
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => (
            <Card key={job.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{job.title}</h3>
                      {job.sourceType === "curated" && (
                        <Badge variant="default" className="text-[9px] shrink-0">Curated</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {job.company}
                      </span>
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                      )}
                      {job.workType && (
                        <Badge variant="secondary" className="text-[9px]">{job.workType}</Badge>
                      )}
                      {job.salaryRange && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {job.salaryRange}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(job.postedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {job.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{job.description}</p>
                    )}
                    {job.skills && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {job.skills.split(",").slice(0, 5).map((s: string) => (
                          <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            {s.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        <Button size="xs" variant="outline" className="text-[10px]">
                          <ExternalLink className="w-3 h-3" />
                          View
                        </Button>
                      </a>
                    )}
                    <Link href={`/dashboard/tailor?jd=${encodeURIComponent(job.fullDescription || job.description || "")}&company=${encodeURIComponent(job.company)}&role=${encodeURIComponent(job.title)}`}>
                      <Button size="xs" className="text-[10px]">
                        <Wand2 className="w-3 h-3" />
                        Tailor
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
