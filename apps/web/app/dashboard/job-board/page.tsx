"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { useCreateJob } from "@/lib/hooks/useJobs"
import type { JobBoardItem } from "@/types"

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_JOBS: JobBoardItem[] = [
  {
    id: "1",
    title: "Software Engineer",
    company: "Westinghouse Electric",
    location: "Warrendale, PA, US",
    postedDate: "Apr 2, 2026",
    workType: "On-site",
    employmentType: "Full-time",
    experienceLevel: "0-3 years",
    salaryRange: "$80k-$120k",
    industry: "Energy",
    skills: ["C/C++ programming", "writing specifications", "test procedures", "user's guides", "test reports"],
    url: "https://example.com/job/1",
  },
  {
    id: "2",
    title: "Frontend Developer",
    company: "Stripe",
    location: "San Francisco, CA, US",
    postedDate: "Apr 1, 2026",
    workType: "Remote",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$140k-$190k",
    industry: "FinTech",
    skills: ["React", "TypeScript", "CSS", "GraphQL", "Performance Optimization"],
    url: "https://example.com/job/2",
  },
  {
    id: "3",
    title: "Data Scientist",
    company: "UnitedHealth Group",
    location: "Minneapolis, MN, US",
    postedDate: "Apr 2, 2026",
    workType: "Hybrid",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$110k-$160k",
    industry: "Healthcare",
    skills: ["Python", "Machine Learning", "SQL", "Tableau", "Statistical Modeling"],
    url: "https://example.com/job/3",
  },
  {
    id: "4",
    title: "DevOps Engineer",
    company: "Lemonade",
    location: "New York, NY, US",
    postedDate: "Mar 31, 2026",
    workType: "Remote",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$130k-$170k",
    industry: "Insurtech",
    skills: ["AWS", "Terraform", "Docker", "Kubernetes", "CI/CD"],
    url: "https://example.com/job/4",
  },
  {
    id: "5",
    title: "Product Manager",
    company: "Shopify",
    location: "Toronto, ON, CA",
    postedDate: "Mar 30, 2026",
    workType: "Remote",
    employmentType: "Full-time",
    experienceLevel: "5+ years",
    salaryRange: "$150k-$200k",
    industry: "E-commerce",
    skills: ["Product Strategy", "A/B Testing", "SQL", "Agile", "User Research"],
    url: "https://example.com/job/5",
  },
  {
    id: "6",
    title: "Backend Engineer",
    company: "Plaid",
    location: "San Francisco, CA, US",
    postedDate: "Apr 1, 2026",
    workType: "Hybrid",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$150k-$195k",
    industry: "FinTech",
    skills: ["Go", "Python", "PostgreSQL", "gRPC", "Microservices"],
    url: "https://example.com/job/6",
  },
  {
    id: "7",
    title: "UX Designer",
    company: "Epic Games",
    location: "Cary, NC, US",
    postedDate: "Mar 29, 2026",
    workType: "On-site",
    employmentType: "Full-time",
    experienceLevel: "1+ years",
    salaryRange: "$80k-$120k",
    industry: "Gaming",
    skills: ["Figma", "User Research", "Prototyping", "Design Systems", "Accessibility"],
    url: "https://example.com/job/7",
  },
  {
    id: "8",
    title: "Machine Learning Engineer",
    company: "Tempus AI",
    location: "Chicago, IL, US",
    postedDate: "Apr 2, 2026",
    workType: "Hybrid",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$140k-$185k",
    industry: "Healthcare",
    skills: ["PyTorch", "TensorFlow", "Python", "NLP", "Computer Vision"],
    url: "https://example.com/job/8",
  },
  {
    id: "9",
    title: "Cloud Architect",
    company: "Snowflake",
    location: "Bozeman, MT, US",
    postedDate: "Mar 28, 2026",
    workType: "Remote",
    employmentType: "Full-time",
    experienceLevel: "5+ years",
    salaryRange: "$180k-$250k",
    industry: "Cloud Computing",
    skills: ["AWS", "Azure", "System Design", "Security", "Cost Optimization"],
    url: "https://example.com/job/9",
  },
  {
    id: "10",
    title: "QA Automation Engineer",
    company: "Allstate",
    location: "Northbrook, IL, US",
    postedDate: "Apr 1, 2026",
    workType: "On-site",
    employmentType: "Full-time",
    experienceLevel: "1+ years",
    salaryRange: "$70k-$100k",
    industry: "Insurtech",
    skills: ["Selenium", "Cypress", "Java", "CI/CD", "API Testing"],
    url: "https://example.com/job/10",
  },
  {
    id: "11",
    title: "iOS Developer",
    company: "Duolingo",
    location: "Pittsburgh, PA, US",
    postedDate: "Mar 31, 2026",
    workType: "Hybrid",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$130k-$170k",
    industry: "EdTech",
    skills: ["Swift", "SwiftUI", "Core Data", "REST APIs", "Unit Testing"],
    url: "https://example.com/job/11",
  },
  {
    id: "12",
    title: "Security Engineer",
    company: "CrowdStrike",
    location: "Austin, TX, US",
    postedDate: "Apr 2, 2026",
    workType: "Remote",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$140k-$185k",
    industry: "Cybersecurity",
    skills: ["Threat Analysis", "SIEM", "Python", "Network Security", "Incident Response"],
    url: "https://example.com/job/12",
  },
  {
    id: "13",
    title: "Full Stack Developer",
    company: "Oscar Health",
    location: "New York, NY, US",
    postedDate: "Mar 30, 2026",
    workType: "Hybrid",
    employmentType: "Full-time",
    experienceLevel: "1+ years",
    salaryRange: "$90k-$130k",
    industry: "Healthcare",
    skills: ["React", "Node.js", "PostgreSQL", "TypeScript", "REST APIs"],
    url: "https://example.com/job/13",
  },
  {
    id: "14",
    title: "Data Engineer",
    company: "Coinbase",
    location: "Remote, US",
    postedDate: "Apr 1, 2026",
    workType: "Remote",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$155k-$200k",
    industry: "FinTech",
    skills: ["Spark", "Python", "Airflow", "Snowflake", "dbt"],
    url: "https://example.com/job/14",
  },
  {
    id: "15",
    title: "Technical Writer",
    company: "Atlassian",
    location: "Sydney, NSW, AU",
    postedDate: "Mar 27, 2026",
    workType: "Remote",
    employmentType: "Contract",
    experienceLevel: "1+ years",
    salaryRange: "$60k-$90k",
    industry: "SaaS",
    skills: ["Technical Documentation", "Markdown", "API Docs", "Git", "JIRA"],
    url: "https://example.com/job/15",
  },
  {
    id: "16",
    title: "Embedded Systems Engineer",
    company: "Tesla",
    location: "Palo Alto, CA, US",
    postedDate: "Mar 29, 2026",
    workType: "On-site",
    employmentType: "Full-time",
    experienceLevel: "5+ years",
    salaryRange: "$160k-$220k",
    industry: "Automotive",
    skills: ["C", "RTOS", "CAN Bus", "Linux Kernel", "Hardware Integration"],
    url: "https://example.com/job/16",
  },
  {
    id: "17",
    title: "Marketing Analyst",
    company: "HubSpot",
    location: "Cambridge, MA, US",
    postedDate: "Apr 2, 2026",
    workType: "Hybrid",
    employmentType: "Full-time",
    experienceLevel: "0-3 years",
    salaryRange: "$65k-$90k",
    industry: "SaaS",
    skills: ["Google Analytics", "SQL", "Excel", "A/B Testing", "SEO"],
    url: "https://example.com/job/17",
  },
  {
    id: "18",
    title: "Site Reliability Engineer",
    company: "Datadog",
    location: "New York, NY, US",
    postedDate: "Mar 31, 2026",
    workType: "Remote",
    employmentType: "Full-time",
    experienceLevel: "3-5 years",
    salaryRange: "$150k-$195k",
    industry: "Cloud Computing",
    skills: ["Go", "Kubernetes", "Prometheus", "Terraform", "Linux"],
    url: "https://example.com/job/18",
  },
  {
    id: "19",
    title: "React Native Developer",
    company: "Instacart",
    location: "San Francisco, CA, US",
    postedDate: "Mar 28, 2026",
    workType: "Remote",
    employmentType: "Part-time",
    experienceLevel: "1+ years",
    salaryRange: "$60k-$80k",
    industry: "E-commerce",
    skills: ["React Native", "TypeScript", "Redux", "Jest", "Firebase"],
    url: "https://example.com/job/19",
  },
  {
    id: "20",
    title: "AI Research Scientist",
    company: "DeepMind",
    location: "London, UK",
    postedDate: "Mar 26, 2026",
    workType: "On-site",
    employmentType: "Full-time",
    experienceLevel: "5+ years",
    salaryRange: "$200k-$300k",
    industry: "AI/ML",
    skills: ["PyTorch", "Reinforcement Learning", "Mathematics", "Research Papers", "Python"],
    url: "https://example.com/job/20",
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIME_FILTERS = ["Last 24 Hours", "Last 3 Days", "Last 7 Days", "Last 30 Days"] as const

const WORK_TYPES = ["All", "Remote", "Hybrid", "On-site"] as const
const LEVELS = ["All", "0-3 years", "1+ years", "3-5 years", "5+ years"] as const
const INDUSTRIES = [
  "All",
  "AI/ML",
  "Automotive",
  "Cloud Computing",
  "Cybersecurity",
  "E-commerce",
  "EdTech",
  "Energy",
  "FinTech",
  "Gaming",
  "Healthcare",
  "Insurtech",
  "SaaS",
] as const
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
  const [timeFilter, setTimeFilter] = useState<string>("Last 24 Hours")
  const [searchQuery, setSearchQuery] = useState("")
  const [workTypeFilter, setWorkTypeFilter] = useState("All")
  const [levelFilter, setLevelFilter] = useState("All")
  const [industryFilter, setIndustryFilter] = useState("All")
  const [domainFilter, setDomainFilter] = useState("All")
  const [addedJobs, setAddedJobs] = useState<Set<string>>(new Set())

  const { mutate: createJob, isPending: isCreating } = useCreateJob()

  const filteredJobs = useMemo(() => {
    return MOCK_JOBS.filter((job) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !job.title.toLowerCase().includes(q) &&
          !job.company.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      if (workTypeFilter !== "All" && job.workType !== workTypeFilter) return false
      if (levelFilter !== "All" && job.experienceLevel !== levelFilter) return false
      if (industryFilter !== "All" && job.industry !== industryFilter) return false
      // Domain filter is a soft category — skip for mock
      return true
    })
  }, [searchQuery, workTypeFilter, levelFilter, industryFilter, domainFilter])

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
            <span className="font-medium text-gray-700">{filteredJobs.length} results.</span>
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
            options={WORK_TYPES as unknown as string[]}
          />
          <FilterSelect
            label="Level"
            value={levelFilter}
            onChange={setLevelFilter}
            options={LEVELS as unknown as string[]}
          />
          <FilterSelect
            label="Industry"
            value={industryFilter}
            onChange={setIndustryFilter}
            options={INDUSTRIES as unknown as string[]}
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
        {filteredJobs.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-12 text-center text-gray-400">
            No jobs match your filters.
          </div>
        )}

        {filteredJobs.map((job) => {
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
