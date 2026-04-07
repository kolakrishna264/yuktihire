"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Zap, AlertCircle, Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "#f0f0ff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a14", padding: "24px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <Link href="/marketing" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
            }}>
              <Zap style={{ width: "20px", height: "20px", color: "#fff" }} strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: "20px", letterSpacing: "-0.5px", color: "#f0f0ff" }}>
              YuktiHire
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: "#12121f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px",
          padding: "36px 32px", boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.08)",
        }}>
          {sent ? (
            /* Success state */
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "16px",
                background: "rgba(34,197,94,0.1)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              }}>
                <CheckCircle style={{ width: "28px", height: "28px", color: "#22c55e" }} />
              </div>
              <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f0f0ff", margin: "0 0 8px" }}>
                Check your email
              </h1>
              <p style={{ color: "rgba(240,240,255,0.5)", fontSize: "14px", margin: "0 0 8px", lineHeight: 1.5 }}>
                We sent a password reset link to
              </p>
              <p style={{ color: "#a78bfa", fontSize: "14px", fontWeight: 600, margin: "0 0 24px" }}>
                {email}
              </p>
              <p style={{ color: "rgba(240,240,255,0.4)", fontSize: "13px", margin: "0 0 24px", lineHeight: 1.5 }}>
                Click the link in the email to reset your password. Check your spam folder if you don&apos;t see it.
              </p>
              <Link href="/auth/login" style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                color: "#a78bfa", fontSize: "14px", fontWeight: 600, textDecoration: "none",
              }}>
                <ArrowLeft style={{ width: "14px", height: "14px" }} />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "14px",
                  background: "rgba(108,99,255,0.1)", display: "flex",
                  alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
                }}>
                  <Mail style={{ width: "24px", height: "24px", color: "#a78bfa" }} />
                </div>
                <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#f0f0ff", margin: "0 0 6px" }}>
                  Reset your password
                </h1>
                <p style={{ color: "rgba(240,240,255,0.5)", fontSize: "14px", margin: 0 }}>
                  Enter your email and we&apos;ll send you a reset link
                </p>
              </div>

              {error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 14px", background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", marginBottom: "16px",
                }}>
                  <AlertCircle style={{ width: "14px", height: "14px", color: "#f87171", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: "#f87171" }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{
                    display: "block", fontSize: "12px", fontWeight: 600,
                    color: "rgba(240,240,255,0.6)", marginBottom: "6px",
                    letterSpacing: "0.02em", textTransform: "uppercase",
                  }}>
                    Email
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = "#6c63ff")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                </div>

                <button type="submit" disabled={loading} style={{
                  width: "100%", padding: "12px 16px",
                  background: loading ? "rgba(108,99,255,0.4)" : "linear-gradient(135deg, #6c63ff, #a78bfa)",
                  border: "none", borderRadius: "10px", color: "#fff", fontSize: "15px", fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(108,99,255,0.35)", marginTop: "4px",
                }}>
                  {loading && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />}
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <p style={{ textAlign: "center", fontSize: "13px", color: "rgba(240,240,255,0.45)", marginTop: "20px", marginBottom: 0 }}>
                Remember your password?{" "}
                <Link href="/auth/login" style={{ color: "#a78bfa", fontWeight: 600, textDecoration: "none" }}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
