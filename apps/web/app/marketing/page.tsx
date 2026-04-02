import Link from "next/link"

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-xl font-bold text-indigo-600">YuktiHire</span>
        <div className="flex gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-24 max-w-4xl mx-auto">
        <div className="inline-block mb-4 px-3 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-full uppercase tracking-wide">
          AI-Powered Job Search
        </div>
        <h1 className="text-5xl font-extrabold leading-tight mb-6 text-gray-900">
          Land your dream job with{" "}
          <span className="text-indigo-600">AI-tailored resumes</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          YuktiHire analyzes job descriptions and tailors your resume to beat ATS
          filters — so recruiters actually see your application.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-8 py-3 text-base font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
          >
            Start for free
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3 text-base font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need to get hired
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🎯"
              title="AI Resume Tailoring"
              description="Paste a job description and get a tailored resume in seconds. Our AI matches your experience to what recruiters want."
            />
            <FeatureCard
              icon="📊"
              title="ATS Score Checker"
              description="See exactly how your resume scores against Applicant Tracking Systems before you apply."
            />
            <FeatureCard
              icon="💼"
              title="Job Application Tracker"
              description="Track every application, interview, and offer in one place. Never lose track of your job search."
            />
            <FeatureCard
              icon="📄"
              title="Multiple Resumes"
              description="Create and manage different resume versions for different roles or industries."
            />
            <FeatureCard
              icon="✨"
              title="Smart Recommendations"
              description="Get AI-powered suggestions to improve your bullet points, skills, and keywords."
            />
            <FeatureCard
              icon="⚡"
              title="PDF Export"
              description="Download polished, recruiter-ready PDF resumes with professional formatting."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get hired faster?</h2>
        <p className="text-gray-500 mb-8 text-lg">
          Join thousands of job seekers using YuktiHire to land interviews.
        </p>
        <Link
          href="/auth/signup"
          className="inline-block px-10 py-4 text-lg font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
        >
          Create your free account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} YuktiHire. All rights reserved.
      </footer>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  )
}
