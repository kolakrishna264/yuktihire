"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Badge } from "@/components/ui/Badge"
import { Sparkles, Copy, Check, MessageSquare, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api/client"
import { useResumes } from "@/lib/hooks/useResumes"

const COMMON_QUESTIONS = [
  "Why do you want to work at this company?",
  "Tell us about your relevant experience.",
  "What is your greatest strength?",
  "Describe a challenging project you worked on.",
  "Why are you interested in this role?",
  "How do you handle disagreements with team members?",
  "What are your salary expectations?",
  "Are you authorized to work in the US?",
  "Do you require visa sponsorship?",
  "When can you start?",
]

export default function AnswersPage() {
  const [question, setQuestion] = useState("")
  const [company, setCompany] = useState("")
  const [role, setRole] = useState("")
  const [jd, setJd] = useState("")
  const [tone, setTone] = useState("professional")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savedAnswers, setSavedAnswers] = useState<{q: string, a: string}[]>([])

  const { data: resumes } = useResumes()
  const defaultResumeId = resumes?.[0]?.id || ""

  const handleGenerate = async (q?: string) => {
    const questionText = q || question
    if (!questionText.trim()) { toast.error("Enter a question"); return }
    setLoading(true)
    setQuestion(questionText)
    try {
      const result = await apiFetch("/answers/generate", {
        method: "POST",
        body: JSON.stringify({
          question: questionText,
          company: company || undefined,
          role: role || undefined,
          job_description: jd || undefined,
          resume_id: defaultResumeId || undefined,
          tone,
        }),
      })
      setAnswer(result.answer || "")
    } catch (e: any) {
      toast.error(e.message || "Failed to generate")
    }
    setLoading(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(answer)
    setCopied(true)
    toast.success("Copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = () => {
    if (question && answer) {
      setSavedAnswers(prev => [...prev, { q: question, a: answer }])
      toast.success("Answer saved to library")
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Answer Generator</h1>
        <p className="text-sm text-gray-500 mt-1">Generate personalized answers for job application questions</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Input */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Your Question</label>
                <Textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="e.g. Why do you want to work at Google?"
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Company (optional)</label>
                  <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Google" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Role (optional)</label>
                  <Input value={role} onChange={e => setRole(e.target.value)} placeholder="ML Engineer" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Job Description (optional)</label>
                <Textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste JD for better answers..." className="min-h-[60px]" />
              </div>

              <div className="flex items-center gap-3">
                <select value={tone} onChange={e => setTone(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5">
                  <option value="professional">Professional</option>
                  <option value="concise">Concise</option>
                  <option value="technical">Technical</option>
                  <option value="conversational">Conversational</option>
                </select>
                <Button onClick={() => handleGenerate()} disabled={loading} className="flex-1">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? "Generating..." : "Generate Answer"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Answer result */}
          {answer && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">Generated Answer</h3>
                  <Badge variant="secondary">{tone}</Badge>
                </div>
                <Textarea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  className="min-h-[150px] text-sm leading-relaxed"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSave}>
                    Save to Library
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleGenerate()}>
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved answers */}
          {savedAnswers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Saved Answers ({savedAnswers.length})</h3>
              <div className="space-y-2">
                {savedAnswers.map((sa, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{sa.q}</p>
                      <p className="text-xs text-gray-500 line-clamp-3">{sa.a}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Common questions */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Common Questions</h3>
          <div className="space-y-2">
            {COMMON_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleGenerate(q)}
                className="w-full text-left p-3 rounded-lg border border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs text-gray-700"
              >
                <MessageSquare className="w-3 h-3 text-indigo-400 inline mr-1.5" />
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
