import Link from "next/link"

export default function MarketingPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fff", color: "#111", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#4f46e5" }}>YuktiHire</span>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/auth/login" style={{ padding: "8px 20px", fontSize: 14, fontWeight: 500, color: "#374151", textDecoration: "none", borderRadius: 8, border: "1px solid #e5e7eb" }}>
            Log in
          </Link>
          <Link href="/auth/signup" style={{ padding: "8px 20px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#4f46e5", textDecoration: "none", borderRadius: 8 }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "80px 32px 60px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "inline-block", marginBottom: 16, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: "#4f46e5", background: "#eef2ff", borderRadius: 999, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          AI-Powered Job Search
        </div>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 24, color: "#111827" }}>
          Land your dream job with{" "}
          <span style={{ color: "#4f46e5" }}>AI-tailored resumes</span>
        </h1>
        <p style={{ fontSize: 20, color: "#6b7280", marginBottom: 40, maxWidth: 600, margin: "0 auto 40px" }}>
          YuktiHire analyzes job descriptions and tailors your resume to beat ATS filters — so recruiters actually see your application.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/auth/signup" style={{ padding: "14px 36px", fontSize: 16, fontWeight: 700, color: "#fff", background: "#4f46e5", textDecoration: "none", borderRadius: 12, boxShadow: "0 4px 14px rgba(79,70,229,0.4)" }}>
            Start for free
          </Link>
          <Link href="/auth/login" style={{ padding: "14px 36px", fontSize: 16, fontWeight: 600, color: "#374151", background: "#f3f4f6", textDecoration: "none", borderRadius: 12 }}>
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: "#f9fafb", padding: "80px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: "center", marginBottom: 48, color: "#111827" }}>
            Everything you need to get hired
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {features.map((f) => (
              <div key={f.title} style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#111827" }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 32px", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16, color: "#111827" }}>Ready to get hired faster?</h2>
        <p style={{ fontSize: 18, color: "#6b7280", marginBottom: 32 }}>
          Join thousands of job seekers using YuktiHire to land interviews.
        </p>
        <Link href="/auth/signup" style={{ display: "inline-block", padding: "16px 48px", fontSize: 18, fontWeight: 700, color: "#fff", background: "#4f46e5", textDecoration: "none", borderRadius: 14, boxShadow: "0 4px 14px rgba(79,70,229,0.4)" }}>
          Create your free account
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #f3f4f6", padding: "32px", textAlign: "center", fontSize: 14, color: "#9ca3af" }}>
        © {new Date().getFullYear()} YuktiHire. All rights reserved.
      </footer>
    </main>
  )
}

const features = [
  { icon: "🎯", title: "AI Resume Tailoring", description: "Paste a job description and get a tailored resume in seconds. Our AI matches your experience to what recruiters want." },
  { icon: "📊", title: "ATS Score Checker", description: "See exactly how your resume scores against Applicant Tracking Systems before you apply." },
  { icon: "💼", title: "Job Application Tracker", description: "Track every application, interview, and offer in one place. Never lose track of your job search." },
  { icon: "📄", title: "Multiple Resumes", description: "Create and manage different resume versions for different roles or industries." },
  { icon: "✨", title: "Smart Recommendations", description: "Get AI-powered suggestions to improve your bullet points, skills, and keywords." },
  { icon: "⚡", title: "PDF Export", description: "Download polished, recruiter-ready PDF resumes with professional formatting." },
]
