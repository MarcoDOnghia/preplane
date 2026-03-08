import { useState } from "react";
import { Mail, X } from "lucide-react";

type ModalType = "contact" | "privacy" | "terms" | null;

const AppFooter = () => {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <footer className="border-t border-slate-200 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-6">
          <button onClick={() => setModal("privacy")} className="text-sm text-slate-400 hover:text-[#F97316] transition-colors">Privacy Policy</button>
          <button onClick={() => setModal("terms")} className="text-sm text-slate-400 hover:text-[#F97316] transition-colors">Terms of Service</button>
          <button onClick={() => setModal("contact")} className="text-sm text-slate-400 hover:text-[#F97316] transition-colors">Contact Us</button>
        </div>
      </footer>

      {/* Modal backdrop */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full relative mx-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>

            {modal === "contact" && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Get in touch</h2>
                <p className="text-slate-500 text-sm mt-1 mb-6">Have a question or feedback? We'd love to hear from you.</p>
                <a href="mailto:hello@preplane.co" className="w-full flex items-center justify-center gap-2 bg-[#F97316] hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-all">
                  <Mail className="w-5 h-5" />
                  hello@preplane.co
                </a>
              </>
            )}

            {modal === "privacy" && (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Privacy Policy</h2>
                <p className="text-slate-400 text-xs mb-4">Last updated: March 2026</p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  PrepLane collects only the information you provide directly (name, email, CV data) to power your experience. We do not sell your data to third parties. We use industry-standard security practices to keep your information safe. You can request deletion of your account and data at any time by contacting us at hello@preplane.co.
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
