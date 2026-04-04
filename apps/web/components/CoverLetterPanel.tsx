"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Textarea } from "@/components/ui/Textarea"
import { FileText, Copy, Check, Download, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api/client"

interface CoverLetterPanelProps {
  jobDescription: string
  resumeId: string
  company?: string
  role?: string
}

export function CoverLetterPanel({ jobDescription, resumeId, company, role }: CoverLetterPanelProps) {
  const [coverLetter, setCoverLetter] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tone, setTone] = useState("professional")

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await apiFetch("/tailor/cover-letter", {
        method: "POST",
        body: JSON.stringify({
          job_description: jobDescription,
          resume_id: resumeId,
          company,
          role,
          tone,
        }),
      })
      setCoverLetter(result.coverLetter || "")
      toast.success("Cover letter generated!")
    } catch (e: any) {
      toast.error(e.message || "Failed to generate")
    }
    setLoading(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(coverLetter)
    setCopied(true)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([coverLetter], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Cover_Letter_${company || "job"}_${role || "application"}.txt`.replace(/\s+/g, "_")
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-gray-800">Cover Letter</h3>
          </div>
          {!coverLetter && (
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1"
            >
              <option value="professional">Professional</option>
              <option value="concise">Concise</option>
              <option value="technical">Technical</option>
            </select>
          )}
        </div>

        {!coverLetter ? (
          <Button
            onClick={handleGenerate}
            disabled={loading || !jobDescription}
            className="w-full"
            variant="gradient"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Generate Cover Letter</>
            )}
          </Button>
        ) : (
          <>
            <Textarea
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              className="min-h-[300px] text-sm leading-relaxed resize-y"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} className="flex-1">
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setCoverLetter(""); handleGenerate() }} className="flex-1">
                <Sparkles className="w-3.5 h-3.5" />
                Regenerate
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
