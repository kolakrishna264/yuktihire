"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

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

/* ─── Data ───────────────────────────────────────────────────────────────── */
const STEPS = [
  { num: "01", title: "Upload Your Resume", desc: "Drop your PDF or DOCX. We extract your full professional profile — experience, skills, education — in seconds." },
  { num: "02", title: "Match & Score", desc: "Paste any job description. Get an instant ATS match score with a breakdown of keywords, skills, and gaps." },
  { num: "03", title: "Tailor with AI", desc: "One click to rewrite bullets, optimize skills, and insert missing keywords. Hit 85%+ ATS score effortlessly." },
  { num: "04", title: "Apply & Track", desc: "Use the browser extension to autofill applications, track every job, and manage your pipeline in one place." },
]

const FEATURES = [
  { icon: "🎯", title: "ATS Match Scoring", desc: "Real-time scoring against any job description with keyword gaps, skill analysis, and section breakdowns." },
  { icon: "✨", title: "AI Resume Tailoring", desc: "Claude AI rewrites your bullets and summary for each job — keeping your voice while improving impact." },
  { icon: "⚡", title: "Apply Copilot", desc: "Browser extension detects application forms and autofills name, email, experience — even generates AI answers for custom questions." },
  { icon: "🔑", title: "Smart Keywords", desc: "Click any missing keyword to add it to your resume instantly. Watch your ATS score climb in real time." },
  { icon: "📄", title: "Cover Letters", desc: "Generate job-specific cover letters in seconds. Choose professional, concise, or technical tone." },
  { icon: "📊", title: "Application Tracker", desc: "Track every application from saved to offer. Status updates, follow-up reminders, and pipeline analytics." },
  { icon: "🎤", title: "Interview Prep", desc: "AI generates role-specific questions with suggested answers grounded in your actual resume and experience." },
  { icon: "🏢", title: "Company Intelligence", desc: "Get AI-powered company briefs — tech stack, interview difficulty, talking points, and resume focus tips." },
  { icon: "💬", title: "Recruiter Outreach", desc: "Generate personalized LinkedIn messages, cold emails, and referral requests for any role." },
]

const TESTIMONIALS = [
  { quote: "I went from mass-applying with the same resume to getting 4 callbacks in one week. The ATS scoring changed everything for me.", name: "Priya M.", role: "Software Engineer at Stripe", score: 91, initials: "PM", color: "#6c63ff" },
  { quote: "The keyword insertion is brilliant. I watched my ATS score go from 52% to 88% by clicking a few buttons. No other tool does this.", name: "James L.", role: "Product Manager at Figma", score: 88, initials: "JL", color: "#10b981" },
  { quote: "I was skeptical about AI resume tools. But YuktiHire actually understands context — my summary sounds like me, just sharper.", name: "Sarah K.", role: "Data Scientist at Airbnb", score: 94, initials: "SK", color: "#f59e0b" },
]

