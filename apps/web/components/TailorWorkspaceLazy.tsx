"use client"

import dynamic from "next/dynamic"

function TailorSkeleton() {
  const pulse: React.CSSProperties = {
    background: "linear-gradient(90deg, #1a1a2e 25%, #22223a 50%, #1a1a2e 75%)",
    backgroundSize: "200% 100%",
    animation: "skeletonPulse 1.4s ease-in-out infinite",
    borderRadius: 12,
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
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          maxWidth: 1200,
          margin: "0 auto",
          alignContent: "start",
        }}
      >
        {/* Toolbar strip */}
        <div
          style={{
            ...pulse,
            height: 48,
            gridColumn: "1 / -1",
            borderRadius: 12,
          }}
        />
        {/* Left panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...pulse, height: 160 }} />
          <div style={{ ...pulse, height: 320 }} />
        </div>
        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...pulse, height: 160 }} />
          <div style={{ ...pulse, height: 320 }} />
        </div>
      </div>
    </>
  )
}

const TailorWorkspaceDynamic = dynamic(
  () => import("@/components/TailorWorkspace").then((m) => ({ default: m.TailorWorkspace })),
  {
    loading: () => <TailorSkeleton />,
    ssr: false,
  }
)

export default function TailorWorkspaceLazy() {
  return <TailorWorkspaceDynamic />
}
