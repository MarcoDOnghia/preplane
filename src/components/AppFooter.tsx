import { Link } from "react-router-dom";

const LINKEDIN_URL = "https://www.linkedin.com/in/marcodonghiaa/";

const AppFooter = () => {
  return (
    <footer className="border-t border-slate-200 py-8 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="text-sm text-slate-400 hover:text-[#F97316] transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="text-sm text-slate-400 hover:text-[#F97316] transition-colors">Terms of Service</Link>
        </div>
        <p className="text-xs text-slate-400">
          Questions or feedback?{" "}
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#F97316] transition-colors underline underline-offset-2">
            Reach out on LinkedIn →
          </a>
        </p>
      </div>
    </footer>
  );
};

export default AppFooter;
