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
  User, Layers, Briefcase,
} from "lucide-react"
import { formatDate } from "@/lib/utils/format"
import { toast } from "sonner"

// ── Upload phase types ─────────────────────────────────────────────────────────

type UploadPhase = "idle" | "parsing" | "extracting" | "done" | "error"

type ParsedProfile = {
  full_name?: string
  fullName?: string
  skills?: unknown[]
  experiences?: unknown[]
  [key: string]: unknown
}

// ── Step indicator ─────────────────────────────────────────────────────────────

const UPLOAD_STEPS = [
  { id: 1, label: "Parsing document" },
  { id: 2, label: "Extracting profile data" },
  { id: 3, label: "Profile built" },
]

function phaseToStep(phase: UploadPhase): number {
  if (phase === "parsing") return 1
  if (phase === "extracting") return 2
  if (phase === "done") return 3
  return 0
}

function StepIndicator({ phase }: { phase: UploadPhase }) {
  const currentStep = phaseToStep(phase)

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto mb-6">
      {UPLOAD_STEPS.map((step, idx) => {
        const isActive = currentStep === step.id
        const isDone = currentStep > step.id
        const isLast = idx === UPLOAD_STEPS.length - 1

        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            {/* Circle */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                  isDone
                    ? "bg-emerald-500 text-white shadow-sm"
                    : isActive
                    ? "bg-indigo-600 text-white shadow-md ring-4 ring-indigo-200 dark:ring-indigo-900"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={[
                  "mt-1.5 text-[10px] font-medium text-center leading-tight whitespace-nowrap transition-colors duration-300",
                  isDone
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 h-0.5 mx-1 mb-5 rounded-full overflow-hidden bg-muted">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-500",
                    isDone ? "w-full bg-emerald-400" : "w-0",
                  ].join(" ")}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Success card ───────────────────────────────────────────────────────────────

function SuccessCard({
  parsedProfile,
  onContinue,
}: {
  parsedProfile: ParsedProfile | null
  onContinue: () => void
}) {
  const name = parsedProfile?.full_name ?? parsedProfile?.fullName ?? null
  const skillsCount = Array.isArray(parsedProfile?.skills) ? parsedProfile!.skills!.length : null
  const expCount = Array.isArray(parsedProfile?.experiences) ? parsedProfile!.experiences!.length : null

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-400">
      {/* Success header */}
      <div className="flex flex-col items-center gap-2 mb-5">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
          Profile Built!
        </p>
        <p className="text-xs text-muted-foreground text-center">
          We extracted the following details from your resume
        </p>
      </div>

      {/* Extracted data preview */}
      <div className="bg-muted/50 rounded-xl p-4 mb-5 space-y-2.5">
        {name && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center border border-border">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Name</p>
              <p className="text-sm font-semibold">{name}</p>
            </div>
          </div>
        )}
        {skillsCount !== null && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center border border-border">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Skills</p>
              <p className="text-sm font-semibold">{skillsCount} skills extracted</p>
            </div>
          </div>
        )}
        {expCount !== null && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center border border-border">
              <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Experience</p>
              <p className="text-sm font-semibold">{expCount} position{expCount !== 1 ? "s" : ""} found</p>
            </div>
          </div>
        )}
        {!name && skillsCount === null && expCount === null && (
          <p className="text-xs text-muted-foreground text-center py-2">Profile data extracted successfully</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard/profile" className="flex-1">
          <Button variant="outline" className="w-full" size="sm">
            View Profile
          </Button>
        </Link>
        <Button onClick={onContinue} className="flex-1" size="sm">
          Continue
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResumesPage() {
  const { data: resumes = [], isLoading, refetch } = useResumes()
  const { mutate: createResume, isPending: creating } = useCreateResume()
  const { mutate: deleteResume } = useDeleteResume()

  // Create-by-name state
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle")
  const [parsedProfile, setParsedProfile] = useState<ParsedProfile | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Keep a ref to the file being processed so Continue can create the resume
  const pendingFileRef = useRef<{ name: string; parsed: ParsedProfile } | null>(null)

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
      setUploadPhase("error")
      setUploadError("Only PDF and DOCX files are supported.")
      return
    }

    // Step 1 — parsing
    setUploadPhase("parsing")
    setParsedProfile(null)
    setUploadError(null)

    // After 0.8s advance to step 2 (extracting) while the API call continues
    const extractingTimer = setTimeout(() => {
      setUploadPhase("extracting")
    }, 800)

    let parsed: ParsedProfile
    try {
      parsed = await profileApi.importResume(file)
    } catch (err: any) {
      clearTimeout(extractingTimer)
      setUploadPhase("error")
      setUploadError(err?.message ?? "Failed to analyze resume.")
      return
    }

    // Ensure we've been in "extracting" for at least a moment before showing done
    clearTimeout(extractingTimer)
    setUploadPhase("extracting")

    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
    const resumeName =
      parsed?.full_name
        ? `${parsed.full_name}'s Resume`
        : parsed?.fullName
        ? `${parsed.fullName}'s Resume`
        : baseName || "Imported Resume"

    pendingFileRef.current = { name: resumeName, parsed }
    setParsedProfile(parsed)

    // Brief pause so step 2 is visible before jumping to done
    await new Promise((r) => setTimeout(r, 500))
    setUploadPhase("done")
  }, [])

  const handleContinue = useCallback(async () => {
    const pending = pendingFileRef.current
    if (!pending) {
      resetUpload()
      return
    }

    try {
      await resumesApi.create({ name: pending.name })
      refetch()
      toast.success("Resume created from uploaded file!")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create resume.")
    }

    resetUpload()
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
    setUploadPhase("idle")
    setShowUpload(false)
    setParsedProfile(null)
    setUploadError(null)
    pendingFileRef.current = null
  }

  const isBusy = uploadPhase === "parsing" || uploadPhase === "extracting"

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
            onClick={() => { setShowUpload(true); setShowCreate(false); setUploadPhase("idle") }}
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
              {!isBusy && (
                <button onClick={resetUpload} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Idle / drag zone */}
            {uploadPhase === "idle" && (
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

            {/* Parsing / Extracting — stepped progress */}
            {(uploadPhase === "parsing" || uploadPhase === "extracting") && (
              <div className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl px-8 pt-8 pb-6 flex flex-col items-center bg-indigo-50/40 dark:bg-indigo-900/10 animate-in fade-in duration-300">
                <StepIndicator phase={uploadPhase} />
                <p className="text-xs text-muted-foreground text-center">
                  {uploadPhase === "parsing"
                    ? "Reading your document, this only takes a moment…"
                    : "Pulling out your skills, experience and contact info…"}
                </p>
              </div>
            )}

            {/* Done — success card */}
            {uploadPhase === "done" && (
              <div className="border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl px-6 pt-6 pb-5 bg-emerald-50/40 dark:bg-emerald-900/10">
                <StepIndicator phase="done" />
                <SuccessCard parsedProfile={parsedProfile} onContinue={handleContinue} />
              </div>
            )}

            {/* Error */}
            {uploadPhase === "error" && (
              <div className="border-2 border-dashed border-red-400 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-red-50 dark:bg-red-900/10">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <div className="text-center">
                  <p className="font-semibold text-sm text-red-700 dark:text-red-400">Upload failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{uploadError}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadPhase("idle")}
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
          onAction={() => { setShowUpload(true); setUploadPhase("idle") }}
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
