"use client"

import dynamic from "next/dynamic"
import type { User } from "@supabase/supabase-js"

// --- Skeleton ---
function DashboardSkeleton() {
  const pulse: React.CSSProperties = {
    background: "linear-gradient(90deg, #1a1a2e 25%, #22223a 50%, #1a1a2e 75%)",
    backgroundSize: "200% 100%",
    animation: "skeletonPulse 1.4s ease-in-out infinite",
    borderRadius: 10,
  }

  return (
    <>
      <style>{`
        @keyframes skeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a14",
          padding: "32px 24px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
        }}
      >
        {/* Stat cards row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 32,
            maxWidth: 1100,
            margin: "0 auto 32px",
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{ ...pulse, height: 96, borderRadius: 16 }}
            />
          ))}
        </div>

        {/* Content area */}
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}
        >
          <div style={{ ...pulse, height: 300, borderRadius: 16 }} />
          <div style={{ ...pulse, height: 300, borderRadius: 16 }} />
          <div style={{ ...pulse, height: 200, borderRadius: 16, gridColumn: "1 / -1" }} />
        </div>
      </div>
    </>
  )
}

const DashboardShell = dynamic(() => import("@/components/DashboardShell"), {
  loading: () => <DashboardSkeleton />,
  ssr: false,
})

export default function DashboardShellLazy({ user }: { user: User | null }) {
  return <DashboardShell user={user} />
}
