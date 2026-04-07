# Chrome Web Store Listing — YuktiHire

## How to publish

1. Go to https://chrome.google.com/webstore/devconsole/register
2. Pay $5 one-time developer fee
3. Click "New Item"
4. Upload the yuktihire-extension.zip file
5. Fill in the details below
6. Submit for review (1-3 business days)

---

## Store Listing Details

### Name
YuktiHire — AI Job Application Assistant

### Short Description (132 chars max)
Save jobs, autofill applications, tailor resumes, and practice interviews — all powered by AI. Apply to jobs 10x faster.

### Detailed Description
YuktiHire is your AI-powered job application assistant. It helps you apply to jobs faster and smarter — right from your browser.

**What it does:**

🔹 **Save Jobs** — One click to save any job posting from LinkedIn, Indeed, Greenhouse, Lever, Workday, and 30+ portals

🔹 **Smart Autofill** — Fills your name, email, phone, work authorization, and 100+ form fields automatically. Supports custom dropdowns, radio buttons, and multi-step forms

🔹 **AI Answers** — Generates personalized answers for "Why this company?", "Tell us about a project", salary expectations, and more — grounded in YOUR resume and the specific job description

🔹 **Resume Tailoring** — Tailors your resume to match the job description with one click. Optimizes ATS score to 80-100%

🔹 **Mock Interviews** — Practice with an AI interviewer that asks role-specific questions based on the actual JD

**Supported Portals:**
LinkedIn, Indeed, Greenhouse, Lever, Workday, iCIMS, Ashby, SmartRecruiters, BambooHR, JazzHR, Breezy HR, ZipRecruiter, and 20+ more

**Privacy:**
- Your data stays in your YuktiHire account
- We never share your information with employers
- No tracking of your browsing history
- Password fields are never auto-filled

### Category
Productivity

### Language
English

### Screenshots needed
1. Extension popup showing job detection
2. Side panel with Fill All button and progress
3. ATS score after tailoring
4. Autofill in action on a Greenhouse form

### Icons needed
- 128x128 PNG (already have: icons/icon128.png)
- Store icon: 96x96 or 128x128

### Privacy Policy URL
https://yuktihire.com/marketing (update to dedicated privacy page later)

### Website
https://yuktihire.com

---

## Permissions Justification (for Chrome review)

### activeTab
Used to detect job postings and fill application forms on the current tab only.

### storage
Stores authentication tokens and user preferences locally.

### cookies
Reads authentication cookies from yuktihire.com to keep the user signed in.

### scripting
Injects the autofill engine and job detection scripts into job application pages.

### Host permissions (<all_urls>)
Required to detect and fill job application forms across all career portals (LinkedIn, Greenhouse, Lever, Workday, etc.). The extension only activates on pages that contain job application forms.
