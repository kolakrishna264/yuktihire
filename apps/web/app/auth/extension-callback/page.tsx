"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Zap, CheckCircle2, Loader2 } from "lucide-react"

export default function ExtensionCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    async function handleAuth() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.access_token) {
          setError("No active session. Please sign in first.")
          setStatus("error")
          return
        }

        // Expose token for extension content script to read
        ;(window as any).__YUKTIHIRE_TOKEN__ = session.access_token
        ;(window as any).__YUKTIHIRE_REFRESH__ = session.refresh_token

        // Dispatch custom event for extension listener
        window.dispatchEvent(
          new CustomEvent("yuktihire-auth", {
            detail: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
            },
          })
        )

        setStatus("success")
        setTimeout(() => window.close(), 3000)
      } catch (e: any) {
        setError(e.message || "Authentication failed")
        setStatus("error")
      }
    }
    handleAuth()
  }, [])

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7ff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #6c63ff, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Zap style={{ width: 24, height: 24, color: "#fff" }} />
        </div>

        {status === "loading" && (
          <>
            <Loader2 style={{ width: 24, height: 24, color: "#6c63ff", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Connecting extension...</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Please wait</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 style={{ width: 32, height: 32, color: "#059669", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Extension connected!</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>This tab will close automatically</p>
          </>
        )}

        {status === "error" && (
          <>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#dc2626" }}>Connection failed</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{error}</p>
            <a href="/auth/login" style={{ display: "inline-block", marginTop: 16, padding: "10px 24px", background: "#6c63ff", color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
              Sign in first
            </a>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
