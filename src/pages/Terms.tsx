import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
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

        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Last updated: March 2026
        </p>

        <div className="space-y-8 text-[15px] leading-relaxed" style={{ color: "#E2E8F0" }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">What PrepLane is</h2>
            <p>
              PrepLane is a career targeting tool that helps first-time job seekers build focused, high-quality job application campaigns. It provides CV analysis, company research, outreach suggestions, and proof-of-work tools.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Who can use it</h2>
            <p>
              PrepLane is available to anyone aged 16 or older. By creating an account, you confirm that you meet this age requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Acceptable use</h2>
            <p>
              You agree to use PrepLane for its intended purpose — preparing job applications. You may not use the platform to send spam, harass others, scrape data, or engage in any activity that could harm the service or other users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Account termination</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms or misuse the platform. If your account is terminated for abuse, you will be notified via the email address associated with your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Service disclaimer</h2>
            <p>
              PrepLane is provided "as-is" without warranties of any kind. We do our best to provide accurate and helpful suggestions, but we make no guarantees about job placement outcomes, interview success, or the accuracy of AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Governing law</h2>
            <p>
              These terms are governed by the laws of Italy. Any disputes arising from the use of PrepLane will be subject to the jurisdiction of Italian courts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about these terms? Reach out at{" "}
              <a href="mailto:marco@preplane.co" className="text-[#ff9159] hover:underline">
                marco@preplane.co
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
