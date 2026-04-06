"use client"

import { Badge } from "@/components/ui/Badge"
import { PosterGenerator } from "@/components/PosterGenerator"
import {
  ExtensionPopupMock,
  AutofillProgressMock,
  AtsScoreMock,
  ResumeBeforeAfterMock,
} from "@/components/ui/MockPreview"
import {
  ChromeIcon as Chrome,
  Download,
  Check,
  Globe,
  Shield,
  Wand2,
  Bookmark,
  FileText,
  MousePointer,
  ExternalLink,
  Zap,
  ArrowRight,
  Sparkles,
  Target,
  MessageSquare,
} from "lucide-react"

export default function ExtensionPage() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">

      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-8 lg:p-10 text-white">
        {/* Decorative */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/[0.06] blur-xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-blue-400/10 blur-xl" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        </div>

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-8">
          {/* Left content */}
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/15 backdrop-blur-sm mb-4">
              <Chrome className="w-3 h-3" /> Browser Extension
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-3">
              YuktiHire Chrome Extension
            </h1>
            <p className="text-base text-white/60 max-w-md leading-relaxed mb-6">
              Save jobs from any website, autofill applications, and tailor resumes — all from your browser.
            </p>
            <a
              href="https://github.com/kolakrishna264/yuktihire/archive/refs/heads/main.zip"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-indigo-700 rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-xl shadow-black/10 hover:-translate-y-0.5"
            >
              <Download className="w-4 h-4" />
              Download Extension
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Right — floating mocks */}
          <div className="relative hidden lg:block w-72">
            <div className="animate-float">
              <ExtensionPopupMock />
            </div>
            <div className="absolute -bottom-4 -right-4 animate-float-delayed">
              <div className="bg-white rounded-xl p-2 shadow-xl">
                <AtsScoreMock score={88} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Install Steps ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 p-6">
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Quick setup (1 minute)
        </p>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { step: "1", text: "Download & unzip the file", icon: Download },
            { step: "2", text: "Open chrome://extensions", icon: Chrome },
            { step: "3", text: "Enable Developer Mode → Load unpacked", icon: Shield },
            { step: "4", text: "Select the apps/extension folder", icon: Check },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-indigo-100/60">
              <span className="w-7 h-7 rounded-lg gradient-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                {item.step}
              </span>
              <p className="text-xs text-gray-600 leading-relaxed pt-0.5">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature Posters ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-indigo-500" /> Extension Features
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <PosterGenerator
            title="Save Jobs Anywhere"
            subtitle="One click saves job details from LinkedIn, Indeed, Greenhouse, and any career page."
            icon={Bookmark}
            theme="indigo"
            badge="Core Feature"
          >
            <div className="space-y-1.5">
              {["LinkedIn", "Indeed", "Greenhouse", "Lever"].map(site => (
                <div key={site} className="flex items-center gap-2">
                  <Check className="w-3 h-3 text-emerald-300" />
                  <span className="text-[10px] text-white/70">{site}</span>
                </div>
              ))}
            </div>
          </PosterGenerator>

          <PosterGenerator
            title="Autofill Copilot"
            subtitle="Fill name, email, experience, and generate AI answers for custom questions."
            icon={Zap}
            theme="amber"
            badge="AI-Powered"
          >
            <AutofillVisualSmall />
          </PosterGenerator>

          <PosterGenerator
            title="Instant Resume Tailoring"
            subtitle="Trigger ATS scoring and AI tailoring directly from the extension."
            icon={Wand2}
            theme="violet"
            badge="One Click"
          >
            <ResumeBeforeAfterMock />
          </PosterGenerator>

          <PosterGenerator
            title="Smart Answer Memory"
            subtitle="Your answers are remembered and reused across applications automatically."
            icon={MessageSquare}
            theme="emerald"
            badge="Saves Time"
          >
            <div className="space-y-1.5">
              {[
                { q: "Why this company?", saved: true },
                { q: "Years of experience?", saved: true },
                { q: "Visa sponsorship?", saved: true },
              ].map(a => (
                <div key={a.q} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 flex items-center justify-center">
                    <span className="text-[6px] text-white font-bold">{"\u2713"}</span>
                  </div>
                  <span className="text-[10px] text-white/70">{a.q}</span>
                  <span className="ml-auto text-[8px] text-white/40">Saved</span>
                </div>
              ))}
            </div>
          </PosterGenerator>
        </div>
      </div>

      {/* ── How it Works ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">How it works</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            { icon: Globe, title: "Browse any job site", desc: "LinkedIn, Indeed, Greenhouse, Lever, company pages", gradient: "gradient-card-indigo", iconColor: "text-indigo-600" },
            { icon: MousePointer, title: "Click the extension", desc: "Job details are extracted automatically", gradient: "gradient-card-violet", iconColor: "text-violet-600" },
            { icon: Bookmark, title: "Save to YuktiHire", desc: "One click saves with full details", gradient: "gradient-card-emerald", iconColor: "text-emerald-600" },
            { icon: Wand2, title: "Tailor & Apply", desc: "AI tailors your resume, then apply", gradient: "gradient-card-amber", iconColor: "text-amber-600" },
          ].map((step, i) => (
            <div key={i} className="group rounded-2xl border border-gray-100 bg-white p-5 hover:shadow-lg hover:shadow-indigo-50 hover:-translate-y-0.5 transition-all duration-300">
              <div className={`w-10 h-10 rounded-xl ${step.gradient} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <step.icon className={`w-5 h-5 ${step.iconColor}`} />
              </div>
              <p className="text-sm font-bold text-gray-800 mb-1">{step.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Supported Sites ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Supported job sites</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {["LinkedIn", "Indeed", "Greenhouse", "Lever", "Workday", "Apple Careers", "Google Careers", "Any career page"].map((site) => (
            <div key={site} className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className="w-6 h-6 rounded-lg gradient-card-emerald flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">{site}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Extension Actions ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Extension actions</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { icon: Bookmark, text: "Save job with full details (title, company, JD, apply link)", gradient: "gradient-card-indigo", iconColor: "text-indigo-600" },
            { icon: Wand2, text: "Trigger instant resume tailoring — ATS score, skills, suggestions", gradient: "gradient-card-violet", iconColor: "text-violet-600" },
            { icon: ExternalLink, text: "Keep original apply link — apply on company's own portal", gradient: "gradient-card-emerald", iconColor: "text-emerald-600" },
            { icon: Check, text: "Detect if you already saved or applied to a job", gradient: "gradient-card-amber", iconColor: "text-amber-600" },
            { icon: FileText, text: "Track application status — saved, tailoring, tailored, applied", gradient: "gradient-card-cyan", iconColor: "text-cyan-600" },
            { icon: Shield, text: "Secure — uses your YuktiHire login session, no extra passwords", gradient: "gradient-card-rose", iconColor: "text-rose-600" },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className={`w-8 h-8 rounded-lg ${f.gradient} flex items-center justify-center shrink-0`}>
                <f.icon className={`w-4 h-4 ${f.iconColor}`} />
              </div>
              <p className="text-sm text-gray-700">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Autofill Features ──────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> Autofill Copilot
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: "Fill Everything", desc: "One click fills name, email, phone, LinkedIn, work authorization, and more", gradient: "gradient-card-indigo" },
            { title: "AI Answers", desc: "Generates answers for 'Why this company?', experience questions, and open-ended fields", gradient: "gradient-card-violet" },
            { title: "Answer Memory", desc: "Remembers your answers — reuses them on the next application automatically", gradient: "gradient-card-emerald" },
            { title: "Multi-Step Forms", desc: "Detects when new form sections appear and re-fills them", gradient: "gradient-card-amber" },
          ].map((f, i) => (
            <div key={i} className={`p-4 rounded-xl ${f.gradient} border border-white/60 hover:shadow-lg transition-all duration-300`}>
              <p className="text-sm font-bold text-gray-800 mb-1">{f.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Auth Info ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg gradient-card-indigo flex items-center justify-center">
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Signing into the extension</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          The extension uses your existing YuktiHire session. Just make sure you&apos;re signed in to yuktihire.com, then:
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            "Click the YuktiHire extension icon",
            "Click \"Sign in to YuktiHire\"",
            "Your session will be connected automatically",
            "Start saving jobs!",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
              <span className="w-6 h-6 rounded-lg gradient-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-gray-600">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Troubleshooting ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Troubleshooting</h2>
        <div className="space-y-2">
          {[
            { q: "Extension shows 'Not signed in'", a: "Open yuktihire.com in another tab and sign in. The extension reads your session cookie automatically." },
            { q: "Autofill isn't filling some fields", a: "Some fields use custom UI. Click the YH panel > 'Fill Everything' to retry. File uploads must be done manually." },
            { q: "Country dropdown shows wrong value", a: "Go to Profile > Application Info and set your work authorization type." },
            { q: "Extension doesn't appear on a page", a: "The extension only shows on job/career pages. Navigate to a job listing and the YH panel will appear." },
          ].map((item, i) => (
            <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-indigo-100 transition-colors">
              <p className="text-sm font-bold text-gray-700">{item.q}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Test Links ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Test the extension</h2>
        <p className="text-xs text-gray-500 mb-3">Try the extension on these job portals:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "Greenhouse", url: "https://boards.greenhouse.io/anthropic" },
            { name: "Lever", url: "https://jobs.lever.co/openai" },
            { name: "Rippling", url: "https://www.rippling.com/careers" },
            { name: "Workday", url: "https://www.google.com/about/careers/" },
          ].map((link) => (
            <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 bg-white hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all">
              <ExternalLink className="w-3 h-3" />
              {link.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Inline visual for autofill poster ─────────────────────────────────── */
function AutofillVisualSmall() {
  return (
    <div className="space-y-1.5">
      {[
        { label: "Full Name", done: true },
        { label: "Email", done: true },
        { label: "Phone", done: true },
        { label: "Why this role?", done: false },
      ].map(f => (
        <div key={f.label} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full flex items-center justify-center ${f.done ? "bg-emerald-400" : "bg-white/30"}`}>
            {f.done && <span className="text-[6px] text-white font-bold">{"\u2713"}</span>}
          </div>
          <span className={`text-[10px] ${f.done ? "text-white/60 line-through" : "text-amber-200 animate-pulse"}`}>{f.label}</span>
        </div>
      ))}
    </div>
  )
}
