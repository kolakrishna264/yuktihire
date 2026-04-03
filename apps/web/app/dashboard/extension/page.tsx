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

      {/* Install CTA */}
      <Card className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
              <Chrome className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Add YuktiHire to Chrome</h2>
              <p className="text-sm text-gray-600">
                Install the extension to save jobs from LinkedIn, Indeed, Greenhouse, and any career page with one click.
              </p>
            </div>
            <a
              href="https://github.com/kolakrishna264/yuktihire/archive/refs/heads/main.zip"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Extension
            </a>
          </div>

          {/* Quick install steps */}
          <div className="mt-5 pt-5 border-t border-indigo-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick setup (1 minute)</p>
            <div className="grid sm:grid-cols-4 gap-3">
              {[
                { step: "1", text: "Download & unzip the file" },
                { step: "2", text: "Open chrome://extensions" },
                { step: "3", text: "Enable Developer Mode → Load unpacked" },
                { step: "4", text: "Select the apps/extension folder" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </span>
                  <p className="text-xs text-gray-600">{item.text}</p>
                </div>
              ))}
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
