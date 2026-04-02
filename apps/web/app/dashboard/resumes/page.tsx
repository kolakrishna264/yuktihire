"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useResumes, useCreateResume, useDeleteResume } from "@/lib/hooks/useResumes"
import { profileApi } from "@/lib/api/profile"
import { resumesApi } from "@/lib/api/resumes"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { EmptyState } from "@/components/EmptyState"
import {
  FileText, Plus, Trash2, Wand2, ArrowRight, X,
  Upload, CloudUpload, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react"
import { formatDate } from "@/lib/utils/format"
import { toast } from "sonner"

type UploadStep =
  | { type: "idle" }
  | { type: "uploading" }
  | { type: "creating"; name: string }
  | { type: "success" }
  | { type: "error"; message: string }

export default function ResumesPage() {
  const { data: resumes = [], isLoading, refetch } = useResumes()
  const { mutate: createResume, isPending: creating } = useCreateResume()
  const { mutate: deleteResume } = useDeleteResume()

  // Create-by-name state
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadStep, setUploadStep] = useState<UploadStep>({ type: "idle" })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    if (!name.trim()) return
    createResume(
      { name: name.trim() },
      { onSuccess: () => { setName(""); setShowCreate(false) } }
    )
  }

  const handleFile = useCallback(async (file: File) => {
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    if (!allowed.includes(file.type)) {
      setUploadStep({ type: "error", message: "Only PDF and DOCX files are supported." })
      return
    }

    setUploadStep({ type: "uploading" })

    let parsed: any
    try {
      parsed = await profileApi.importResume(file)
    } catch (err: any) {
      setUploadStep({ type: "error", message: err?.message ?? "Failed to analyze resume." })
      return
    }

    // Derive a sensible resume name from parsed profile or filename
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
    const resumeName =
      parsed?.fullName
        ? `${parsed.fullName}'s Resume`
        : baseName || "Imported Resume"

    setUploadStep({ type: "creating", name: resumeName })

    try {
      await resumesApi.create({ name: resumeName })
      setUploadStep({ type: "success" })
      refetch()
      toast.success("Resume created from uploaded file!")
      setTimeout(() => {
        setShowUpload(false)
        setUploadStep({ type: "idle" })
      }, 2000)
    } catch (err: any) {
      setUploadStep({ type: "error", message: err?.message ?? "Failed to create resume." })
    }
  }, [refetch])

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const resetUpload = () => {
    setUploadStep({ type: "idle" })
    setShowUpload(false)
  }

  const isUploadBusy =
    uploadStep.type === "uploading" || uploadStep.type === "creating"

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and tailor your resumes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setShowUpload(true); setShowCreate(false); setUploadStep({ type: "idle" }) }}
          >
            <Upload className="w-4 h-4" />
            Upload Resume
          </Button>
          <Button onClick={() => { setShowCreate(true); setShowUpload(false) }}>
            <Plus className="w-4 h-4" />
            New Resume
          </Button>
        </div>
      </div>

      {/* Upload drop zone */}
      {showUpload && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-sm">Upload Resume</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We'll parse your file and populate your profile automatically
                </p>
              </div>
              {!isUploadBusy && (
                <button onClick={resetUpload} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Idle / drag zone */}
            {uploadStep.type === "idle" && (
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={[
                  "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3",
                  "cursor-pointer transition-colors select-none",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/30",
                ].join(" ")}
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <CloudUpload className="w-7 h-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">
                    {isDragging ? "Drop your file here" : "Drag & drop your resume here"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or <span className="text-primary underline cursor-pointer">browse files</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports PDF and DOCX
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </div>
            )}

            {/* Uploading */}
            {uploadStep.type === "uploading" && (
              <div className="border-2 border-dashed border-primary/40 rounded-xl p-10 flex flex-col items-center justify-center gap-3 bg-primary/5">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-sm text-primary">Analyzing your resume...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This usually takes a few seconds
                  </p>
                </div>
              </div>
            )}

            {/* Creating resume */}
            {uploadStep.type === "creating" && (
              <div className="border-2 border-dashed border-primary/40 rounded-xl p-10 flex flex-col items-center justify-center gap-3 bg-primary/5">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-sm text-primary">Profile updated! Creating resume...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saving as "{uploadStep.name}"
                  </p>
                </div>
              </div>
            )}

            {/* Success */}
            {uploadStep.type === "success" && (
              <div className="border-2 border-dashed border-emerald-400 rounded-xl p-10 flex flex-col items-center justify-center gap-3 bg-emerald-50 dark:bg-emerald-900/10">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                <div className="text-center">
                  <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Resume created successfully!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your profile has been updated and your resume is ready to tailor.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {uploadStep.type === "error" && (
              <div className="border-2 border-dashed border-red-400 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-red-50 dark:bg-red-900/10">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <div className="text-center">
                  <p className="font-semibold text-sm text-red-700 dark:text-red-400">Upload failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{uploadStep.message}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadStep({ type: "idle" })}
                  className="mt-1"
                >
                  Try again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create by name dialog */}
      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm">Create New Resume</p>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Software Engineer — Google 2025"
                className="flex-1"
                autoFocus
              />
              <Button loading={creating} disabled={!name.trim()} onClick={handleCreate}>
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Upload an existing resume or create a blank one to start tailoring it to job descriptions"
          actionLabel="Upload Resume"
          onAction={() => { setShowUpload(true); setUploadStep({ type: "idle" }) }}
        />
      ) : (
        <div className="space-y-3">
          {resumes.map((r) => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link
                        href={`/dashboard/resumes/${r.id}`}
                        className="font-semibold hover:underline truncate"
                      >
                        {r.name}
                      </Link>
                      <Badge variant={r.status === "ACTIVE" ? "success" : "secondary"}>
                        {r.status}
                      </Badge>
                      {r.isDefault && <Badge variant="default">Default</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(r.updatedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/dashboard/tailor?resume=${r.id}`}>
                      <Button variant="outline" size="sm">
                        <Wand2 className="w-3.5 h-3.5" />
                        Tailor
                      </Button>
                    </Link>
                    <Link href={`/dashboard/resumes/${r.id}`}>
                      <Button variant="outline" size="sm">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <button
                      onClick={() => deleteResume(r.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
