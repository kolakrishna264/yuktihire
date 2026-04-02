"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

// ─── Magnetic Button ───────────────────────────────────────────────────────────
function MagneticButton({
  href,
  primary,
  children,
}: {
  href: string
  primary?: boolean
  children: React.ReactNode
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const distX = e.clientX - (rect.left + rect.width / 2)
    const distY = e.clientY - (rect.top + rect.height / 2)
    const dist = Math.sqrt(distX * distX + distY * distY)
    if (dist < 80) setPos({ x: distX * 0.2, y: distY * 0.2 })
  }

  return (
    <Link
      href={href}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: primary ? "14px 32px" : "13px 30px",
        fontSize: 15,
        fontWeight: 600,
        textDecoration: "none",
        borderRadius: 12,
        transition: "transform 0.15s ease-out, box-shadow 0.15s ease-out",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        letterSpacing: "-0.01em",
        cursor: "pointer",
        ...(primary
          ? {
              background: "linear-gradient(135deg, #6c63ff 0%, #8b5cf6 100%)",
              color: "#fff",
              boxShadow: "0 4px 20px rgba(108,99,255,0.4), 0 1px 0 rgba(255,255,255,0.15) inset",
            }
          : {
              background: "#fff",
              color: "#374151",
              border: "1.5px solid #e5e7eb",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }),
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        if (primary) el.style.boxShadow = "0 8px 28px rgba(108,99,255,0.5), 0 1px 0 rgba(255,255,255,0.15) inset"
        else el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"
      }}
    >
      {children}
    </Link>
  )
}

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1500, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
const STATS = [
  { value: 2847, suffix: "+", label: "Resumes tailored" },
  { value: 89, suffix: "%", label: "Avg ATS score achieved" },
  { value: 3, suffix: "x", label: "More interviews" },
  { value: 60, suffix: "s", label: "Setup time" },
]

function StatItem({ value, suffix, label, active }: typeof STATS[0] & { active: boolean }) {
  const count = useCountUp(value, 1500, active)
  return (
    <div>
      <p style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, color: "#6c63ff", letterSpacing: "-0.03em", margin: "0 0 4px", lineHeight: 1 }}>
        {count.toLocaleString()}{suffix}
      </p>
      <p style={{ fontSize: 13, color: "#6b7280", fontWeight: 500, margin: 0 }}>{label}</p>
    </div>
  )
}

function StatsBar() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ background: "#f8f7ff", borderTop: "1px solid #ede9fe", borderBottom: "1px solid #ede9fe" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "24px 32px", textAlign: "center" }}>
        {STATS.map((s) => <StatItem key={s.label} {...s} active={visible} />)}
      </div>
    </div>
  )
}

