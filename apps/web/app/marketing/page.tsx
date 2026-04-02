"use client"

import { useState } from "react"
import Link from "next/link"

// --- Magnetic Button ---
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
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distX = e.clientX - centerX
    const distY = e.clientY - centerY
    const dist = Math.sqrt(distX * distX + distY * distY)
    if (dist < 80) {
      setPos({ x: distX * 0.2, y: distY * 0.2 })
    }
  }

  const handleMouseLeave = () => setPos({ x: 0, y: 0 })

  return (
    <Link
      href={href}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: primary ? "15px 36px" : "14px 34px",
        fontSize: 15,
        fontWeight: 600,
        textDecoration: "none",
        borderRadius: 12,
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        letterSpacing: "0.01em",
        cursor: "pointer",
        ...(primary
          ? {
              background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
              color: "#fff",
              boxShadow: `0 0 0 1px rgba(108,99,255,0.3), 0 4px 24px rgba(108,99,255,0.4), 0 1px 0 rgba(255,255,255,0.15) inset`,
            }
          : {
              background: "rgba(255,255,255,0.05)",
              color: "rgba(240,240,255,0.85)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
            }),
      }}
    >
      {children}
    </Link>
  )
}

// --- Step Card ---
function StepCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div
      style={{
        background: "#12121f",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        padding: "32px 28px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          fontSize: 64,
          fontWeight: 900,
          color: "rgba(108,99,255,0.08)",
          lineHeight: 1,
          userSelect: "none",
          fontFamily: "inherit",
        }}
      >
        {number}
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "linear-gradient(135deg, #6c63ff22, #a78bfa22)",
          border: "1px solid rgba(108,99,255,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 800,
          color: "#a78bfa",
          marginBottom: 20,
        }}
      >
        {number}
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#f0f0ff",
          marginBottom: 10,
          margin: "0 0 10px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: "rgba(240,240,255,0.55)",
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  )
}

