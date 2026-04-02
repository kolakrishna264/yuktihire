"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Zap, AlertCircle, Loader2, Mail, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      toast.error(error.message)
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a14",
        padding: "24px 16px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <Link
            href="/marketing"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
              }}
            >
              <Zap style={{ width: "20px", height: "20px", color: "#fff" }} strokeWidth={2.5} />
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: "20px",
                letterSpacing: "-0.5px",
                color: "#f0f0ff",
              }}
            >
              YuktiHire
            </span>
          </Link>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#12121f",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.08)",
          }}
        >
          {sent ? (
            /* ---- Success state ---- */
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.1))",
                  border: "1px solid rgba(52,211,153,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <Mail style={{ width: "28px", height: "28px", color: "#34d399" }} />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <CheckCircle2 style={{ width: "18px", height: "18px", color: "#34d399" }} />
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f0f0ff", margin: 0 }}>
                  Check your email
                </h2>
              </div>

              <p
                style={{
                  fontSize: "14px",
                  color: "rgba(240,240,255,0.5)",
                  lineHeight: "1.6",
                  marginBottom: "24px",
                }}
              >
                We sent a confirmation link to{" "}
                <strong style={{ color: "#a78bfa" }}>{email}</strong>.
                <br />
                Click the link to activate your account.
              </p>

              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(108,99,255,0.08)",
                  border: "1px solid rgba(108,99,255,0.2)",
                  borderRadius: "10px",
                  marginBottom: "20px",
                  fontSize: "12px",
                  color: "rgba(240,240,255,0.45)",
                  lineHeight: "1.5",
                }}
              >
                Didn&apos;t receive it? Check your spam folder or wait a minute.
              </div>

              <Link
                href="/auth/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  color: "#a78bfa",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to login
              </Link>
            </div>
          ) : (
            /* ---- Signup form ---- */
            <>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#f0f0ff",
                    margin: "0 0 6px",
                    letterSpacing: "-0.3px",
                  }}
                >
                  Create your account
                </h1>
                <p style={{ color: "rgba(240,240,255,0.5)", fontSize: "14px", margin: 0 }}>
                  Start tailoring resumes with AI — free forever
                </p>
              </div>

              {/* Error */}
              {error && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <AlertCircle
                    style={{ width: "14px", height: "14px", color: "#f87171", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: "13px", color: "#f87171" }}>{error}</span>
                </div>
              )}

              <form
                onSubmit={handleSignup}
                style={{ display: "flex", flexDirection: "column", gap: "14px" }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "rgba(240,240,255,0.6)",
                      marginBottom: "6px",
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                    }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={inputStyle}
                    onFocus={(e) =>
                      ((e.target as HTMLInputElement).style.borderColor = "#6c63ff")
                    }
                    onBlur={(e) =>
                      ((e.target as HTMLInputElement).style.borderColor =
                        "rgba(255,255,255,0.12)")
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "rgba(240,240,255,0.6)",
                      marginBottom: "6px",
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    style={inputStyle}
                    onFocus={(e) =>
                      ((e.target as HTMLInputElement).style.borderColor = "#6c63ff")
                    }
                    onBlur={(e) =>
                      ((e.target as HTMLInputElement).style.borderColor =
                        "rgba(255,255,255,0.12)")
                    }
                  />
                  <p
                    style={{
                      fontSize: "11px",
                      color: "rgba(240,240,255,0.35)",
                      marginTop: "5px",
                    }}
                  >
                    Minimum 8 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: loading
                      ? "rgba(108,99,255,0.4)"
                      : "linear-gradient(135deg, #6c63ff, #a78bfa)",
                    border: "none",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "opacity 0.2s",
                    boxShadow: loading ? "none" : "0 4px 20px rgba(108,99,255,0.35)",
                    marginTop: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading)
                      (e.currentTarget as HTMLButtonElement).style.opacity = "0.92"
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.opacity = "1"
                  }}
                >
                  {loading && (
                    <Loader2
                      style={{
                        width: "16px",
                        height: "16px",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                  )}
                  {loading ? "Creating account..." : "Get started free"}
                </button>
              </form>

              <p
                style={{
                  textAlign: "center",
                  fontSize: "13px",
                  color: "rgba(240,240,255,0.45)",
                  marginTop: "20px",
                  marginBottom: 0,
                }}
              >
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  style={{ color: "#a78bfa", fontWeight: 600, textDecoration: "none" }}
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "12px",
            color: "rgba(240,240,255,0.25)",
          }}
        >
          By signing up you agree to our{" "}
          <Link
            href="/marketing"
            style={{ color: "rgba(240,240,255,0.4)", textDecoration: "none" }}
          >
            Terms
          </Link>{" "}
          &amp;{" "}
          <Link
            href="/marketing"
            style={{ color: "rgba(240,240,255,0.4)", textDecoration: "none" }}
          >
            Privacy Policy
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
