"use client"

import { useState } from "react"
import { useCreateJob } from "@/lib/hooks/useJobs"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Briefcase } from "lucide-react"
import type { ApplicationStatus } from "@/types"

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "SAVED", label: "Saved" },
  { value: "APPLIED", label: "Applied" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "OFFER", label: "Offer" },
  { value: "REJECTED", label: "Rejected" },
]

export default function AddJobPage() {
  const router = useRouter()
  const { mutate: createJob, isPending } = useCreateJob()

  const [form, setForm] = useState({
    title: "",
    company: "",
    url: "",
    location: "",
    salary: "",
    status: "SAVED" as ApplicationStatus,
    notes: "",
    source: "",
  })

  const isValid = form.title.trim() && form.company.trim()

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    createJob(
      {
        title: form.title.trim(),
        company: form.company.trim(),
        url: form.url.trim() || undefined,
        location: form.location.trim() || undefined,
        salary: form.salary.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        source: form.source.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.push("/dashboard/applied")
        },
      }
    )
  }

  return (
    <div className="flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-[600px]">
        <div className="bg-white border border-border rounded-xl shadow-sm">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Add Job</h1>
                <p className="text-sm text-gray-500">
                  Manually track a job application
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Title + Company */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="title"
                  className="text-sm font-medium text-gray-700"
                >
                  Job Title <span className="text-red-500">*</span>
                </label>
                <Input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="company"
                  className="text-sm font-medium text-gray-700"
                >
                  Company <span className="text-red-500">*</span>
                </label>
                <Input
                  id="company"
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="e.g. Google"
                  required
                />
              </div>
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <label htmlFor="url" className="text-sm font-medium text-gray-700">
                URL
              </label>
              <Input
                id="url"
                name="url"
                type="url"
                value={form.url}
                onChange={handleChange}
                placeholder="https://..."
              />
            </div>

            {/* Location + Salary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="location"
                  className="text-sm font-medium text-gray-700"
                >
                  Location
                </label>
                <Input
                  id="location"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="Remote, NYC, etc."
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="salary"
                  className="text-sm font-medium text-gray-700"
                >
                  Salary
                </label>
                <Input
                  id="salary"
                  name="salary"
                  value={form.salary}
                  onChange={handleChange}
                  placeholder="$60,000 - $120,000"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label
                htmlFor="status"
                className="text-sm font-medium text-gray-700"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="notes"
                className="text-sm font-medium text-gray-700"
              >
                Notes
              </label>
              <Textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Interview notes, contact info, follow-up dates..."
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {/* Source */}
            <div className="space-y-1.5">
              <label
                htmlFor="source"
                className="text-sm font-medium text-gray-700"
              >
                Source
              </label>
              <Input
                id="source"
                name="source"
                value={form.source}
                onChange={handleChange}
                placeholder="LinkedIn, Indeed, Company site..."
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={!isValid}
              loading={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Add Job
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
