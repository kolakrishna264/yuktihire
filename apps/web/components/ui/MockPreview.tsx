"use client"

/**
 * CSS-only mock UI previews for marketing visuals.
 * No external images needed — pure Tailwind.
 */

export function DashboardMock() {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white shadow-2xl shadow-indigo-200/30 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 h-3 w-28 rounded bg-gray-200" />
      </div>
      {/* Content */}
      <div className="p-3 space-y-2.5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "ATS Score", value: "92%", color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Applied", value: "14", color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Tailored", value: "8", color: "text-violet-600", bg: "bg-violet-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-lg p-2`}>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
        {/* List items */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
            <div className="w-6 h-6 rounded bg-indigo-100 shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-2 w-3/4 rounded bg-gray-200" />
              <div className="h-1.5 w-1/2 rounded bg-gray-100" />
            </div>
            <div className="h-4 w-12 rounded-full bg-emerald-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ExtensionPopupMock() {
  return (
    <div className="w-52 rounded-xl border border-gray-200/60 bg-white shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-white/20 flex items-center justify-center text-[8px] font-bold text-white">Y</div>
          <span className="text-[10px] font-bold text-white">YuktiHire</span>
        </div>
      </div>
      {/* Content */}
      <div className="p-2.5 space-y-2">
        <div className="rounded-lg bg-emerald-50 p-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">{"\u2713"}</span>
          </div>
          <div>
            <p className="text-[9px] font-bold text-emerald-700">Job Detected</p>
            <p className="text-[8px] text-emerald-600">Software Engineer</p>
          </div>
        </div>
        <button className="w-full py-1.5 rounded-lg bg-indigo-600 text-[9px] font-bold text-white">
          Save & Tailor
        </button>
        <button className="w-full py-1.5 rounded-lg bg-gray-100 text-[9px] font-semibold text-gray-600">
          Autofill Application
        </button>
      </div>
    </div>
  )
}

export function AtsScoreMock({ score = 92 }: { score?: number }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e0e7ff" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke="url(#atsGradient)" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          className="transition-all duration-1000"
        />
        <defs>
          <linearGradient id="atsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6c63ff" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <text x="50" y="46" textAnchor="middle" className="fill-gray-900 text-xl font-bold" style={{ fontSize: 22, fontWeight: 800 }}>
          {score}%
        </text>
        <text x="50" y="62" textAnchor="middle" className="fill-gray-400" style={{ fontSize: 8 }}>
          ATS Score
        </text>
      </svg>
    </div>
  )
}

export function AutofillProgressMock() {
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white shadow-lg p-3 w-56">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center">
          <span className="text-[8px] font-bold text-indigo-600">{"\u26A1"}</span>
        </div>
        <span className="text-[10px] font-bold text-gray-800">Autofilling...</span>
        <span className="ml-auto text-[9px] font-semibold text-indigo-600">78%</span>
      </div>
      <div className="space-y-1.5">
        {[
          { label: "Full Name", done: true },
          { label: "Email", done: true },
          { label: "Phone", done: true },
          { label: "LinkedIn URL", done: true },
          { label: "Work Auth", done: false },
          { label: "Cover Letter", done: false },
        ].map((f) => (
          <div key={f.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full flex items-center justify-center ${f.done ? "bg-emerald-500" : "bg-gray-200"}`}>
              {f.done && <span className="text-[6px] text-white font-bold">{"\u2713"}</span>}
            </div>
            <span className={`text-[9px] ${f.done ? "text-gray-500 line-through" : "text-gray-700 font-medium"}`}>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ResumeBeforeAfterMock() {
  return (
    <div className="flex gap-3 items-stretch">
      {/* Before */}
      <div className="flex-1 rounded-lg border border-red-200 bg-red-50/50 p-2.5">
        <div className="flex items-center gap-1 mb-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-[8px] font-bold text-red-600">Before</span>
          <span className="ml-auto text-[8px] font-bold text-red-500">52%</span>
        </div>
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded bg-red-200" />
          <div className="h-1.5 w-4/5 rounded bg-red-200" />
          <div className="h-1.5 w-3/5 rounded bg-red-200" />
          <div className="h-1.5 w-full rounded bg-red-100" />
          <div className="h-1.5 w-2/3 rounded bg-red-100" />
        </div>
      </div>
      {/* Arrow */}
      <div className="flex items-center text-indigo-400 font-bold text-sm">{"\u2192"}</div>
      {/* After */}
      <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
        <div className="flex items-center gap-1 mb-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-[8px] font-bold text-emerald-600">After</span>
          <span className="ml-auto text-[8px] font-bold text-emerald-500">92%</span>
        </div>
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded bg-emerald-300" />
          <div className="h-1.5 w-4/5 rounded bg-emerald-300" />
          <div className="h-1.5 w-full rounded bg-emerald-200" />
          <div className="h-1.5 w-3/4 rounded bg-emerald-200" />
          <div className="h-1.5 w-full rounded bg-emerald-300" />
        </div>
      </div>
    </div>
  )
}
