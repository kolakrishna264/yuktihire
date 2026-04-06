"use client"

import { type LucideIcon } from "lucide-react"

interface GradientStatProps {
  icon: LucideIcon
  value: string | number
  label: string
  gradient?: string
  iconColor?: string
  valueColor?: string
  trend?: string
  trendUp?: boolean
}

export function GradientStat({
  icon: Icon,
  value,
  label,
  gradient = "gradient-card-indigo",
  iconColor = "text-indigo-600",
  valueColor = "text-gray-900",
  trend,
  trendUp = true,
}: GradientStatProps) {
  return (
    <div className={`relative rounded-2xl ${gradient} p-5 overflow-hidden group hover:shadow-lg transition-all duration-300`}>
      {/* Subtle glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/40 to-transparent" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className={`text-2xl font-bold ${valueColor} tabular-nums tracking-tight`}>
            {value}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
          {trend && (
            <span className={`inline-flex items-center text-[10px] font-semibold mt-2 ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
              {trendUp ? "\u2191" : "\u2193"} {trend}
            </span>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  )
}
