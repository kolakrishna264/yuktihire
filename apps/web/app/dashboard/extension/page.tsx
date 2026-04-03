"use client"

import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import {
  Chrome,
  Download,
  Check,
  ArrowRight,
  Globe,
  Shield,
  Wand2,
  Bookmark,
  FileText,
  MousePointer,
  ExternalLink,
} from "lucide-react"

export default function ExtensionPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Chrome className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">YuktiHire Browser Extension</h1>
            <p className="text-sm text-gray-500">Save jobs from any website with one click</p>
          </div>
        </div>
      </div>

      {/* Install Instructions */}
      <Card className="mb-6 border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Install the Extension</h2>
              <p className="text-sm text-gray-600 mb-4">Follow these steps to install YuktiHire on Chrome:</p>
              <div className="space-y-3">
                {[
                  { step: "1", text: "Open Chrome and go to chrome://extensions" },
                  { step: "2", text: "Enable \"Developer mode\" (toggle in top right)" },
                  { step: "3", text: "Click \"Load unpacked\"" },
                  { step: "4", text: "Select the apps/extension folder from the YuktiHire project" },
                  { step: "5", text: "The YuktiHire icon will appear in your toolbar" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {item.step}
                    </span>
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">How it works</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            {
              icon: Globe,
              title: "Browse any job site",
              desc: "LinkedIn, Indeed, Greenhouse, Lever, company career pages",
            },
            {
              icon: MousePointer,
              title: "Click the extension",
              desc: "Job details are extracted automatically from the page",
            },
            {
              icon: Bookmark,
              title: "Save to YuktiHire",
              desc: "One click saves the job with full details to your dashboard",
            },
            {
              icon: Wand2,
              title: "Tailor & Apply",
              desc: "AI tailors your resume, then apply on the original site",
            },
          ].map((step, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <step.icon className="w-5 h-5 text-indigo-500 mb-3" />
                <p className="text-sm font-semibold text-gray-800 mb-1">{step.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Supported Sites */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Supported job sites</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            "LinkedIn", "Indeed", "Greenhouse", "Lever",
            "Workday", "Apple Careers", "Google Careers", "Any career page",
          ].map((site) => (
            <div key={site} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-sm text-gray-700">{site}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What the extension does */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Extension actions</h2>
        <div className="space-y-2">
          {[
            { icon: Bookmark, text: "Save job to your dashboard with full details (title, company, JD, apply link)" },
            { icon: Wand2, text: "Trigger instant resume tailoring — ATS score, missing skills, suggestions" },
            { icon: ExternalLink, text: "Keep the original apply link so you apply on the company's own portal" },
            { icon: Check, text: "Detect if you already saved or applied to a job" },
            { icon: FileText, text: "Track application status — saved, tailoring, tailored, applied" },
            { icon: Shield, text: "Secure — uses your YuktiHire login session, no extra passwords" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:border-indigo-200 transition-colors">
              <f.icon className="w-4 h-4 text-indigo-500 shrink-0" />
              <p className="text-sm text-gray-700">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Auth info */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Signing into the extension</h3>
          <p className="text-sm text-gray-500 mb-3">
            The extension uses your existing YuktiHire session. Just make sure you&apos;re signed in to yuktihire.com, then:
          </p>
          <div className="space-y-2">
            {[
              "Click the YuktiHire extension icon",
              "Click \"Sign in to YuktiHire\"",
              "Your session will be connected automatically",
              "Start saving jobs!",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
