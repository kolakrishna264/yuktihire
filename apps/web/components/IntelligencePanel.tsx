"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import {
  GraduationCap, Building2, Mail, Target, Loader2, Sparkles, Copy, Check,
} from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api/client"

interface IntelligencePanelProps {
  trackerId: string
  resumeId?: string
  company: string
  role: string
  jobDescription: string
}

type Tab = "interview" | "company" | "outreach" | "strategy"

export function IntelligencePanel({ trackerId, resumeId, company, role, jobDescription }: IntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("interview")
  const [interviewPrep, setInterviewPrep] = useState("")
  const [companyResearch, setCompanyResearch] = useState("")
  const [outreachMessages, setOutreachMessages] = useState("")
  const [strategyContent, setStrategyContent] = useState("")
  const [loading, setLoading] = useState<Tab | null>(null)
  const [copiedSection, setCopiedSection] = useState("")

  const tabs: { key: Tab; label: string; icon: typeof GraduationCap }[] = [
    { key: "interview", label: "Interview Prep", icon: GraduationCap },
    { key: "company", label: "Company Intel", icon: Building2 },
    { key: "outreach", label: "Outreach", icon: Mail },
    { key: "strategy", label: "Strategy", icon: Target },
  ]

  const handleGenerate = async (tab: Tab) => {
    setLoading(tab)
    const endpoint = tab === "interview" ? "/intelligence/interview-prep"
      : tab === "company" ? "/intelligence/company-research"
      : tab === "strategy" ? "/intelligence/apply-strategy"
      : "/intelligence/recruiter-outreach"

    try {
      const result = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          tracker_id: trackerId,
          resume_id: resumeId || undefined,
          company,
          role,
          job_description: jobDescription,
        }),
      })

      if (tab === "interview") setInterviewPrep(result.interviewPrep || "")
      else if (tab === "company") setCompanyResearch(result.companyResearch || "")
      else if (tab === "strategy") setStrategyContent(result.strategy || "")
      else setOutreachMessages(result.outreachMessages || "")

      toast.success("Generated!")
    } catch (e: any) {
      toast.error(e.message || "Failed to generate")
    }
    setLoading(null)
  }

  const handleCopy = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedSection(section)
    toast.success("Copied!")
    setTimeout(() => setCopiedSection(""), 2000)
  }

  const content = activeTab === "interview" ? interviewPrep
    : activeTab === "company" ? companyResearch
    : activeTab === "strategy" ? strategyContent
    : outreachMessages

  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        {/* Tab bar */}
        <div className="flex gap-1 mb-4 border-b border-gray-100 pb-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === t.key
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {!content ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-3">
              {activeTab === "interview" && "Generate role-specific interview questions with suggested answers"}
              {activeTab === "company" && "Get AI-powered company intelligence and talking points"}
              {activeTab === "outreach" && "Generate recruiter messages for LinkedIn and email"}
              {activeTab === "strategy" && "Generate a strategic application plan with match assessment"}
            </p>
            <Button
              onClick={() => handleGenerate(activeTab)}
              disabled={loading !== null}
              variant="gradient"
              size="sm"
            >
              {loading === activeTab ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generate {tabs.find(t => t.key === activeTab)?.label}</>
              )}
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex justify-end gap-2 mb-3">
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleCopy(content, activeTab)}
              >
                {copiedSection === activeTab ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedSection === activeTab ? "Copied!" : "Copy All"}
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => handleGenerate(activeTab)}
                disabled={loading !== null}
              >
                <Sparkles className="w-3 h-3" />
                Regenerate
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