// ─── Step card ────────────────────────────────────────────────────────────────
function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div
      style={{ background: "#fff", border: "1.5px solid #f3f4f6", borderRadius: 20, padding: "32px 28px", position: "relative", overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#c4b5fd"; el.style.boxShadow = "0 8px 32px rgba(108,99,255,0.12)"; el.style.transform = "translateY(-3px)" }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#f3f4f6"; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; el.style.transform = "translateY(0)" }}
    >
      <div style={{ position: "absolute", top: 16, right: 20, fontSize: 64, fontWeight: 900, color: "rgba(108,99,255,0.05)", lineHeight: 1, userSelect: "none" }}>{number}</div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #ede9fe, #ddd6fe)", border: "1px solid #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#6c63ff", marginBottom: 20 }}>{number}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 10px", letterSpacing: "-0.02em" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.65, margin: 0 }}>{description}</p>
    </div>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div
      style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", border: "1.5px solid #f3f4f6", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#c4b5fd"; el.style.boxShadow = "0 12px 40px rgba(108,99,255,0.12)"; el.style.transform = "translateY(-4px) scale(1.01)" }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#f3f4f6"; el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; el.style.transform = "translateY(0) scale(1)" }}
    >
      <div style={{ fontSize: 28, marginBottom: 16, width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.01em" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.65, margin: 0 }}>{description}</p>
    </div>
  )
}

// ─── Testimonial card ─────────────────────────────────────────────────────────
function TestimonialCard({ quote, name, role, score, initials, color }: { quote: string; name: string; role: string; score: number; initials: string; color: string }) {
  return (
    <div style={{ background: "#fff", border: "1.5px solid #f3f4f6", borderRadius: 20, padding: "28px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ padding: "4px 10px", background: "linear-gradient(135deg, #ede9fe, #ddd6fe)", border: "1px solid #c4b5fd", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "#6c63ff" }}>ATS {score}%</div>
        <div style={{ display: "flex", gap: 1 }}>{Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ color: "#f59e0b", fontSize: 14 }}>★</span>)}</div>
      </div>
      <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0, flex: 1 }}>"{quote}"</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>{name}</p>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{role}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const steps = [
  { number: "1", title: "Upload Your Resume", description: "Drop your PDF or DOCX. We extract your full profile — experience, skills, and education — in seconds." },
  { number: "2", title: "Get Matched to Jobs", description: "Paste a job description and see your ATS match score instantly. Know exactly where you stand before applying." },
  { number: "3", title: "Tailor with AI", description: "One click to optimize keywords, rewrite bullets, and boost your score to 85%+. No manual editing needed." },
  { number: "4", title: "Track Everything", description: "Manage applications in a visual pipeline. Know what's pending, what's hot, and what needs follow-up." },
]

const features = [
  { icon: "🎯", title: "ATS Score Engine", description: "Real-time scoring against any job description. See keyword gaps, match percentages, and section breakdowns." },
  { icon: "✨", title: "AI Tailoring", description: "Claude AI rewrites your bullets, summary, and skills to match each job — keeping your voice, improving impact." },
  { icon: "📋", title: "Smart Keyword Insertion", description: "Click any missing keyword to instantly add it to your skills or summary. Watch your score rise in real time." },
  { icon: "📁", title: "Resume Versions", description: "Every tailored resume is auto-saved as a version. Restore, compare, or export any version at any time." },
  { icon: "🗂️", title: "Application Tracker", description: "Kanban board to track every application from saved to offer. Drag between stages as you progress." },
  { icon: "📤", title: "One-Click Export", description: "Export your tailored resume as a polished PDF or DOCX. ATS-friendly formatting, every time." },
]

const testimonials = [
  { quote: "I applied to 20 jobs before YuktiHire. In the first week after, I got 4 callbacks. The ATS scoring changed everything.", name: "Priya M.", role: "Software Engineer at Stripe", score: 91, initials: "PM", color: "linear-gradient(135deg, #6c63ff, #a78bfa)" },
  { quote: "The keyword insertion feature is genius. I could literally watch my ATS score go from 52% to 88% in real time.", name: "James L.", role: "Product Manager at Figma", score: 88, initials: "JL", color: "linear-gradient(135deg, #10b981, #34d399)" },
  { quote: "I was skeptical about AI resume tools. But YuktiHire actually understands context. My summary now sounds like me — just better.", name: "Sarah K.", role: "Data Scientist at Airbnb", score: 94, initials: "SK", color: "linear-gradient(135deg, #f59e0b, #fcd34d)" },
]

const socialProofAvatars = [
  { initials: "AR", bg: "linear-gradient(135deg, #6c63ff, #a78bfa)" },
  { initials: "MK", bg: "linear-gradient(135deg, #10b981, #34d399)" },
  { initials: "JL", bg: "linear-gradient(135deg, #f59e0b, #fbbf24)" },
  { initials: "SP", bg: "linear-gradient(135deg, #ef4444, #f87171)" },
  { initials: "TN", bg: "linear-gradient(135deg, #3b82f6, #60a5fa)" },
  { initials: "RV", bg: "linear-gradient(135deg, #8b5cf6, #c084fc)" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MarketingPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbFloat1 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(28px, -18px) scale(1.04); }
        }
        @keyframes orbFloat2 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(-18px, 22px) scale(0.97); }
        }
        @keyframes orbFloat3 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(12px, -28px) scale(1.03); }
        }
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(108,99,255,0.2); }
          50%       { box-shadow: 0 0 0 6px rgba(108,99,255,0); }
        }
        * { box-sizing: border-box; }
      `}</style>

      <main
        style={{
          minHeight: "100vh",
          background: "#ffffff",
          color: "#111827",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif",
          overflowX: "hidden",
        }}
      >
        {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #6c63ff, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff", flexShrink: 0 }}>Y</div>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>YuktiHire</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link
                href="/auth/login"
                style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "#6b7280", textDecoration: "none", borderRadius: 9, transition: "color 0.15s, background 0.15s" }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.color = "#111827"; el.style.background = "#f9fafb" }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.color = "#6b7280"; el.style.background = "transparent" }}
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                style={{ padding: "9px 18px", fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #6c63ff, #8b5cf6)", textDecoration: "none", borderRadius: 9, boxShadow: "0 2px 10px rgba(108,99,255,0.3)", transition: "box-shadow 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 16px rgba(108,99,255,0.45)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 10px rgba(108,99,255,0.3)")}
              >
                Get started free
              </Link>
            </div>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            textAlign: "center",
            padding: "clamp(60px, 8vw, 100px) 24px clamp(56px, 7vw, 90px)",
            overflow: "hidden",
            background: "linear-gradient(180deg, #faf9ff 0%, #ffffff 100%)",
          }}
        >
          {/* Orbs */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-15%", left: "5%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,99,255,0.11) 0%, transparent 70%)", animation: "orbFloat1 9s ease-in-out infinite alternate", filter: "blur(50px)" }} />
            <div style={{ position: "absolute", top: "0%", right: "0%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.09) 0%, transparent 70%)", animation: "orbFloat2 9s ease-in-out infinite alternate", filter: "blur(60px)" }} />
            <div style={{ position: "absolute", bottom: "-5%", left: "45%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)", animation: "orbFloat3 9s ease-in-out infinite alternate", filter: "blur(70px)" }} />
          </div>

          <div style={{ position: "relative", maxWidth: 820, margin: "0 auto" }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28, padding: "5px 14px 5px 10px", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 999, animation: "badgePulse 3s ease-in-out infinite" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6c63ff", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6c63ff", letterSpacing: "0.06em", textTransform: "uppercase" }}>AI-Powered Career Platform</span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: "clamp(42px, 7vw, 80px)", fontWeight: 900, lineHeight: 1.07, letterSpacing: "-0.03em", margin: "0 0 24px" }}>
              {[
                { text: "Upload once.", dark: true },
                { text: "Match jobs.", dark: true },
                { text: "Tailor to 85%+.", dark: false },
                { text: "Track everything.", dark: false },
              ].map((line, i) => (
                <span key={i} style={{ display: "block", color: line.dark ? "#111827" : "#6c63ff", opacity: 0, animation: `fadeUp 0.55s ease-out ${0.1 + i * 0.1}s forwards` }}>
                  {line.text}
                </span>
              ))}
            </h1>

            {/* Subtitle */}
            <p style={{ fontSize: "clamp(16px, 2.2vw, 19px)", color: "#6b7280", lineHeight: 1.7, maxWidth: 560, margin: "0 auto 40px" }}>
              YuktiHire reads your resume, scores it against real job descriptions, rewrites it with AI, and tracks every application — all in one place.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <MagneticButton href="/auth/signup" primary>Start for Free — No Credit Card</MagneticButton>
              <MagneticButton href="/auth/login">Sign In →</MagneticButton>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 28 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {socialProofAvatars.map((a, i) => (
                  <div key={a.initials} style={{ width: 30, height: 30, borderRadius: "50%", background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", border: "2px solid #fff", marginLeft: i === 0 ? 0 : -9, flexShrink: 0 }}>{a.initials}</div>
                ))}
              </div>
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Join 2,800+ job seekers using YuktiHire</span>
            </div>
            <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>No credit card required · Free plan · Setup in 60 seconds</p>
          </div>
        </section>

        {/* ── STATS BAR ──────────────────────────────────────────────────── */}
        <StatsBar />

        {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
        <section style={{ padding: "clamp(64px, 8vw, 100px) 24px", background: "#fff" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6c63ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>How it works</p>
              <h2 style={{ fontSize: "clamp(26px, 3.8vw, 42px)", fontWeight: 800, letterSpacing: "-0.025em", color: "#111827", margin: "0 auto", maxWidth: 520 }}>
                From resume to offer in four steps
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
              {steps.map((s) => <StepCard key={s.number} {...s} />)}
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────────────────── */}
        <section style={{ padding: "clamp(64px, 8vw, 100px) 24px", background: "#faf9ff", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6c63ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Features</p>
              <h2 style={{ fontSize: "clamp(26px, 3.8vw, 42px)", fontWeight: 800, letterSpacing: "-0.025em", color: "#111827", margin: 0 }}>
                Everything you need to get hired
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
              {features.map((f) => <FeatureCard key={f.title} {...f} />)}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ────────────────────────────────────────────────── */}
        <section style={{ padding: "clamp(64px, 8vw, 100px) 24px", background: "#fff" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6c63ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Testimonials</p>
              <h2 style={{ fontSize: "clamp(26px, 3.8vw, 42px)", fontWeight: 800, letterSpacing: "-0.025em", color: "#111827", margin: 0 }}>
                Real people, real results
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
              {testimonials.map((t) => <TestimonialCard key={t.name} {...t} />)}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
        <section style={{ padding: "clamp(80px, 10vw, 120px) 24px", textAlign: "center", background: "linear-gradient(135deg, #1a1035 0%, #0f0a2a 40%, #12103a 100%)", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 800, height: 500, background: "radial-gradient(ellipse, rgba(108,99,255,0.22) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Get started today</p>
            <h2 style={{ fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 18px", background: "linear-gradient(160deg, #ffffff 40%, #c4b5fd 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Your next job starts here
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, marginBottom: 40 }}>
              Upload your resume once. Let AI do the tailoring. Land the role you've been working toward.
            </p>
            <MagneticButton href="/auth/signup" primary>Start for Free — No Credit Card</MagneticButton>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", marginTop: 18 }}>Free plan · No credit card · Takes 60 seconds</p>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ background: "#0f0a2a", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "36px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #6c63ff, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>Y</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>YuktiHire</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>© {new Date().getFullYear()} YuktiHire. All rights reserved.</p>
            <div style={{ display: "flex", gap: 24 }}>
              {[{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Sign In", href: "/auth/login" }].map((link) => (
                <Link key={link.label} href={link.href} style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.3)")}
                >{link.label}</Link>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