const AVATARS = [
  { i: "AR", bg: "#6c63ff" }, { i: "MK", bg: "#10b981" }, { i: "JL", bg: "#f59e0b" },
  { i: "SP", bg: "#ef4444" }, { i: "TN", bg: "#3b82f6" }, { i: "RV", bg: "#8b5cf6" },
]

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function MarketingPage() {
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.3 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  const s1 = useCountUp(12400, 1600, statsVisible)
  const s2 = useCountUp(89, 1200, statsVisible)
  const s3 = useCountUp(3, 800, statsVisible)
  const s4 = useCountUp(60, 1000, statsVisible)

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes float1 { 0%,100% { transform:translate(0,0) scale(1) } 50% { transform:translate(30px,-20px) scale(1.05) } }
        @keyframes float2 { 0%,100% { transform:translate(0,0) scale(1) } 50% { transform:translate(-20px,25px) scale(0.97) } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ background: "#fff", color: "#0f172a", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", overflowX: "hidden" }}>

        {/* ── NAV ──────────────────────────────────────────────────────────── */}
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6c63ff, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: "#fff" }}>Y</div>
              <span style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", letterSpacing: "-0.03em" }}>YuktiHire</span>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {["Features", "How it Works", "Testimonials"].map(t => (
                <a key={t} href={`#${t.toLowerCase().replace(/ /g, "-")}`} style={{ padding: "8px 14px", fontSize: 14, fontWeight: 500, color: "#64748b", textDecoration: "none", borderRadius: 8, transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#0f172a")} onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}>{t}</a>
              ))}
              <Link href="/auth/login" style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500, color: "#64748b", textDecoration: "none" }}>Sign In</Link>
              <Link href="/auth/signup" style={{ padding: "10px 22px", fontSize: 14, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg, #6c63ff, #8b5cf6)", textDecoration: "none", borderRadius: 10, boxShadow: "0 2px 12px rgba(108,99,255,0.3)", transition: "box-shadow 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(108,99,255,0.45)")} onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(108,99,255,0.3)")}>Start Free</Link>
            </div>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", textAlign: "center", padding: "clamp(72px,10vw,120px) 24px clamp(64px,8vw,100px)", overflow: "hidden", background: "linear-gradient(180deg, #faf9ff 0%, #fff 100%)" }}>
          {/* Orbs */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-12%", left: "8%", width: 550, height: 550, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,99,255,0.1) 0%, transparent 70%)", animation: "float1 10s ease-in-out infinite", filter: "blur(50px)" }} />
            <div style={{ position: "absolute", top: "5%", right: "2%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)", animation: "float2 10s ease-in-out infinite", filter: "blur(60px)" }} />
          </div>

          <div style={{ position: "relative", maxWidth: 780, margin: "0 auto" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28, padding: "5px 16px 5px 10px", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6c63ff" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6c63ff", letterSpacing: "0.05em", textTransform: "uppercase" }}>AI-Powered Career Platform</span>
            </div>

            <h1 style={{ fontSize: "clamp(40px,6.5vw,72px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.04em", margin: "0 0 24px", opacity: 0, animation: "fadeUp 0.6s ease-out 0.1s forwards" }}>
              Land More Interviews<br />
              <span style={{ background: "linear-gradient(135deg, #6c63ff, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>with AI-Tailored Resumes</span>
            </h1>

            <p style={{ fontSize: "clamp(17px,2vw,20px)", color: "#64748b", lineHeight: 1.65, maxWidth: 560, margin: "0 auto 40px", opacity: 0, animation: "fadeUp 0.6s ease-out 0.25s forwards" }}>
              Upload your resume once. YuktiHire scores it against any job, rewrites it with AI, autofills applications, and tracks everything — so you focus on interviewing, not formatting.
            </p>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", opacity: 0, animation: "fadeUp 0.6s ease-out 0.4s forwards" }}>
              <Link href="/auth/signup" style={{ display: "inline-flex", alignItems: "center", padding: "16px 36px", fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #6c63ff, #8b5cf6)", borderRadius: 14, textDecoration: "none", boxShadow: "0 4px 24px rgba(108,99,255,0.4), 0 1px 0 rgba(255,255,255,0.15) inset", transition: "transform 0.15s, box-shadow 0.15s", letterSpacing: "-0.01em" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(108,99,255,0.5), 0 1px 0 rgba(255,255,255,0.15) inset" }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 24px rgba(108,99,255,0.4), 0 1px 0 rgba(255,255,255,0.15) inset" }}>
                Start Free — No Credit Card
              </Link>
              <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", padding: "15px 32px", fontSize: 15, fontWeight: 600, color: "#475569", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, textDecoration: "none", transition: "border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#a78bfa")} onMouseLeave={e => (e.currentTarget.style.borderColor = "#e2e8f0")}>
                Sign In →
              </Link>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 32, opacity: 0, animation: "fadeUp 0.6s ease-out 0.55s forwards" }}>
              <div style={{ display: "flex" }}>
                {AVATARS.map((a, i) => (
                  <div key={a.i} style={{ width: 30, height: 30, borderRadius: "50%", background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", border: "2.5px solid #fff", marginLeft: i ? -9 : 0 }}>{a.i}</div>
                ))}
              </div>
              <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>Trusted by 12,000+ job seekers</span>
            </div>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────────────────── */}
        <div ref={statsRef} style={{ background: "#faf9ff", borderTop: "1px solid #ede9fe", borderBottom: "1px solid #ede9fe" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24, textAlign: "center" }}>
            {[
              { v: s1, s: "+", l: "Resumes tailored" },
              { v: s2, s: "%", l: "Avg ATS score achieved" },
              { v: s3, s: "x", l: "More interview callbacks" },
              { v: s4, s: "s", l: "Setup time" },
            ].map(d => (
              <div key={d.l}>
                <p style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 800, color: "#6c63ff", letterSpacing: "-0.03em", lineHeight: 1, margin: "0 0 4px" }}>{d.v.toLocaleString()}{d.s}</p>
                <p style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{d.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
        <section id="how-it-works" style={{ padding: "clamp(72px,9vw,110px) 24px", background: "#fff" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6c63ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>How It Works</p>
              <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em" }}>From resume to offer in four steps</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
              {STEPS.map(s => (
                <div key={s.num} style={{ background: "#fff", border: "1.5px solid #f1f5f9", borderRadius: 20, padding: "32px 28px", position: "relative", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s" }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = "#c4b5fd"; el.style.boxShadow = "0 8px 32px rgba(108,99,255,0.1)"; el.style.transform = "translateY(-3px)" }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = "#f1f5f9"; el.style.boxShadow = "none"; el.style.transform = "" }}>
                  <div style={{ position: "absolute", top: 18, right: 22, fontSize: 56, fontWeight: 900, color: "rgba(108,99,255,0.06)", lineHeight: 1 }}>{s.num}</div>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #ede9fe, #ddd6fe)", border: "1px solid #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#6c63ff", marginBottom: 20 }}>{s.num}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.02em" }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────────────────── */}
        <section id="features" style={{ padding: "clamp(72px,9vw,110px) 24px", background: "#faf9ff", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6c63ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Features</p>
              <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em" }}>Everything you need to get hired</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 18 }}>
              {FEATURES.map(f => (
                <div key={f.title} style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", border: "1.5px solid #f1f5f9", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s" }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = "#c4b5fd"; el.style.boxShadow = "0 12px 40px rgba(108,99,255,0.1)"; el.style.transform = "translateY(-3px)" }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = "#f1f5f9"; el.style.boxShadow = "none"; el.style.transform = "" }}>
                  <div style={{ fontSize: 28, marginBottom: 14, width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", display: "flex", alignItems: "center", justifyContent: "center" }}>{f.icon}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em" }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── VALUE PROP ───────────────────────────────────────────────────── */}
        <section style={{ padding: "clamp(72px,9vw,100px) 24px", background: "#fff" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6c63ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Why YuktiHire</p>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,40px)", fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 20 }}>Stop sending the same resume to every job</h2>
            <p style={{ fontSize: 17, color: "#64748b", lineHeight: 1.7, maxWidth: 640, margin: "0 auto 36px" }}>
              Most applicants send one generic resume everywhere and wonder why they never hear back.
              YuktiHire tailors your resume, scores it against each job, generates cover letters, autofills applications, and tracks everything — so every application is your strongest.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 600, margin: "0 auto", textAlign: "left" }}>
              {[
                ["Without YuktiHire", "Same resume everywhere, low response rate, manual tracking, missed keywords, generic applications"],
                ["With YuktiHire", "Tailored resume per job, 85%+ ATS score, auto-tracked pipeline, AI cover letters, smart autofill"],
              ].map(([title, desc], i) => (
                <div key={title} style={{ padding: 24, borderRadius: 16, background: i === 0 ? "#fef2f2" : "#f0fdf4", border: `1px solid ${i === 0 ? "#fecaca" : "#bbf7d0"}` }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? "#dc2626" : "#16a34a", marginBottom: 8 }}>{title}</p>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
        <section id="testimonials" style={{ padding: "clamp(72px,9vw,110px) 24px", background: "#faf9ff", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#6c63ff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Testimonials</p>
              <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.03em" }}>Real people, real results</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 20 }}>
              {TESTIMONIALS.map(t => (
                <div key={t.name} style={{ background: "#fff", border: "1.5px solid #f1f5f9", borderRadius: 20, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: "4px 12px", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 999, fontSize: 12, fontWeight: 700, color: "#6c63ff" }}>ATS {t.score}%</div>
                    <div style={{ display: "flex", gap: 2 }}>{Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ color: "#f59e0b", fontSize: 14 }}>★</span>)}</div>
                  </div>
                  <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.7, flex: 1, margin: 0 }}>"{t.quote}"</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{t.initials}</div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>{t.name}</p>
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
        <section style={{ padding: "clamp(80px,10vw,120px) 24px", textAlign: "center", background: "linear-gradient(135deg, #1e1b4b 0%, #0f0a2a 50%, #1e1b4b 100%)", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 800, height: 500, background: "radial-gradient(ellipse, rgba(108,99,255,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 620, margin: "0 auto" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Get Started</p>
            <h2 style={{ fontSize: "clamp(30px,5vw,52px)", fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 18px", background: "linear-gradient(160deg, #fff 40%, #c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Your next interview starts here
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, marginBottom: 40 }}>
              Upload your resume. Let AI do the tailoring. Land the role you deserve.
            </p>
            <Link href="/auth/signup" style={{ display: "inline-flex", alignItems: "center", padding: "16px 40px", fontSize: 16, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #6c63ff, #8b5cf6)", borderRadius: 14, textDecoration: "none", boxShadow: "0 4px 24px rgba(108,99,255,0.5)", transition: "transform 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")} onMouseLeave={e => (e.currentTarget.style.transform = "")}>
              Start Free — No Credit Card
            </Link>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", marginTop: 16 }}>Free plan · No credit card · Setup in 60 seconds</p>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <footer style={{ background: "#0f0a2a", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #6c63ff, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>Y</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>YuktiHire</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", margin: 0 }}>© {new Date().getFullYear()} YuktiHire. All rights reserved.</p>
            <div style={{ display: "flex", gap: 24 }}>
              {[{ l: "Privacy", h: "/privacy" }, { l: "Terms", h: "/terms" }, { l: "Sign In", h: "/auth/login" }].map(lk => (
                <Link key={lk.l} href={lk.h} style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>{lk.l}</Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
