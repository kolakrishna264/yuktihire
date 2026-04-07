"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Zap, Target, Wand2, FileText, ChromeIcon as Chrome, BarChart3,
  Building2, Send, ArrowRight, Sparkles,
  Upload, Bookmark, CheckCircle,
  Bot, Search, Star,
} from "lucide-react"
import {
  DashboardMock,
  ExtensionPopupMock,
  AtsScoreMock,
  AutofillProgressMock,
  ResumeBeforeAfterMock,
} from "@/components/ui/MockPreview"

/* ─── Count-up hook ──────────────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1600, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let t0: number | null = null
    const step = (ts: number) => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / duration, 1)
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

/* ─── Intersection observer hook ─────────────────────────────────────────── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Data ───────────────────────────────────────────────────────────────── */
const ALL_FEATURES = [
  { icon: Search, title: "Smart Keywords", desc: "Click any missing keyword to add it instantly. Watch your ATS score climb.", iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
  { icon: FileText, title: "Cover Letters", desc: "Generate job-specific cover letters in seconds. Professional, concise, or technical.", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
  { icon: BarChart3, title: "Application Tracker", desc: "Track every application from saved to offer with pipeline analytics.", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  { icon: Bot, title: "Interview Prep", desc: "AI generates role-specific questions with answers from your actual experience.", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  { icon: Building2, title: "Company Intelligence", desc: "AI-powered briefs — tech stack, interview difficulty, talking points.", iconBg: "bg-cyan-100", iconColor: "text-cyan-600" },
  { icon: Send, title: "Recruiter Outreach", desc: "Generate personalized LinkedIn messages and referral requests.", iconBg: "bg-rose-100", iconColor: "text-rose-600" },
]

const STEPS = [
  { icon: Upload, num: "01", title: "Upload Resume", desc: "Drop your PDF or DOCX. We extract your full professional profile in seconds." },
  { icon: Bookmark, num: "02", title: "Save Job", desc: "Use the browser extension to save any job listing with one click." },
  { icon: Wand2, num: "03", title: "Auto Tailor", desc: "AI rewrites your resume for each job. Hit 85%+ ATS score effortlessly." },
  { icon: Zap, num: "04", title: "Auto Fill", desc: "Autofill applications, generate answers, and track everything in one place." },
]

const TESTIMONIALS = [
  { quote: "I went from mass-applying with the same resume to getting 4 callbacks in one week. The ATS scoring changed everything.", name: "Priya M.", role: "Software Engineer at Stripe", score: 91, initials: "PM", color: "#6c63ff" },
  { quote: "The keyword insertion is brilliant. I watched my ATS score go from 52% to 88% by clicking a few buttons.", name: "James L.", role: "Product Manager at Figma", score: 88, initials: "JL", color: "#10b981" },
  { quote: "YuktiHire actually understands context — my summary sounds like me, just sharper. This isn't generic AI.", name: "Sarah K.", role: "Data Scientist at Airbnb", score: 94, initials: "SK", color: "#f59e0b" },
]

const LOGOS = ["Stripe", "Google", "Meta", "Airbnb", "Figma", "Notion"]

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function MarketingPage() {
  const stats = useInView(0.3)
  const s1 = useCountUp(12400, 1600, stats.visible)
  const s2 = useCountUp(89, 1200, stats.visible)
  const s3 = useCountUp(3, 800, stats.visible)
  const s4 = useCountUp(60, 1000, stats.visible)

  return (
    <div className="bg-white text-gray-900 overflow-x-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100/80">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center font-black text-sm text-white shadow-lg shadow-indigo-300/30">Y</div>
            <span className="font-extrabold text-lg tracking-tight text-gray-900">YuktiHire</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {["Features", "How it Works", "Testimonials"].map(t => (
              <a key={t} href={`#${t.toLowerCase().replace(/ /g, "-")}`}
                className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-all no-underline">
                {t}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/auth/login" className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 no-underline transition-colors">
              Sign In
            </Link>
            <Link href="/auth/signup"
              className="px-5 py-2.5 text-sm font-semibold text-white gradient-primary rounded-xl no-underline shadow-lg shadow-indigo-400/30 hover:shadow-xl hover:shadow-indigo-400/40 hover:-translate-y-0.5 transition-all duration-200">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background mesh */}
        <div className="absolute inset-0 gradient-mesh" />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-indigo-500/[0.06] blur-[80px] animate-float-slow" />
          <div className="absolute top-20 right-10 w-[400px] h-[400px] rounded-full bg-purple-500/[0.04] blur-[60px] animate-float-delayed" />
          <div className="absolute -bottom-20 left-1/2 w-[500px] h-[500px] rounded-full bg-blue-500/[0.04] blur-[70px] animate-float" />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">AI-Powered Career Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-black leading-[1.08] tracking-[-0.035em] mb-6">
                Apply to jobs 10x faster with{" "}
                <span className="text-gradient-hero">AI Autofill + Resume Tailoring</span>
              </h1>

              <p className="text-lg text-gray-500 leading-relaxed max-w-lg mb-8">
                YuktiHire auto-fills applications, tailors resumes, and boosts ATS score instantly. Stop sending the same resume everywhere.
              </p>

              <div className="flex flex-wrap gap-3 mb-8">
                <Link href="/auth/signup"
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-base font-bold text-white gradient-primary rounded-2xl no-underline shadow-xl shadow-indigo-400/30 hover:shadow-2xl hover:shadow-indigo-400/40 hover:-translate-y-0.5 transition-all duration-200">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/dashboard/extension"
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-gray-600 bg-white border-2 border-gray-200 rounded-2xl no-underline hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200">
                  <Chrome className="w-4 h-4" />
                  Install Extension
                </Link>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {[
                    { i: "AR", bg: "#6c63ff" }, { i: "MK", bg: "#10b981" }, { i: "JL", bg: "#f59e0b" },
                    { i: "SP", bg: "#ef4444" }, { i: "TN", bg: "#3b82f6" },
                  ].map((a) => (
                    <div key={a.i} className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-[2.5px] border-white" style={{ background: a.bg }}>
                      {a.i}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div>
                  <p className="text-xs text-gray-400 font-medium">Trusted by 12,000+ job seekers</p>
                </div>
              </div>
            </div>

            {/* Right — visual mocks */}
            <div className="relative hidden lg:block">
              {/* Main dashboard */}
              <div className="animate-float-slow">
                <DashboardMock />
              </div>

              {/* Extension popup floating */}
              <div className="absolute -left-8 top-8 animate-float-delayed z-10">
                <ExtensionPopupMock />
              </div>

              {/* ATS score floating */}
              <div className="absolute -right-4 -bottom-4 bg-white rounded-2xl p-3 shadow-xl shadow-indigo-100/50 border border-gray-100/80 animate-float z-10">
                <AtsScoreMock score={92} />
              </div>

              {/* Autofill mock floating */}
              <div className="absolute right-0 top-0 z-20 animate-float">
                <div className="scale-75 origin-top-right">
                  <AutofillProgressMock />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUSTED BY ───────────────────────────────────────────────────── */}
      <div className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-[1000px] mx-auto px-6 py-8 flex flex-col items-center">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-5">Users from top companies trust YuktiHire</p>
          <div className="flex items-center gap-10 flex-wrap justify-center">
            {LOGOS.map(name => (
              <span key={name} className="text-lg font-bold text-gray-300 tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <div ref={stats.ref} className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDYwVjBoNjAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgZmlsbD0ibm9uZSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
        </div>
        <div className="relative max-w-[1000px] mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-white">
          {[
            { v: s1, s: "+", l: "Resumes tailored" },
            { v: s2, s: "%", l: "Avg ATS score" },
            { v: s3, s: "x", l: "More callbacks" },
            { v: s4, s: "s", l: "Setup time" },
          ].map(d => (
            <div key={d.l}>
              <p className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-1">{d.v.toLocaleString()}{d.s}</p>
              <p className="text-sm text-white/60 font-medium">{d.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 lg:py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 gradient-mesh opacity-50" />
        <div className="relative max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 mb-4">
              <Sparkles className="w-3 h-3" /> Features
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              Everything you need to <span className="text-gradient-hero">get hired</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Four powerful tools that work together to land you more interviews, faster.</p>
          </div>

          {/* ── Feature 1: AI Autofill — full width showcase ──────────── */}
          <div className="mb-8 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-1">
            <div className="rounded-[22px] bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white p-8 lg:p-10 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/[0.06]" />
                <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-white/[0.04]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              </div>
              <div className="relative grid lg:grid-cols-2 gap-8 items-center">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm mb-4">
                    <Zap className="w-3 h-3" /> Most Popular
                  </span>
                  <h3 className="text-2xl lg:text-3xl font-black tracking-tight mb-3">AI Autofill Copilot</h3>
                  <p className="text-base text-white/70 leading-relaxed mb-6 max-w-md">
                    One click fills name, email, experience, and generates AI answers for custom questions. Saves 12+ min per application.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Form Detection", "AI Answers", "Smart Autofill", "Multi-Step"].map(tag => (
                      <span key={tag} className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-sm">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center lg:justify-end">
                  <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 p-5 w-full max-w-xs">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-bold">Autofilling application...</span>
                      <span className="ml-auto text-xs font-bold text-amber-200">78%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 mb-5 overflow-hidden">
                      <div className="h-full rounded-full bg-white/60 w-[78%]" />
                    </div>
                    <AutofillVisual />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Feature 2 + 3: side by side ──────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            {/* Resume Tailoring */}
            <div className="rounded-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 text-white p-7 lg:p-8 relative overflow-hidden group hover:shadow-2xl hover:shadow-purple-300/20 hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06]" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/[0.04]" />
                <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-full bg-white/[0.03] group-hover:scale-[3] transition-transform duration-700" />
              </div>
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm mb-4">
                  <Wand2 className="w-3 h-3" /> AI-Powered
                </span>
                <h3 className="text-xl font-bold tracking-tight mb-2">Resume Tailoring</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5 max-w-sm">
                  AI rewrites your bullets, summary, and skills for each job. Your voice, but sharper and ATS-optimized.
                </p>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/10">
                  <ResumeBeforeAfterMock />
                </div>
              </div>
            </div>

            {/* ATS Score Engine */}
            <div className="rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 text-white p-7 lg:p-8 relative overflow-hidden group hover:shadow-2xl hover:shadow-blue-300/20 hover:-translate-y-0.5 transition-all duration-300">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06]" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/[0.04]" />
                <div className="absolute top-1/2 left-1/4 w-20 h-20 rounded-full bg-white/[0.03] group-hover:scale-[3] transition-transform duration-700" />
              </div>
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm mb-4">
                  <Target className="w-3 h-3" /> Real-Time
                </span>
                <h3 className="text-xl font-bold tracking-tight mb-2">ATS Score Engine</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5 max-w-sm">
                  Real-time scoring with keyword gaps, skill analysis, section breakdowns. Watch your score climb from 52% to 92%.
                </p>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/10">
                  <AtsVisual />
                </div>
              </div>
            </div>
          </div>

          {/* ── Feature 4: Save Jobs — wide card ─────────────────────── */}
          <div className="mb-16 rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white p-7 lg:p-8 relative overflow-hidden group hover:shadow-2xl hover:shadow-emerald-300/20 transition-all duration-300">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.06]" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/[0.04]" />
            </div>
            <div className="relative grid lg:grid-cols-[1fr,auto] gap-8 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-sm mb-4">
                  <Chrome className="w-3 h-3" /> Browser Extension
                </span>
                <h3 className="text-xl font-bold tracking-tight mb-2">Save Jobs Anywhere</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-5 max-w-lg">
                  Browser extension detects jobs on LinkedIn, Indeed, Greenhouse. One click saves with full details to your dashboard.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["LinkedIn", "Indeed", "Greenhouse", "Lever", "Workday", "Any Site"].map(site => (
                    <span key={site} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-sm">
                      <CheckCircle className="w-3 h-3 text-emerald-200" /> {site}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm p-4 border border-white/10 w-full lg:w-64">
                <ExtensionVisual />
              </div>
            </div>
          </div>

          {/* ── More features grid ───────────────────────────────────── */}
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">And so much more</h3>
            <p className="text-sm text-gray-400 mt-1">Everything else you need to land your dream job.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_FEATURES.map(f => (
              <div key={f.title} className="group rounded-2xl border border-gray-100 bg-white p-5 hover:shadow-xl hover:shadow-indigo-100/40 hover:-translate-y-0.5 transition-all duration-300">
                <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 lg:py-28 px-6 bg-gray-50/80 border-y border-gray-100">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 mb-4">
              How It Works
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4">
              From resume to offer in <span className="text-gradient-hero">four steps</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative group">
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-10 left-full w-full h-[2px] bg-gradient-to-r from-indigo-200 to-transparent z-0" />
                )}
                <div className="relative rounded-2xl bg-white border border-gray-100 p-6 hover:shadow-xl hover:shadow-indigo-100/40 hover:-translate-y-1 transition-all duration-300">
                  {/* Step number watermark */}
                  <span className="absolute top-4 right-5 text-6xl font-black text-indigo-500/[0.06] leading-none select-none">{s.num}</span>

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg shadow-indigo-300/20 group-hover:scale-110 transition-transform">
                    <s.icon className="w-5 h-5 text-white" />
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2 tracking-tight">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUE PROP ───────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-[900px] mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-5">
            Stop sending the same resume to <span className="text-gradient-hero">every job</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Most applicants send one generic resume everywhere and wonder why they never hear back. YuktiHire tailors your resume, scores it, generates cover letters, autofills applications, and tracks everything.
          </p>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto text-left">
            <div className="rounded-2xl bg-red-50 border border-red-200/60 p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <span className="text-red-500 text-xs font-bold">{"\u2717"}</span>
                </div>
                <p className="text-sm font-bold text-red-600">Without YuktiHire</p>
              </div>
              <ul className="space-y-2">
                {["Same resume everywhere", "Low response rate", "Manual tracking", "Missed keywords", "Generic applications"].map(t => (
                  <li key={t} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-1 h-1 rounded-full bg-red-300" />{t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200/60 p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-emerald-600">With YuktiHire</p>
              </div>
              <ul className="space-y-2">
                {["Tailored resume per job", "85%+ ATS score", "Auto-tracked pipeline", "AI cover letters", "Smart autofill"].map(t => (
                  <li key={t} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 lg:py-28 px-6 bg-gray-50/80 border-y border-gray-100">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 mb-4">
              Testimonials
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
              Real people, <span className="text-gradient-hero">real results</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl bg-white border border-gray-100 p-6 hover:shadow-xl hover:shadow-indigo-100/30 transition-all duration-300 flex flex-col">
                {/* ATS + stars */}
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">ATS {t.score}%</span>
                  <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-5">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: t.color }}>{t.initials}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="relative py-24 lg:py-32 px-6 overflow-hidden bg-[#0d0a2a]">
        {/* Gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-indigo-600/20 via-purple-600/15 to-blue-600/20 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-[700px] mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-indigo-300 backdrop-blur-sm mb-6">
            <Sparkles className="w-3 h-3" /> Get Started Today
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-5 bg-gradient-to-br from-white via-white to-indigo-200 bg-clip-text text-transparent">
            Your next interview starts here
          </h2>
          <p className="text-lg text-white/40 leading-relaxed mb-8 max-w-lg mx-auto">
            Upload your resume. Let AI do the tailoring. Land the role you deserve.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white gradient-primary rounded-2xl no-underline shadow-xl shadow-indigo-600/30 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-200">
              Start Free — No Credit Card
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard/extension"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-semibold text-white/70 border border-white/10 rounded-2xl no-underline hover:border-white/25 hover:text-white transition-all duration-200">
              <Chrome className="w-4 h-4" />
              Install Extension
            </Link>
          </div>
          <p className="text-xs text-white/20 mt-5">Free plan &middot; No credit card &middot; Setup in 60 seconds</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-[#0a0820] border-t border-white/[0.04] px-6 py-10">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between flex-wrap gap-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-xs font-black text-white">Y</div>
            <span className="text-sm font-bold text-white/50">YuktiHire</span>
          </div>
          <p className="text-xs text-white/20">&copy; {new Date().getFullYear()} YuktiHire. All rights reserved.</p>
          <div className="flex gap-6">
            {[{ l: "Privacy", h: "/privacy" }, { l: "Terms", h: "/terms" }, { l: "Sign In", h: "/auth/login" }].map(lk => (
              <Link key={lk.l} href={lk.h} className="text-xs text-white/25 hover:text-white/60 no-underline transition-colors">{lk.l}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─── Inline Visual Components ──────────────────────────────────────────── */

function AutofillVisual() {
  return (
    <div className="space-y-1.5">
      {[
        { label: "Full Name", value: "Priya Mehta", done: true },
        { label: "Email", value: "priya@gmail.com", done: true },
        { label: "LinkedIn", value: "linkedin.com/in/priya", done: true },
        { label: "Why this role?", value: "AI generating...", done: false },
      ].map(f => (
        <div key={f.label} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full flex items-center justify-center ${f.done ? "bg-emerald-400" : "bg-white/30"}`}>
            {f.done && <span className="text-[6px] text-white font-bold">{"\u2713"}</span>}
          </div>
          <span className="text-[10px] text-white/50 w-16 shrink-0">{f.label}</span>
          <span className={`text-[10px] ${f.done ? "text-white/80" : "text-amber-300 animate-pulse"}`}>{f.value}</span>
        </div>
      ))}
    </div>
  )
}

function AtsVisual() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
          <circle cx="30" cy="30" r="24" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${0.92 * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
            transform="rotate(-90 30 30)" />
          <text x="30" y="33" textAnchor="middle" fill="white" style={{ fontSize: 14, fontWeight: 800 }}>92%</text>
        </svg>
      </div>
      <div className="space-y-1 flex-1">
        {[
          { label: "Keywords", pct: 95 },
          { label: "Skills", pct: 88 },
          { label: "Format", pct: 100 },
        ].map(b => (
          <div key={b.label}>
            <div className="flex justify-between mb-0.5">
              <span className="text-[9px] text-white/50">{b.label}</span>
              <span className="text-[9px] text-white/70">{b.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-white/60" style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExtensionVisual() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 rounded-lg bg-white/10 p-2">
        <div className="w-5 h-5 rounded bg-white/20 flex items-center justify-center text-[8px] font-bold">Y</div>
        <span className="text-[10px] font-semibold">Job detected on LinkedIn</span>
        <span className="ml-auto px-1.5 py-0.5 rounded bg-emerald-500/30 text-[8px] font-bold text-emerald-200">NEW</span>
      </div>
      <div className="flex items-center gap-2 text-[9px] text-white/50">
        <span>Software Engineer</span>
        <span>&middot;</span>
        <span>Stripe</span>
        <span>&middot;</span>
        <span>San Francisco</span>
      </div>
      <div className="flex gap-2 mt-1">
        <div className="flex-1 py-1 rounded bg-white/20 text-center text-[9px] font-semibold">Save & Tailor</div>
        <div className="flex-1 py-1 rounded bg-white/10 text-center text-[9px] font-medium text-white/60">Autofill</div>
      </div>
    </div>
  )
}
