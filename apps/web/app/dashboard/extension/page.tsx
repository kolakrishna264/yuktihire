"use client"

import { useState } from "react"
import { useExtensionStatus, useCaptureJob } from "@/lib/hooks/useExtension"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Card, CardContent } from "@/components/ui/Card"
import { Chrome, Download, Check, Link2, Zap, ArrowRight, Globe, Shield } from "lucide-react"
import Link from "next/link"

export default function ExtensionPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Chrome className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Browser Extension</h1>
            <p className="text-sm text-gray-500">Save jobs from any website with one click</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Extension Status</p>
                <p className="text-xs text-gray-400">Coming soon to Chrome Web Store</p>
              </div>
            </div>
            <Badge variant="secondary">Beta</Badge>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Globe, title: "Browse jobs anywhere", desc: "LinkedIn, Indeed, Greenhouse, Lever, company career pages — we support them all." },
            { icon: Download, title: "One-click save", desc: "Click the YuktiHire icon to instantly save the job to your tracker with full details." },
            { icon: ArrowRight, title: "Continue in dashboard", desc: "Tailor your resume, track progress, and manage applications from your dashboard." },
          ].map((step, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <step.icon className="w-6 h-6 text-indigo-500 mb-3" />
                <p className="text-sm font-semibold text-gray-800 mb-1">{step.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Extension features</h2>
        <div className="space-y-3">
          {[
            { icon: Check, text: "Auto-extract job title, company, and description" },
            { icon: Check, text: "Detect if you already saved or applied to a job" },
            { icon: Check, text: "Quick save directly to your pipeline" },
            { icon: Check, text: "Deep link back to dashboard for resume tailoring" },
            { icon: Shield, text: "Secure auth — uses your existing YuktiHire session" },
            { icon: Link2, text: "Works with LinkedIn, Indeed, Greenhouse, Lever, Workday, and more" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <f.icon className="w-4 h-4 text-indigo-500 shrink-0" />
              <p className="text-sm text-gray-700">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API status for developers */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Extension API Endpoints</h3>
          <p className="text-xs text-gray-500 mb-3">These endpoints are ready for extension integration:</p>
          <div className="space-y-1.5 font-mono text-xs">
            <p className="text-emerald-600">GET /api/v1/extension/status — Auth check</p>
            <p className="text-emerald-600">GET /api/v1/extension/check-url — Dedup detection</p>
            <p className="text-emerald-600">POST /api/v1/extension/capture — Save job</p>
            <p className="text-emerald-600">POST /api/v1/extension/quick-save — Quick save</p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Extension will be available for download soon. The backend is ready.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
