"use client"
import { FileText, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import type { Resume } from "@/types"
import { cn } from "@/lib/utils/cn"

interface ResumeSelectPanelProps {
  resumes: Resume[]
  selectedId: string
  onSelect: (id: string) => void
}

export function ResumeSelectPanel({ resumes, selectedId, onSelect }: ResumeSelectPanelProps) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h2 className="font-semibold text-sm">Select Resume</h2>
        {resumes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No resumes yet. Create one first.
          </p>
        ) : (
          <div className="space-y-2">
            {resumes.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                  selectedId === r.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/50"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  selectedId === r.id ? "bg-primary/15" : "bg-accent"
                )}>
                  <FileText className={cn("w-4 h-4", selectedId === r.id ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.status}</p>
                </div>
                {selectedId === r.id && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
