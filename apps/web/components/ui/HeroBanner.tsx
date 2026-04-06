"use client"

import { type ReactNode } from "react"

interface HeroBannerProps {
  eyebrow?: string
  title: ReactNode
  subtitle: string
  actions?: ReactNode
  className?: string
}

export function HeroBanner({ eyebrow, title, subtitle, actions, className = "" }: HeroBannerProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden gradient-hero p-8 lg:p-10 text-white ${className}`}>
      {/* Mesh overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      <div className="relative">
        {eyebrow && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white/15 text-white/90 mb-4 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {eyebrow}
          </span>
        )}
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mb-2">{title}</h2>
        <p className="text-sm text-white/60 max-w-lg leading-relaxed">{subtitle}</p>
        {actions && <div className="mt-5 flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}
