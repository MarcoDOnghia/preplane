import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm mb-10 transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#ff9159")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Last updated: March 2026
        </p>

        <div className="space-y-8 text-[15px] leading-relaxed" style={{ color: "#E2E8F0" }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">What data we collect</h2>
            <p>
              When you use PrepLane, we collect the information you provide directly: your email address, display name,
              CV content, job descriptions, campaign data, and general usage data (like which features you use and
              when).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Why we collect it</h2>
            <p>
              We collect your data for one reason: to provide and improve the service. Your CV content is used to
              generate tailored suggestions, your campaign data powers your dashboard, and usage data helps us
              understand what's working.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">How we store it</h2>
            <p>
              Your data is stored securely on servers located in the European Union, powered by Supabase. All data is
              encrypted in transit (TLS) and at rest. We use row-level security to ensure your data is only accessible
              to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">How long we keep it</h2>
            <p>
              We keep your data for as long as you have an active account. When you delete your account, all your data —
              including CVs, campaigns, applications, and profile information — is permanently removed from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Your rights under GDPR</h2>
            <p className="mb-3">As a user, you have the right to:</p>
            <ul className="space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <span className="text-[#ff9159] mt-0.5">•</span>
                <span>
                  <strong className="text-white">Access your data</strong> — Export a full copy of everything we store
                  about you, directly from your Settings page.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff9159] mt-0.5">•</span>
                <span>
                  <strong className="text-white">Delete your account and all data</strong> — Permanently remove your
                  account and all associated data from your Settings page.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff9159] mt-0.5">•</span>
                <span>
                  <strong className="text-white">Export your data</strong> — Download a machine-readable copy of your
                  data at any time.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff9159] mt-0.5">•</span>
                <span>
                  <strong className="text-white">Object to processing</strong> — Contact us to restrict how we use your
                  data.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Third-party data processors</h2>
            <p className="mb-3">
              To provide the service, Preplane shares limited data with the following third-party processors:
            </p>
            <ul className="space-y-4 pl-1">
              <li className="flex items-start gap-2">
                <span className="text-[#ff9159] mt-0.5">•</span>
                <span>
                  <strong className="text-white">Google (Gemini AI)</strong> — receives CV content, job descriptions,
                  and campaign data to power AI-driven CV tailoring, cover letter generation, keyword analysis,
                  interview preparation, and outreach suggestions.{" "}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff9159] hover:underline"
                  >
                    Privacy Policy
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff9159] mt-0.5">•</span>
                <span>
                  <strong className="text-white">Perplexity AI</strong> — receives company names and role titles for
                  company research.{" "}
                  <a
                    href="https://perplexity.ai/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff9159] hover:underline"
                  >
                    Privacy Policy
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff9159] mt-0.5">•</span>
                <span>
                  <strong className="text-white">Supabase</strong> — stores all account and application data on EU-based
                  servers.{" "}
                  <a
                    href="https://supabase.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff9159] hover:underline"
                  >
                    Privacy Policy
                  </a>
                </span>
              </li>
            </ul>
            <p className="mt-4">
              Transfers to Google and Perplexity involve US-based servers and are conducted under Standard
              Contractual Clauses (SCCs) as provided under GDPR Article 46.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Third parties & advertising</h2>
            <p>
              We do not sell your data to third parties. We do not use your data for advertising. We do not share your
              information with marketers, data brokers, or anyone else.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Cookies</h2>
            <p>
              We only use essential session cookies required to keep you logged in and the app functioning. No tracking
              cookies, no analytics cookies, no third-party cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Contact</h2>
            <p>
              For any data requests, questions, or concerns, reach out to us at{" "}
              <a href="mailto:marco@preplane.co" className="text-[#ff9159] hover:underline">
                marco@preplane.co
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
