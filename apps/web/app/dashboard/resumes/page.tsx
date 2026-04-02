"use client"

import { useState } from "react"
import Link from "next/link"
import { useResumes, useCreateResume, useDeleteResume } from "@/lib/hooks/useResumes"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Skeleton } from "@/components/ui/Skeleton"
import { EmptyState } from "@/components/EmptyState"
import { FileText, Plus, Trash2, Wand2, Download, ArrowRight, X } from "lucide-react"
import { formatDate } from "@/lib/utils/format"

export default function ResumesPage() {
  const { data: resumes = [], isLoading } = useResumes()
  const { mutate: createResume, isPending: creating } = useCreateResume()
  const { mutate: deleteResume } = useDeleteResume()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")

  const handleCreate = () => {
    if (!name.trim()) return
    createResume(
      { name: name.trim() },
      { onSuccess: () => { setName(""); setShowCreate(false) } }
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and tailor your resumes
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New Resume
        </Button>
      </div>

      {/* Create dialog */}
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
          description="Create your first resume to start tailoring it to job descriptions"
          actionLabel="Create Resume"
          onAction={() => setShowCreate(true)}
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
