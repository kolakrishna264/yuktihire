"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Rss, Briefcase, ExternalLink, MapPin, Wand2, Bookmark, Sparkles, Globe } from "lucide-react"
import Link from "next/link"

export default function FeedPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Job Feed</h1>
        <p className="text-sm text-muted-foreground mt-1">Jobs from your tracker, curated listings, and recommendations</p>
      </div>

      <SavedJobsSection />
      <RecommendedSection />
      <ComingSoonSection />
    </div>
  )
}

function SavedJobsSection() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["feed-saved"],
    queryFn: () => apiFetch("/tracker"),
  })

  if (isLoading) return <SectionSkeleton title="My Saved Jobs" />

  const savedJobs = (jobs || []).slice(0, 6)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold">My Saved Jobs</h2>
          <Badge variant="secondary" className="text-[10px]">{(jobs || []).length}</Badge>
        </div>
        <Link href="/dashboard/jobs">
          <Button variant="outline" size="sm" className="text-xs">View All</Button>
        </Link>
      </div>

      {savedJobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bookmark className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No saved jobs yet</p>
            <p className="text-xs text-muted-foreground mt-1">Save jobs from the extension or add them manually</p>
            <Link href="/dashboard/add-job">
              <Button size="sm" className="mt-3 text-xs">Add Your First Job</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {savedJobs.map((job: any) => (
            <JobCard key={job.id} job={job} type="saved" />
          ))}
        </div>
      )}
    </section>
  )
}

function RecommendedSection() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["feed-recommended"],
    queryFn: () => apiFetch("/job-board?limit=6").catch(() => []),
  })

  if (isLoading) return <SectionSkeleton title="Recommended Jobs" />

  const recJobs = Array.isArray(jobs) ? jobs.slice(0, 6) : (jobs?.jobs || []).slice(0, 6)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="text-lg font-semibold">Recommended</h2>
        </div>
        <Link href="/dashboard/discover">
          <Button variant="outline" size="sm" className="text-xs">Discover More</Button>
        </Link>
      </div>

      {recJobs.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Sparkles className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Recommendations coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">Complete your profile to get personalized job matches</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {recJobs.map((job: any) => (
            <JobCard key={job.id} job={job} type="discovered" />
          ))}
        </div>
      )}
    </section>
  )
}

function ComingSoonSection() {
  const integrations = [
    { name: "LinkedIn Jobs", icon: Globe, color: "text-blue-600 bg-blue-50", status: "Coming Soon" },
    { name: "Indeed", icon: Globe, color: "text-purple-600 bg-purple-50", status: "Coming Soon" },
    { name: "Glassdoor", icon: Globe, color: "text-emerald-600 bg-emerald-50", status: "Planned" },
    { name: "AngelList", icon: Globe, color: "text-orange-600 bg-orange-50", status: "Planned" },
  ]

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Rss className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">More Job Sources</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {integrations.map((int) => (
          <Card key={int.name} className="opacity-60">
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 rounded-lg ${int.color} flex items-center justify-center mx-auto mb-2`}>
                <int.icon className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium">{int.name}</p>
              <Badge variant="secondary" className="text-[9px] mt-1">{int.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// type: "saved" = from tracker (has tracker ID, shows Tailor button)
// type: "discovered" = from job board/recommended (shows Save button)
function JobCard({ job, type = "saved" }: { job: any; type?: "saved" | "discovered" }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{job.title || job.role || "Untitled"}</p>
            <p className="text-xs text-muted-foreground">{job.company || "Unknown"}</p>
          </div>
          {type === "saved" && job.pipelineStage && (
            <Badge variant="secondary" className="text-[9px] shrink-0 ml-2">{job.pipelineStage}</Badge>
          )}
        </div>
        {(job.location || job.workType) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {job.location && <><MapPin className="w-3 h-3" />{job.location}</>}
            {job.workType && <Badge variant="secondary" className="text-[9px]">{job.workType}</Badge>}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {type === "saved" ? (
            // Saved job → Tailor button linking to tracker
            <Link href={`/dashboard/tailor?tracker=${job.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <Wand2 className="w-3 h-3" /> Tailor
              </Button>
            </Link>
          ) : (
            // Discovered job → link to discover page to save it
            <Link href="/dashboard/discover" className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs">
                <Bookmark className="w-3 h-3" /> Save & Track
              </Button>
            </Link>
          )}
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-xs">
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="grid md:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    </section>
  )
}
