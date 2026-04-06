"use client"

import { type LucideIcon } from "lucide-react"
import { type ReactNode } from "react"

interface PosterCardProps {
  icon: LucideIcon
  title: string
  subtitle: string
  badge?: string
  gradient?: string
  iconBg?: string
  iconColor?: string
  children?: ReactNode
}

export function PosterCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  gradient = "from-indigo-500 via-purple-500 to-blue-500",
  iconBg = "bg-white/20",
  iconColor = "text-white",
  children,
}: PosterCardProps) {
  return (
    <div className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white overflow-hidden group transition-all duration-300 hover:shadow-2xl hover:-translate-y-1`}>
      {/* Decorative circles */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
      <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full bg-white/5 group-hover:scale-150 transition-transform duration-500" />

      <div className="relative">
        {/* Badge */}
        {badge && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white mb-3 backdrop-blur-sm">
            {badge}
          </span>
        )}

        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl ${iconBg} backdrop-blur-sm flex items-center justify-center mb-4`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>

        {/* Text */}
        <h3 className="text-lg font-bold mb-1 tracking-tight">{title}</h3>
        <p className="text-sm text-white/70 leading-relaxed">{subtitle}</p>

        {/* Custom content */}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  )
}
