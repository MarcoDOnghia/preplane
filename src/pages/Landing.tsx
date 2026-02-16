import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Compass, FileText, PenTool, BarChart3, Gamepad2, Users,
  Search, Lightbulb, ArrowRight, CheckCircle2, Sparkles, TrendingUp
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Smart CV Tailoring",
    description: "AI scans your CV and tailors it to match any job description perfectly. Get section-by-section suggestions with priority scoring.",
  },
  {
    icon: PenTool,
    title: "Cover Letter Generator",
    description: "Generate 3 unique cover letter versions — conservative, balanced, and bold — each tailored to the role and company.",
  },
  {
    icon: BarChart3,
    title: "ATS Score Analysis",
    description: "Know your chances before you apply. Get keyword matching, formatting checks, and quick wins to boost your score.",
  },
  {
    icon: Gamepad2,
    title: "Interview Prep Games",
    description: "Prepare for interviews through gamified practice sessions. Master STAR-method responses with instant AI feedback.",
  },
  {
    icon: Search,
    title: "Job Discovery",
    description: "Discover roles that match your skills and experience. Get insights from experts and current employees at target companies.",
    coming: true,
  },
  {
    icon: Users,
    title: "Outreach & Referrals",
    description: "Access outreach templates and referral link generators. Build connections that lead to interviews.",
    coming: true,
  },
  {
    icon: TrendingUp,
    title: "Career Trajectory",
    description: "Understand which skills are fundamental for your career path. Get personalized learning recommendations.",
    coming: true,
  },
  {
    icon: Lightbulb,
    title: "Expert Insights",
    description: "Scrape job insights from industry experts and workers. Know what it's really like before you apply.",
    coming: true,
  },
];

const STATS = [
  { value: "10x", label: "Faster applications" },
  { value: "85%", label: "Avg ATS score boost" },
  { value: "3", label: "Cover letter versions" },
  { value: "10+", label: "Interview questions" },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 text-primary">
            <Compass className="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight">OfferPath</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="container mx-auto px-4 py-20 md:py-32 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Sparkles className="h-4 w-4" />
            Your AI Career Companion
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight">
            From application to{" "}
            <span className="text-primary">offer</span>,{" "}
            we've got your back
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            OfferPath is the ultimate AI buddy that helps you from your first CV scan
            to your first day at your new job. Tailored CVs, cover letters, interview prep,
            and career tracking — all in one place.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8 gap-2" onClick={() => navigate("/auth")}>
              Start Your Journey <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => {
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}>
              See Features
            </Button>
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
            Everything you need to land your{" "}
            <span className="text-primary">dream job</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            A complete toolkit designed to support every stage of your job search journey.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, i) => (
            <Card key={i} className="relative group hover:shadow-lg transition-shadow border-border/60">
              {feature.coming && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </div>
              )}
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
            <p className="mt-4 text-muted-foreground">Three simple steps to your next offer</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Upload your CV", desc: "Paste or upload your existing CV. OfferPath analyzes your experience and skills." },
              { step: "2", title: "Add job description", desc: "Paste the job listing. Our AI identifies requirements and matches them to your profile." },
              { step: "3", title: "Get tailored results", desc: "Receive optimized CV suggestions, cover letters, ATS analysis, and interview prep — instantly." },
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

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to find your path to the{" "}
            <span className="text-primary">perfect offer</span>?
          </h2>
          <div className="flex flex-wrap gap-3 justify-center text-sm text-muted-foreground">
            {["AI-powered tailoring", "ATS optimization", "Interview prep", "Application tracking", "Career insights"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" /> {t}
              </span>
            ))}
          </div>
          <Button size="lg" className="text-base px-10 gap-2" onClick={() => navigate("/auth")}>
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Compass className="h-4 w-4" />
            <span className="text-sm font-medium">OfferPath</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} OfferPath. Your career journey starts here.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
