"use client"

import { type LucideIcon } from "lucide-react"
import { type ReactNode } from "react"

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  gradient?: string
  iconColor?: string
  visual?: ReactNode
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient = "gradient-card-indigo",
  iconColor = "text-indigo-600",
  visual,
}: FeatureCardProps) {
  return (
    <div className="group relative rounded-2xl border border-white/60 bg-white p-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1 overflow-hidden">
      {/* Gradient background on hover */}
      <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>

        {/* Text */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>

        {/* Visual illustration */}
        {visual && (
          <div className="mt-4 opacity-80 group-hover:opacity-100 transition-opacity duration-300">
            {visual}
          </div>
        )}
      </div>
    </div>
  )
}
