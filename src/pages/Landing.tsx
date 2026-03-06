import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Compass, FileText, PenTool, BarChart3,
  ArrowRight, CheckCircle2, Sparkles, ChevronDown, Mail, Linkedin
} from "lucide-react";
import previewAts from "@/assets/preview-ats.png";
import previewCv from "@/assets/preview-cv.png";
import previewCover from "@/assets/preview-cover.png";

const PREVIEW_TABS = [
  { label: "Job Match Score", image: previewAts, alt: "Job match score with keyword analysis and quick wins" },
  { label: "CV Suggestions", image: previewCv, alt: "Side-by-side CV suggestions with impact scoring" },
  { label: "Cover Letter", image: previewCover, alt: "Tailored cover letter for the role" },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Smart CV Tailoring",
    description: "AI analyzes your CV against any job description and gives section-by-section suggestions with priority scoring.",
  },
  {
    icon: PenTool,
    title: "Tailored Cover Letter",
    description: "Get a cover letter tailored to the role, company, and your chosen tone — ready to send.",
  },
  {
    icon: BarChart3,
    title: "Job Match Score & Quick Wins",
    description: "See your job match score, missing keywords, formatting issues, and actionable quick wins before you apply.",
  },
];

const FAQ = [
  {
    q: "Is PrepLane free to use?",
    a: "Yes! No credit card, no trial period, no hidden costs. Sign up and start tailoring applications immediately.",
  },
  {
    q: "How does PrepLane improve my chances of getting interviews?",
    a: "According to Jobscan research, 99% of Fortune 500 companies use Applicant Tracking Systems (ATS), and approximately 75% of resumes are automatically rejected before reaching human recruiters. PrepLane helps you beat these systems by analyzing keyword match between your CV and job description, identifying ATS-unfriendly formatting (tables, images, columns), scoring your CV compatibility (0–100), and providing specific, actionable improvements. We can't guarantee interviews, but we help ensure your CV gets past the first automated screening and into human hands.",
    link: { label: "Jobscan ATS Research", url: "https://www.jobscan.co/blog/fortune-500-use-applicant-tracking-systems/" },
  },
  {
    q: "What makes PrepLane different from other AI CV tools?",
    a: "Most tools just rewrite your CV. PrepLane gives you a job match score, generates a tailored cover letter, and shows you exactly what to fix — it's a focused CV optimization tool, not just a formatter.",
  },
  {
    q: "Is my data private and secure?",
    a: "Yes. Your CV and applications are encrypted and only visible to you. We use high-level security (AES-256 encryption) and never share your data with third parties. You can delete everything at any time.",
  },
];

const FaqItem = ({ q, a, link }: { q: string; a: string; link?: { label: string; url: string } }) => {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left border-b border-border last:border-0 py-5 group"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-base">{q}</h3>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="mt-3 text-sm text-muted-foreground leading-relaxed">
          <p>{a}</p>
          {link && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-block mt-2 text-primary hover:underline text-sm font-medium"
            >
              {link.label} →
            </a>
          )}
        </div>
      )}
    </button>
  );
};


const AppPreviewShowcase = () => {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % PREVIEW_TABS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="container mx-auto px-4 pb-16 md:pb-24">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Tab buttons */}
        <div className="flex justify-center gap-2 flex-wrap">
          {PREVIEW_TABS.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === i
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Image */}
        <div className="rounded-xl border border-border/60 shadow-2xl shadow-primary/5 overflow-hidden bg-card">
          <img
            src={PREVIEW_TABS[activeTab].image}
            alt={PREVIEW_TABS[activeTab].alt}
            className="w-full h-auto transition-opacity duration-300"
            loading="lazy"
          />
        </div>
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {PREVIEW_TABS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`h-1.5 rounded-full transition-all ${
                activeTab === i ? "w-8 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/app", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 text-primary">
            <Compass className="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight">PrepLane</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get Started Free
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="container mx-auto px-4 pt-20 pb-12 md:pt-32 md:pb-16 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Sparkles className="h-4 w-4" />
            AI-Powered CV Tailoring
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
            Land the internship you{" "}
            <span className="text-primary">actually want</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Most students apply to 50 jobs and hear nothing. PrepLane helps you build a targeted, compelling application for the roles that matter — and actually get responses.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8 gap-2" onClick={() => navigate("/auth")}>
              Try It Free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => {
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}>
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* App Preview Showcase */}
      <AppPreviewShowcase />


      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold">
            Everything you need to{" "}
            <span className="text-primary">land interviews</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Three focused tools to help you stand out and get responses.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {FEATURES.map((feature, i) => (
            <Card key={i} className="group hover:shadow-lg transition-shadow border-border/60">
              <CardContent className="pt-6 pb-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card/50 border-y">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
            <p className="mt-4 text-muted-foreground">Three steps. Under a minute.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Upload your CV", desc: "Paste or upload your existing CV as PDF, Word, or plain text." },
              { step: "2", title: "Add job description", desc: "Paste the job listing. AI identifies key requirements and matches them to your profile." },
              { step: "3", title: "Get instant results", desc: "Tailored CV suggestions, a cover letter, and job match score — all at once." },
            ].map((item, i) => (
              <div key={i} className="text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="divide-y-0">
            {FAQ.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} link={(item as any).link} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-card/50 border-y">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to stand out from{" "}
              <span className="text-primary">every other applicant</span>?
            </h2>
            <div className="flex flex-wrap gap-3 justify-center text-sm text-muted-foreground">
              {["AI-powered tailoring", "Job match scoring", "Tailored cover letter"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> {t}
                </span>
              ))}
            </div>
            <Button size="lg" className="text-base px-10 gap-2" onClick={() => navigate("/auth")}>
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">No credit card required</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Compass className="h-4 w-4" />
            <span className="text-sm font-medium">PrepLane</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://www.linkedin.com/in/marcodonghiaa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Linkedin className="h-3.5 w-3.5" />
              LinkedIn
            </a>
            <a
              href="mailto:feedback@preplane.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" />
              Feedback & Contact
            </a>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} PrepLane
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
