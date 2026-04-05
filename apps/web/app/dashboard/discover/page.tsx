"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { Search, MapPin, ExternalLink, Bookmark, BookmarkCheck, Wand2, Briefcase } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function DiscoverPage() {
  const [search, setSearch] = useState("")
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set())
  const qc = useQueryClient()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["discover-jobs", search],
    queryFn: () => apiFetch(`/job-board?search=${encodeURIComponent(search)}&limit=30`).catch(() => []),
  })

  // Load saved URLs to show "Already Saved" badges
  useQuery({
    queryKey: ["saved-urls"],
    queryFn: async () => {
      const data = await apiFetch("/applications/saved-urls")
      setSavedUrls(new Set(data?.urls || []))
      return data
    },
  })

  const saveJob = useMutation({
    mutationFn: (job: any) => apiFetch("/tracker", {
      method: "POST",
      body: JSON.stringify({
        title: job.title,
        company: job.company,
        url: job.url,
        location: job.location,
        description: job.description_text || job.description || "",
        work_type: job.work_type || job.workType,
        experience_level: job.experience_level || job.experienceLevel,
        source: "discover",
      }),
    }),
    onSuccess: (_, job) => {
      toast.success(`Saved: ${job.title} at ${job.company}`)
      setSavedUrls(prev => new Set([...prev, job.url]))
      qc.invalidateQueries({ queryKey: ["tracker"] })
    },
    onError: (err: any) => {
      if (err.message?.includes("409") || err.message?.includes("already")) {
        toast.info("Job already saved")
      } else {
        toast.error("Failed to save job")
      }
    },
  })

  const jobList = Array.isArray(jobs) ? jobs : (jobs?.jobs || [])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discover Jobs</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse job listings from multiple sources</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, company, or skill..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : jobList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Briefcase className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No jobs found</p>
            <p className="text-xs text-muted-foreground mt-1">Try a different search or check back later</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {jobList.map((job: any) => {
            const isSaved = savedUrls.has(job.url)
            return (
              <Card key={job.id || job.url} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{job.title}</p>
                      <p className="text-xs text-muted-foreground">{job.company}</p>
                    </div>
                    {isSaved && (
                      <Badge className="bg-emerald-50 text-emerald-700 text-[9px] shrink-0 ml-2">Saved</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                    {(job.work_type || job.workType) && <Badge variant="secondary" className="text-[9px]">{job.work_type || job.workType}</Badge>}
                    {(job.experience_level || job.experienceLevel) && <Badge variant="secondary" className="text-[9px]">{job.experience_level || job.experienceLevel}</Badge>}
                  </div>

                  {(job.description_text || job.description) && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {(job.description_text || job.description || "").slice(0, 150)}...
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    {!isSaved ? (
                      <Button variant="outline" size="sm" className="text-xs flex-1"
                        onClick={() => saveJob.mutate(job)}
                        disabled={saveJob.isPending}>
                        <Bookmark className="w-3 h-3" /> Save & Track
                      </Button>
                    ) : (
                      <Link href="/dashboard/jobs" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          <BookmarkCheck className="w-3 h-3" /> View in My Jobs
                        </Button>
                      </Link>
                    )}
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="text-xs">
                          <ExternalLink className="w-3 h-3" /> Apply
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
