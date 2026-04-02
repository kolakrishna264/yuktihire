"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Zap, AlertTriangle, RefreshCw } from "lucide-react"
import { Suspense } from "react"

function ErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get("message") ?? "Something went wrong with verification"

  const isExpired =
    message.toLowerCase().includes("expired") ||
    message.toLowerCase().includes("invalid") ||
    message.toLowerCase().includes("already used")

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f7ff",
        padding: "24px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(108,99,255,0.3)",
              }}
            >
              <Zap style={{ width: 20, height: 20, color: "#fff" }} strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px", color: "#1a1a2e" }}>
              YuktiHire
            </span>
          </Link>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#fff",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 20,
            padding: "40px 32px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <AlertTriangle style={{ width: 28, height: 28, color: "#ef4444" }} />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", margin: "0 0 8px" }}>
            {isExpired ? "Link Expired" : "Verification Failed"}
          </h2>

          <p
            style={{
              fontSize: 14,
              color: "#64748b",
              lineHeight: 1.6,
              marginBottom: 8,
            }}
          >
            {isExpired
              ? "This verification link has expired or already been used."
              : "We couldn't verify your email."}
          </p>

          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 10,
              marginBottom: 28,
            }}
          >
            <p style={{ fontSize: 12, color: "#dc2626", margin: 0, fontFamily: "monospace" }}>
              {message}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link
              href="/auth/signup"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                color: "#fff",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(108,99,255,0.3)",
              }}
            >
              <RefreshCw style={{ width: 15, height: 15 }} />
              {isExpired ? "Sign up again" : "Try again"}
            </Link>

            <Link
              href="/auth/login"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                background: "transparent",
                color: "#6c63ff",
                border: "1px solid rgba(108,99,255,0.3)",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to Login
            </Link>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#94a3b8" }}>
          Need help?{" "}
          <a
            href="mailto:support@yuktihire.com"
            style={{ color: "#6c63ff", textDecoration: "none" }}
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  )
}