// --- Feature Card ---
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div
      style={{
        background: "#12121f",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        padding: "28px 24px",
        transition: "border-color 0.2s ease, transform 0.2s ease",
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(108,99,255,0.35)"
        ;(e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(255,255,255,0.07)"
        ;(e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#f0f0ff",
          marginBottom: 8,
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: "rgba(240,240,255,0.55)",
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  )
}

// --- Testimonial Card ---
function TestimonialCard({
  initials,
  name,
  role,
  quote,
  color,
}: {
  initials: string
  name: string
  role: string
  quote: string
  color: string
}) {
  return (
    <div
      style={{
        background: "#12121f",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        {[...Array(5)].map((_, i) => (
          <span key={i} style={{ color: "#f59e0b", fontSize: 14 }}>
            ★
          </span>
        ))}
      </div>
      <p
        style={{
          fontSize: 15,
          color: "rgba(240,240,255,0.75)",
          lineHeight: 1.7,
          margin: 0,
          fontStyle: "italic",
        }}
      >
        &ldquo;{quote}&rdquo;
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f0f0ff" }}>
            {name}
          </div>
          <div style={{ fontSize: 13, color: "rgba(240,240,255,0.45)" }}>
            {role}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Data ---
const steps = [
  {
    number: "1",
    title: "Upload Your Resume",
    description:
      "Drop in your existing resume — PDF, Word, or plain text. Our AI extracts your full profile: skills, experience, education, and achievements.",
  },
  {
    number: "2",
    title: "Match With Jobs",
    description:
      "Browse curated job listings matched to your skills and experience. See fit scores before you spend a minute on applications.",
  },
  {
    number: "3",
    title: "Tailor & Score",
    description:
      "Paste any job description and YuktiHire rewrites your resume to align perfectly. See your ATS score go up in real time.",
  },
  {
    number: "4",
    title: "Track & Apply",
    description:
      "Apply in one click with your tailored resume. Track every application, follow-up, and interview stage from a single dashboard.",
  },
]

const features = [
  {
    icon: "✦",
    title: "AI Resume Tailoring",
    description:
      "Paste a job description and get a precision-tailored resume in seconds. Matches your experience to what recruiters actually want.",
  },
  {
    icon: "◎",
    title: "ATS Score Checker",
    description:
      "See your exact ATS compatibility score before you hit send. Know which keywords to add and which to cut.",
  },
  {
    icon: "⬡",
    title: "Smart Job Matching",
    description:
      "AI surfaces roles where your background fits best — not just keyword matches, but genuine skill alignment.",
  },
  {
    icon: "◈",
    title: "Application Tracker",
    description:
      "One dashboard for every application. Track status, set reminders, and never let a hot lead go cold.",
  },
  {
    icon: "◇",
    title: "Keyword Optimizer",
    description:
      "Identify missing high-value keywords from any job post and weave them naturally into your resume copy.",
  },
  {
    icon: "▣",
    title: "One-Click Export",
    description:
      "Download polished, recruiter-ready PDF resumes with clean formatting that holds up in any inbox.",
  },
]

const testimonials = [
  {
    initials: "PK",
    name: "Priya Krishnamurthy",
    role: "Product Manager · Hired at Razorpay",
    quote:
      "I applied to 12 jobs in the first week and got 5 callbacks. Before YuktiHire I was getting ghosted constantly. The ATS score feature alone is worth it.",
    color: "linear-gradient(135deg, #6c63ff, #a78bfa)",
  },
  {
    initials: "AM",
    name: "Alex Martinez",
    role: "Senior SWE · Hired at Stripe",
    quote:
      "The resume tailoring is scarily good. It took my generic resume and turned it into something that read like I wrote it specifically for each role. Two offers in three weeks.",
    color: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
  },
  {
    initials: "SR",
    name: "Shruti Rao",
    role: "Data Analyst · Hired at Swiggy",
    quote:
      "Switching industries felt impossible until I used YuktiHire. It helped me frame my consulting experience for a data role — I got the job at a company I thought was out of reach.",
    color: "linear-gradient(135deg, #f59e0b, #fbbf24)",
  },
]

const stats = [
  { value: "50,000+", label: "Resumes Analyzed" },
  { value: "87%", label: "Avg ATS Score Improvement" },
  { value: "3×", label: "Faster Job Applications" },
  { value: "200+", label: "Companies Hiring" },
]

// --- Main Page ---
export default function MarketingPage() {
  return (
    <>
      {/* Keyframe animations */}
      <style>{`
        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.08); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 30px) scale(1.05); }
          66% { transform: translate(30px, -40px) scale(1.1); }
        }
        @keyframes orbFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -50px) scale(1.06); }
        }
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(108,99,255,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(108,99,255,0); }
        }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
      `}</style>

      <main
        style={{
          minHeight: "100vh",
          background: "#0a0a14",
          color: "#f0f0ff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif",
          overflowX: "hidden",
        }}
      >
        {/* ── NAVBAR ── */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: "rgba(10,10,20,0.8)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 32px",
              maxWidth: 1200,
              margin: "0 auto",
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 900,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                Y
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#f0f0ff",
                  letterSpacing: "-0.02em",
                }}
              >
                YuktiHire
              </span>
            </div>

            {/* Nav links */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link
                href="/auth/login"
                style={{
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "rgba(240,240,255,0.65)",
                  textDecoration: "none",
                  borderRadius: 9,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color = "#f0f0ff")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(240,240,255,0.65)")
                }
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                style={{
                  padding: "8px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                  textDecoration: "none",
                  borderRadius: 9,
                  boxShadow: "0 2px 12px rgba(108,99,255,0.35)",
                }}
              >
                Get started free
              </Link>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section
          style={{
            position: "relative",
            textAlign: "center",
            padding: "clamp(80px, 12vw, 140px) 24px clamp(80px, 10vw, 120px)",
            overflow: "hidden",
          }}
        >
          {/* Gradient orbs */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-10%",
                left: "10%",
                width: 600,
                height: 600,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(108,99,255,0.18) 0%, transparent 70%)",
                animation: "orbFloat1 12s ease-in-out infinite",
                filter: "blur(40px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "5%",
                right: "5%",
                width: 500,
                height: 500,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(167,139,250,0.14) 0%, transparent 70%)",
                animation: "orbFloat2 16s ease-in-out infinite",
                filter: "blur(50px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "0%",
                left: "40%",
                width: 400,
                height: 400,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
                animation: "orbFloat3 10s ease-in-out infinite",
                filter: "blur(60px)",
              }}
            />
          </div>

          <div
            style={{ position: "relative", maxWidth: 820, margin: "0 auto" }}
          >
            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 32,
                padding: "6px 16px 6px 10px",
                background: "rgba(108,99,255,0.1)",
                border: "1px solid rgba(108,99,255,0.3)",
                borderRadius: 999,
                animation: "badgePulse 3s ease-in-out infinite",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#6c63ff",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#a78bfa",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                AI-Powered Career Platform
              </span>
            </div>

            {/* H1 */}
            <h1
              style={{
                fontSize: "clamp(48px, 8vw, 88px)",
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                marginBottom: 28,
                margin: "0 0 28px",
                background: "linear-gradient(160deg, #ffffff 30%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Upload Once.
              <br />
              Apply Smarter.
            </h1>

            {/* Sub */}
            <p
              style={{
                fontSize: "clamp(17px, 2.5vw, 20px)",
                color: "rgba(240,240,255,0.6)",
                lineHeight: 1.7,
                maxWidth: 620,
                margin: "0 auto 48px",
              }}
            >
              YuktiHire extracts your full profile from your resume, matches you
              with real jobs, tailors your resume to beat ATS, and tracks every
              application — all in one place.
            </p>

            {/* CTAs */}
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <MagneticButton href="/auth/signup" primary>
                Start for Free →
              </MagneticButton>
              <MagneticButton href="/auth/login">Sign In</MagneticButton>
            </div>

            {/* Social proof micro-text */}
            <p
              style={{
                fontSize: 13,
                color: "rgba(240,240,255,0.3)",
                marginTop: 24,
              }}
            >
              No credit card required · Free plan available · Setup in 60 seconds
            </p>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.025)",
            padding: "40px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 32,
              textAlign: "center",
            }}
          >
            {stats.map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontSize: "clamp(28px, 4vw, 40px)",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    marginBottom: 6,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(240,240,255,0.45)",
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={{ padding: "clamp(80px, 10vw, 120px) 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6c63ff",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                How it works
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 44px)",
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                  color: "#f0f0ff",
                  margin: "0 auto",
                  maxWidth: 540,
                }}
              >
                From resume to offer in four steps
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 20,
              }}
            >
              {steps.map((s) => (
                <StepCard key={s.number} {...s} />
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES GRID ── */}
        <section
          style={{
            padding: "clamp(80px, 10vw, 120px) 24px",
            background: "rgba(255,255,255,0.015)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6c63ff",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Features
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 44px)",
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                  color: "#f0f0ff",
                  margin: 0,
                }}
              >
                Everything you need to get hired
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {features.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section style={{ padding: "clamp(80px, 10vw, 120px) 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#6c63ff",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Testimonials
              </p>
              <h2
                style={{
                  fontSize: "clamp(28px, 4vw, 44px)",
                  fontWeight: 800,
                  letterSpacing: "-0.025em",
                  color: "#f0f0ff",
                  margin: 0,
                }}
              >
                Real people, real results
              </h2>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {testimonials.map((t) => (
                <TestimonialCard key={t.name} {...t} />
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section
          style={{
            padding: "clamp(80px, 10vw, 120px) 24px",
            textAlign: "center",
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(108,99,255,0.12) 0%, transparent 70%)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2
              style={{
                fontSize: "clamp(30px, 5vw, 52px)",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                marginBottom: 20,
                background: "linear-gradient(160deg, #ffffff 40%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                margin: "0 0 20px",
              }}
            >
              Start Your Job Search Today
            </h2>
            <p
              style={{
                fontSize: 18,
                color: "rgba(240,240,255,0.55)",
                lineHeight: 1.65,
                marginBottom: 40,
              }}
            >
              Join 50,000+ job seekers who use YuktiHire to get more interviews,
              faster. Your next role is closer than you think.
            </p>
            <MagneticButton href="/auth/signup" primary>
              Create Your Free Account →
            </MagneticButton>
            <p
              style={{
                fontSize: 13,
                color: "rgba(240,240,255,0.28)",
                marginTop: 20,
              }}
            >
              Free forever · No credit card required
            </p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "40px 24px",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#fff",
                }}
              >
                Y
              </div>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "rgba(240,240,255,0.7)",
                }}
              >
                YuktiHire
              </span>
            </div>

            {/* Copyright */}
            <p
              style={{
                fontSize: 13,
                color: "rgba(240,240,255,0.3)",
                margin: 0,
              }}
            >
              © {new Date().getFullYear()} YuktiHire. All rights reserved.
            </p>

            {/* Links */}
            <div style={{ display: "flex", gap: 24 }}>
              {[
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
                { label: "Sign In", href: "/auth/login" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  style={{
                    fontSize: 13,
                    color: "rgba(240,240,255,0.35)",
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.color =
                      "rgba(240,240,255,0.75)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.color =
                      "rgba(240,240,255,0.35)")
                  }
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
