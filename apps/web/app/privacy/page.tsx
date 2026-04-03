export const metadata = { title: "Privacy Policy — YuktiHire" }

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", color: "#1a1a2e" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#6b7280", marginBottom: 32, fontSize: 14 }}>Last updated: April 3, 2026</p>

      <div style={{ lineHeight: 1.8, fontSize: 15 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Overview</h2>
        <p>
          YuktiHire ("we", "our", "us") is an AI-powered job assistant that helps users save job listings,
          tailor resumes, and track job applications. This privacy policy explains how we collect, use, and
          protect your information.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Information We Collect</h2>
        <p><strong>Account Information:</strong> When you sign up, we collect your email address and password (managed securely by Supabase Authentication).</p>
        <p><strong>Resume Data:</strong> Resumes you upload are stored securely and used only for AI-powered tailoring to job descriptions you provide.</p>
        <p><strong>Job Data:</strong> When you save a job using our browser extension or manual entry, we store the job title, company, location, job description, and apply link.</p>
        <p><strong>Authentication Tokens:</strong> Our browser extension stores an authentication token locally in your browser to keep you signed in.</p>
        <p><strong>Website Content:</strong> When you use our browser extension on a job listing page, the extension reads the page content (job title, company, description) to extract job details. This data is only captured when you actively click the extension.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>How We Use Your Information</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>To provide AI-powered resume tailoring and ATS scoring</li>
          <li>To save and organize your job applications</li>
          <li>To authenticate you across the web app and browser extension</li>
          <li>To improve our services</li>
        </ul>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>What We Do NOT Do</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>We do NOT sell or transfer your data to third parties</li>
          <li>We do NOT use your data for advertising or creditworthiness</li>
          <li>We do NOT track your browsing history — the extension only activates when you click it</li>
          <li>We do NOT store any data from pages you visit unless you explicitly save a job</li>
        </ul>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Browser Extension</h2>
        <p>
          The YuktiHire browser extension requires the following permissions:
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>activeTab:</strong> To read the current page content when you click the extension icon</li>
          <li><strong>storage:</strong> To store your authentication token locally</li>
          <li><strong>tabs:</strong> To check the current page URL for duplicate detection</li>
          <li><strong>Host permissions:</strong> To communicate with the YuktiHire API for saving jobs and authentication</li>
        </ul>
        <p>The extension does NOT run in the background. It only activates when you click the extension icon.</p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Data Storage and Security</h2>
        <p>
          Your data is stored securely using Supabase (PostgreSQL database with row-level security).
          Authentication is handled by Supabase Auth with encrypted passwords.
          All API communication uses HTTPS.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Data Deletion</h2>
        <p>
          You can delete your account and all associated data at any time by contacting us.
          When you delete a job or resume from the dashboard, it is permanently removed from our database.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 }}>Contact</h2>
        <p>
          If you have questions about this privacy policy, contact us at:{" "}
          <a href="mailto:mohankrishna0089@gmail.com" style={{ color: "#6c63ff" }}>mohankrishna0089@gmail.com</a>
        </p>
      </div>
    </div>
  )
}
