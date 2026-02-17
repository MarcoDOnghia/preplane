import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Compass, FileText, PenTool, BarChart3, MessageSquare, ClipboardCheck,
  ArrowRight, CheckCircle2, Sparkles, ChevronDown, Mail
} from "lucide-react";
import appPreview from "@/assets/app-preview.png";

const FEATURES = [
  {
    icon: FileText,
    title: "Smart CV Tailoring",
    description: "AI analyzes your CV against any job description and gives section-by-section suggestions with priority scoring.",
  },
  {
    icon: PenTool,
    title: "3 Cover Letter Versions",
    description: "Get conservative, balanced, and bold cover letters — each tailored to the role, company, and your chosen tone.",
  },
  {
    icon: BarChart3,
    title: "ATS Score & Quick Wins",
    description: "See your ATS compatibility score, missing keywords, formatting issues, and actionable quick wins before you apply.",
  },
  {
    icon: ClipboardCheck,
    title: "Interview Prep & Feedback",
    description: "10+ predicted questions with STAR guidance. Log post-interview feedback and track which questions actually came up.",
  },
  {
    icon: MessageSquare,
    title: "Outreach Templates",
    description: "AI-generated messages for hiring managers, follow-ups, thank-yous, and offer negotiations — ready to send.",
  },
];

const STATS = [
  { value: "60s", label: "To tailor your CV" },
  { value: "85%+", label: "Avg ATS score boost" },
  { value: "3", label: "Cover letter versions" },
  { value: "10+", label: "Interview questions" },
];

const FAQ = [
  {
    q: "Is PrepLane free to use?",
    a: "Yes — sign up for free and start tailoring your applications immediately. No credit card required.",
  },
  {
    q: "How does the ATS score work?",
    a: "We analyze your CV against the job description for keyword matches, formatting issues, and structural alignment. You get a score out of 100 plus actionable quick wins.",
  },
  {
    q: "Can I use my own CV format?",
    a: "Absolutely. Upload a PDF or Word doc, or paste your CV text directly. PrepLane works with any format.",
  },
  {
    q: "How are cover letters generated?",
    a: "Our AI reads your CV and the job description, then writes three versions (conservative, balanced, bold) matching your selected tone.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All data is encrypted and stored securely. You're the only person who can access your applications and CV content.",
  },
];

const FaqItem = ({ q, a }: { q: string; a: string }) => {
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
      {open && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </button>
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
            Tailor your CV in{" "}
            <span className="text-primary">60 seconds</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Paste your CV and a job description — get tailored suggestions, three cover letter versions, ATS scoring, and interview prep. All instantly.
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

      {/* App Preview Screenshot */}
      <section className="container mx-auto px-4 pb-16 md:pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-xl border border-border/60 shadow-2xl shadow-primary/5 overflow-hidden bg-card">
            <img
              src={appPreview}
              alt="PrepLane app showing CV tailoring results with ATS score analysis"
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-card/50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20 md:py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold">
            Everything you need to{" "}
            <span className="text-primary">land interviews</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            A focused toolkit for every stage — from application to offer.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
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
              { step: "3", title: "Get instant results", desc: "Tailored CV suggestions, 3 cover letters, ATS score, and interview prep — all at once." },
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
              <FaqItem key={i} q={item.q} a={item.a} />
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
              {["AI-powered tailoring", "ATS optimization", "Interview prep", "Application tracking", "Outreach templates"].map((t) => (
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
