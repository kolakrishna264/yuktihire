"use client"

import { BarChart3 } from "lucide-react"

export default function InsightsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="text-sm text-gray-500 mt-1">Analytics and trends from your job search</p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
          <BarChart3 className="w-8 h-8 text-indigo-400" />
        </div>
        <p className="text-lg font-semibold text-gray-700 mb-1">Coming Soon</p>
        <p className="text-sm text-gray-400 max-w-sm">
          Track response rates, pipeline velocity, trending skills, and application insights — all in one dashboard.
        </p>
      </div>
    </div>
  )
}
