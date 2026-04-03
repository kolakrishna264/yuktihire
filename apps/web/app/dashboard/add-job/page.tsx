"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAddToTracker } from "@/lib/hooks/useTracker"
import { apiFetch } from "@/lib/api/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Card, CardContent } from "@/components/ui/Card"
import { toast } from "sonner"
import {
  Briefcase,
  Link as LinkIcon,
  FileText,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react"

type Tab = "url" | "description"

interface FetchedJob {
  title: string
  company: string
  location: string
  description: string
}

export default function AddJobPage() {
  const router = useRouter()
  const { mutateAsync: addToTracker, isPending: saving } = useAddToTracker()

  const [tab, setTab] = useState<Tab>("url")

  // URL tab state
  const [url, setUrl] = useState("")
  const [fetching, setFetching] = useState(false)
  const [fetched, setFetched] = useState<FetchedJob | null>(null)

  // Description tab state
  const [form, setForm] = useState({
    title: "",
    company: "",
    url: "",
    location: "",
    description: "",
  })

  // Success state
  const [savedId, setSavedId] = useState<string | null>(null)

  const handleFetchUrl = async () => {
    if (!url.trim()) return
    setFetching(true)
    setFetched(null)
    try {
      const data = await apiFetch("/jobs/parse-url", {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
        headers: { "Content-Type": "application/json" },
      })
      setFetched({
        title: data.title || "",
        company: data.company || "",
        location: data.location || "",
        description: data.description || "",
      })
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch job details. Try pasting the description instead.")
    } finally {
      setFetching(false)
    }
  }

  const handleSaveFromUrl = async () => {
    if (!fetched) return
    try {
      const result = await addToTracker({
        title: fetched.title,
        company: fetched.company,
        url: url.trim(),
        location: fetched.location || undefined,
        description: fetched.description || undefined,
        source: new URL(url.trim()).hostname,
        pipeline_stage: "INTERESTED",
      })
      const id = (result as any)?.id
      setSavedId(id || "saved")

      // Start quick tailoring if we have a JD
      if (fetched.description && id) {
        try {
          await apiFetch("/tailor/quick", {
            method: "POST",
            body: JSON.stringify({ trackerId: id }),
            headers: { "Content-Type": "application/json" },
          })
          toast.success("Job saved! Tailoring started...")
        } catch {
          toast.success("Job saved! Start tailoring from My Jobs.")
        }
      } else {
        toast.success("Job saved!")
      }
    } catch {
      // error handled by hook
    }
  }

  const handleSaveFromDescription = async () => {
    if (!form.title.trim() || !form.company.trim()) return
    try {
      const result = await addToTracker({
        title: form.title.trim(),
        company: form.company.trim(),
        url: form.url.trim() || undefined,
        location: form.location.trim() || undefined,
        description: form.description.trim() || undefined,
        source: form.url.trim() ? (() => { try { return new URL(form.url.trim()).hostname } catch { return undefined } })() : undefined,
        pipeline_stage: "INTERESTED",
      })
      const id = (result as any)?.id
      setSavedId(id || "saved")

      // Start quick tailoring if we have a JD
      if (form.description.trim() && id) {
        try {
          await apiFetch("/tailor/quick", {
            method: "POST",
            body: JSON.stringify({ trackerId: id }),
            headers: { "Content-Type": "application/json" },
          })
          toast.success("Job saved! Tailoring started...")
        } catch {
          toast.success("Job saved! Start tailoring from My Jobs.")
        }
      } else {
        toast.success("Job saved!")
      }
    } catch {
      // error handled by hook
    }
  }

  // Success view
  if (savedId) {
    return (
      <div className="flex items-start justify-center px-4 py-16">
        <div className="w-full max-w-[700px] text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Job Saved Successfully</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your job has been saved and tailoring has started.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard/jobs">
              <Button variant="outline">
                View in My Jobs
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Button
              onClick={() => {
                setSavedId(null)
                setUrl("")
                setFetched(null)
                setForm({ title: "", company: "", url: "", location: "", description: "" })
              }}
            >
              Add Another Job
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-[700px]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Add Job</h1>
              <p className="text-sm text-gray-500">
                Paste a job URL or description to get started
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab("url")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all ${
              tab === "url"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            From URL
          </button>
          <button
            onClick={() => setTab("description")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all ${
              tab === "description"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            From Description
          </button>
        </div>

        {/* Tab content */}
        {tab === "url" ? (
          <Card>
            <CardContent className="p-6 space-y-5">
              {/* URL Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Job URL
                </label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/view/..."
                  type="url"
                  className="h-12 text-base"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleFetchUrl}
                disabled={!url.trim() || fetching}
                loading={fetching}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10"
              >
                {fetching ? "Fetching Job Details..." : "Fetch Job Details"}
              </Button>

              {/* Fetched preview */}
              {fetched && (
                <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-5 space-y-3">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                    Preview
                  </p>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{fetched.title || "Untitled"}</p>
                    <p className="text-sm text-gray-600">{fetched.company || "Unknown company"}</p>
                    {fetched.location && (
                      <p className="text-sm text-gray-500 mt-1">{fetched.location}</p>
                    )}
                  </div>
                  {fetched.description && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Job Description</p>
                      <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed">
                        {fetched.description.slice(0, 300)}
                        {fetched.description.length > 300 ? "..." : ""}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleSaveFromUrl}
                    loading={saving}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-3"
                  >
                    Save & Tailor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Senior Software Engineer"
                  autoFocus
                />
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Company <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                  placeholder="e.g. Google"
                />
              </div>

              {/* URL (optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  URL <span className="text-gray-400">(optional)</span>
                </label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  type="url"
                />
              </div>

              {/* Location (optional) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Location <span className="text-gray-400">(optional)</span>
                </label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Remote, New York, etc."
                />
              </div>

              {/* Job Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Job Description
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Paste the full job description here..."
                  rows={8}
                  className="resize-none text-sm"
                />
              </div>

              <Button
                onClick={handleSaveFromDescription}
                disabled={!form.title.trim() || !form.company.trim()}
                loading={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10"
              >
                Save & Tailor
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
