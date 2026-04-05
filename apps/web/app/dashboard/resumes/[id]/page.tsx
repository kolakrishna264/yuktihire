"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useResume, useUpdateResume, useResumeVersions } from "@/lib/hooks/useResumes"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { ArrowLeft, Save, Wand2, Clock, Download } from "lucide-react"
import { formatDate } from "@/lib/utils/format"

export default function ResumeDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { data: resume, isLoading } = useResume(id)
  const { data: versionsData } = useResumeVersions(id)
  const { mutate: updateResume, isPending: saving } = useUpdateResume()
  const [name, setName] = useState("")
  const [contentJson, setContentJson] = useState("")
  const [jsonError, setJsonError] = useState("")

  useEffect(() => {
    if (resume) {
      setName(resume.name ?? "")
      setContentJson(JSON.stringify(resume.content ?? {}, null, 2))
    }
  }, [resume])

  const handleSave = () => {
    setJsonError("")
    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(contentJson)
    } catch {
      setJsonError("Invalid JSON — please fix before saving")
      return
    }
    updateResume({ id, data: { name, content: parsed } })
  }

  const versions = versionsData?.versions ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/resumes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        {isLoading ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <h1 className="text-xl font-bold truncate">{resume?.name}</h1>
        )}
        <div className="ml-auto flex gap-2">
          <Link href={`/dashboard/tailor?resume=${id}`}>
            <Button variant="outline" size="sm">
              <Wand2 className="w-3.5 h-3.5" />
              Tailor
            </Button>
          </Link>
          <Button size="sm" loading={saving} onClick={handleSave}>
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Resume Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Resume name"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Content (JSON)
                </label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Edit the structured resume data. The AI tailoring engine uses this content.
                </p>
                {isLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : (
                  <>
                    <Textarea
                      value={contentJson}
                      onChange={(e) => {
                        setContentJson(e.target.value)
                        setJsonError("")
                      }}
                      className="font-mono text-xs min-h-[400px] resize-y"
                      spellCheck={false}
                    />
                    {jsonError && (
                      <p className="text-xs text-red-500 mt-1">{jsonError}</p>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Tip:</strong> Structure your content with{" "}
                  <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">experiences</code>,{" "}
                  <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">skills</code>, and{" "}
                  <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">educations</code> arrays
                  for best tailoring results.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Export */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-3">Export</p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full"
                  onClick={async () => {
                    try {
                      const { apiDownload } = await import("@/lib/api/client")
                      await apiDownload(`/extension/export?resume_id=${id}&format=pdf`, "resume.pdf")
                    } catch (e: any) {
                      const { toast } = await import("sonner")
                      toast.error(e.message || "PDF download failed")
                    }
                  }}>
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </Button>
                <Button variant="outline" size="sm" className="w-full"
                  onClick={async () => {
                    try {
                      const { apiDownload } = await import("@/lib/api/client")
                      await apiDownload(`/extension/export?resume_id=${id}&format=docx`, "resume.docx")
                    } catch (e: any) {
                      const { toast } = await import("sonner")
                      toast.error(e.message || "DOCX download failed")
                    }
                  }}>
                  <Download className="w-3.5 h-3.5" />
                  Download DOCX
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Version history */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Version History</p>
              </div>
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No saved versions yet. Use AI tailoring to create versions.
                </p>
              ) : (
                <div className="space-y-2">
                  {versions.slice(0, 8).map((v: any) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="text-xs font-medium">{v.label || "Version"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(v.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
