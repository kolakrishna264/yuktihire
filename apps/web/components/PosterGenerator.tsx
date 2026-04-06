"use client"

import { type LucideIcon } from "lucide-react"
import { type ReactNode } from "react"

type ThemePreset = "indigo" | "violet" | "emerald" | "cyan" | "amber" | "rose"

const THEMES: Record<ThemePreset, { gradient: string; glow: string }> = {
  indigo: {
    gradient: "from-indigo-500 via-blue-600 to-indigo-700",
    glow: "shadow-indigo-500/25",
  },
  violet: {
    gradient: "from-violet-500 via-purple-600 to-fuchsia-600",
    glow: "shadow-purple-500/25",
  },
  emerald: {
    gradient: "from-emerald-500 via-teal-600 to-cyan-600",
    glow: "shadow-emerald-500/25",
  },
  cyan: {
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
    glow: "shadow-cyan-500/25",
  },
  amber: {
    gradient: "from-amber-500 via-orange-500 to-red-500",
    glow: "shadow-amber-500/25",
  },
  rose: {
    gradient: "from-rose-500 via-pink-500 to-fuchsia-500",
    glow: "shadow-rose-500/25",
  },
}

interface PosterGeneratorProps {
  title: string
  subtitle: string
  icon: LucideIcon
  theme?: ThemePreset
  badge?: string
  children?: ReactNode
  compact?: boolean
}

export function PosterGenerator({
  title,
  subtitle,
  icon: Icon,
  theme = "indigo",
  badge,
  children,
  compact = false,
}: PosterGeneratorProps) {
  const t = THEMES[theme]

  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br ${t.gradient} text-white overflow-hidden group transition-all duration-300 hover:shadow-2xl ${t.glow} hover:-translate-y-1 ${compact ? "p-5" : "p-7"}`}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/[0.07]" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/[0.05]" />
        <div className="absolute top-1/3 right-1/3 w-20 h-20 rounded-full bg-white/[0.04] group-hover:scale-[2] transition-transform duration-700" />
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
      </div>

      <div className="relative">
        {/* Badge */}
        {badge && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 backdrop-blur-sm mb-3">
            <span className="w-1 h-1 rounded-full bg-white/80" />
            {badge}
          </span>
        )}

        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
          <Icon className="w-6 h-6" />
        </div>

        {/* Text */}
        <h3 className={`font-bold tracking-tight mb-1.5 ${compact ? "text-lg" : "text-xl"}`}>{title}</h3>
        <p className={`text-white/60 leading-relaxed ${compact ? "text-xs" : "text-sm"}`}>{subtitle}</p>

        {/* Custom visual content */}
        {children && (
          <div className="mt-5 rounded-xl bg-white/10 backdrop-blur-sm p-3 border border-white/10">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
