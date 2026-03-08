import { useState } from "react";
import { X } from "lucide-react";

type ModalType = "privacy" | "terms" | null;

const LINKEDIN_URL = "https://www.linkedin.com/in/marcodonghiaa/";

const AppFooter = () => {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <footer className="border-t border-slate-200 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <button onClick={() => setModal("privacy")} className="text-sm text-slate-400 hover:text-[#F97316] transition-colors">Privacy Policy</button>
            <button onClick={() => setModal("terms")} className="text-sm text-slate-400 hover:text-[#F97316] transition-colors">Terms of Service</button>
          </div>
          <p className="text-xs text-slate-400">
            Questions or feedback?{" "}
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#F97316] transition-colors underline underline-offset-2">
              Reach out on LinkedIn →
            </a>
          </p>
        </div>
      </footer>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full relative mx-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>

            {modal === "privacy" && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Privacy Policy</h2>
                <p className="text-slate-400 text-xs mb-4">Last updated: March 2026</p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  PrepLane collects only the information you provide directly (name, email, CV data) to power your experience. We do not sell your data to third parties. We use industry-standard security practices to keep your information safe. You can request deletion of your account and data at any time by reaching out on{" "}
                  <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="text-[#F97316] underline">LinkedIn</a>.
                </p>
              </>
            )}

            {modal === "terms" && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Terms of Service</h2>
                <p className="text-slate-400 text-xs mb-4">Last updated: March 2026</p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  By using PrepLane you agree to use the product for lawful purposes only. We reserve the right to suspend accounts that misuse the platform. PrepLane is provided as-is and we make no guarantees of job placement outcomes. We may update these terms at any time with notice via email.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AppFooter;
