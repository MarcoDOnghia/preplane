import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import ConversionFunnel from "@/components/insights/ConversionFunnel";
import MethodChart from "@/components/insights/MethodChart";
import AtsImpactChart from "@/components/insights/AtsImpactChart";
import TimeAnalysis from "@/components/insights/TimeAnalysis";
import KeywordsInsight from "@/components/insights/KeywordsInsight";
import WeeklySummary from "@/components/insights/WeeklySummary";
import AiRecommendations from "@/components/insights/AiRecommendations";
import SuccessPatterns from "@/components/insights/SuccessPatterns";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AppRow {
  id: string;
  status: string | null;
  ats_score: number | null;
  application_method: string | null;
  tone: string;
  created_at: string;
  applied_date: string | null;
  keywords_found: any;
  keywords_missing: any;
}

const INTERVIEW_STATUSES = ["recruiter_screen", "phone_interview", "onsite_interview"];
const RESPONSE_STATUSES = [...INTERVIEW_STATUSES, "offer", "accepted", "rejected"];

const METHOD_LABELS: Record<string, string> = {
  company_website: "Website",
  linkedin: "LinkedIn",
  email: "Email",
  referral: "Referral",
  recruiter: "Recruiter",
  other: "Other",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Insights = () => {
  const { user, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchApps();
  }, [user]);

  const fetchApps = async () => {
    const { data } = await supabase
      .from("applications")
      .select("id, status, ats_score, application_method, tone, created_at, applied_date, keywords_found, keywords_missing")
      .order("created_at", { ascending: false });
    if (data) setApps(data as AppRow[]);
    setLoading(false);
  };

  const computed = useMemo(() => {
    const appliedApps = apps.filter((a) => a.status && a.status !== "preparing" && a.status !== "archived");
    const responded = apps.filter((a) => a.status && RESPONSE_STATUSES.includes(a.status));
    const interviewed = apps.filter((a) => a.status && INTERVIEW_STATUSES.includes(a.status));
    const offers = apps.filter((a) => a.status === "offer" || a.status === "accepted");

    // Funnel
    const total = appliedApps.length || 1;
    const funnelStages = [
      { label: "Applied", count: appliedApps.length, percentage: 100 },
      { label: "Responses", count: responded.length, percentage: Math.round((responded.length / total) * 100) },
      { label: "Interviews", count: interviewed.length, percentage: Math.round((interviewed.length / total) * 100) },
      { label: "Offers", count: offers.length, percentage: Math.round((offers.length / total) * 100) },
    ];

    // Method stats
    const methodMap: Record<string, { total: number; responses: number }> = {};
    apps.forEach((a) => {
      if (!a.application_method) return;
      if (!methodMap[a.application_method]) methodMap[a.application_method] = { total: 0, responses: 0 };
      methodMap[a.application_method].total++;
      if (a.status && RESPONSE_STATUSES.includes(a.status)) methodMap[a.application_method].responses++;
    });
    const methodData = Object.entries(methodMap).map(([k, v]) => ({
      method: METHOD_LABELS[k] || k,
      total: v.total,
      responses: v.responses,
      rate: v.total > 0 ? Math.round((v.responses / v.total) * 100) : 0,
    })).sort((a, b) => b.rate - a.rate);
    const bestMethod = methodData.length > 0 ? methodData[0].method : null;

    // ATS impact
    const atsRanges = [
      { range: "0-59", min: 0, max: 59 },
      { range: "60-79", min: 60, max: 79 },
      { range: "80-100", min: 80, max: 100 },
    ].map(({ range, min, max }) => {
      const inRange = apps.filter((a) => (a.ats_score || 0) >= min && (a.ats_score || 0) <= max);
      const responded = inRange.filter((a) => a.status && RESPONSE_STATUSES.includes(a.status));
      return {
        range,
        total: inRange.length,
        responded: responded.length,
        rate: inRange.length > 0 ? Math.round((responded.length / inRange.length) * 100) : 0,
      };
    });

    // Time analysis
    const now = Date.now();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    const responseTimes = apps
      .filter((a) => a.applied_date && a.status && RESPONSE_STATUSES.includes(a.status))
      .map((a) => Math.round((new Date(a.created_at).getTime() - new Date(a.applied_date!).getTime()) / (1000 * 60 * 60 * 24)))
      .filter((d) => d > 0);
    const avgResponseDays = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

    const staleCount = apps.filter(
      (a) => a.applied_date && a.status === "applied" && now - new Date(a.applied_date).getTime() > twoWeeksMs
    ).length;

    // Day of week
    const dayStats = DAY_NAMES.map((day) => ({ day, count: 0, responses: 0, rate: 0 }));
    apps.forEach((a) => {
      const d = new Date(a.applied_date || a.created_at).getDay();
      dayStats[d].count++;
      if (a.status && RESPONSE_STATUSES.includes(a.status)) dayStats[d].responses++;
    });
    dayStats.forEach((d) => { d.rate = d.count > 0 ? Math.round((d.responses / d.count) * 100) : 0; });

    // Keywords
    const keywordCount: Record<string, { success: number; fail: number }> = {};
    apps.forEach((a) => {
      const kws = [...(Array.isArray(a.keywords_found) ? a.keywords_found : []), ...(Array.isArray(a.keywords_missing) ? a.keywords_missing : [])];
      const isSuccess = a.status && INTERVIEW_STATUSES.includes(a.status);
      kws.forEach((kw: string) => {
        if (!kw || typeof kw !== "string") return;
        const k = kw.toLowerCase().trim();
        if (!keywordCount[k]) keywordCount[k] = { success: 0, fail: 0 };
        if (isSuccess) keywordCount[k].success++;
        else keywordCount[k].fail++;
      });
    });
    const successKeywords = Object.entries(keywordCount)
      .filter(([, v]) => v.success > 0)
      .sort((a, b) => b[1].success - a[1].success)
      .map(([k, v]) => ({ keyword: k, count: v.success }));
    const failKeywords = Object.entries(keywordCount)
      .filter(([, v]) => v.success === 0 && v.fail >= 2)
      .sort((a, b) => b[1].fail - a[1].fail)
      .map(([k, v]) => ({ keyword: k, count: v.fail }));

    // Weekly/Monthly
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

    const countPeriod = (start: Date, end: Date) => {
      const inPeriod = apps.filter((a) => {
        const d = new Date(a.applied_date || a.created_at);
        return d >= start && d < end;
      });
      return {
        applied: inPeriod.length,
        responses: inPeriod.filter((a) => a.status && RESPONSE_STATUSES.includes(a.status)).length,
        interviews: inPeriod.filter((a) => a.status && INTERVIEW_STATUSES.includes(a.status)).length,
      };
    };

    const thisWeek = countPeriod(oneWeekAgo, new Date());
    const thisMonth = countPeriod(thisMonthStart, new Date());
    const lastMonth = countPeriod(lastMonthStart, thisMonthStart);

    // Tone patterns
    const toneMap: Record<string, { count: number; interviews: number }> = {};
    apps.forEach((a) => {
      if (!toneMap[a.tone]) toneMap[a.tone] = { count: 0, interviews: 0 };
      toneMap[a.tone].count++;
      if (a.status && INTERVIEW_STATUSES.includes(a.status)) toneMap[a.tone].interviews++;
    });
    const toneData = Object.entries(toneMap).map(([k, v]) => ({
      label: k,
      count: v.count,
      interviews: v.interviews,
      rate: v.count > 0 ? Math.round((v.interviews / v.count) * 100) : 0,
    }));

    // AI summary
    const aiSummary = {
      totalApps: apps.length,
      appliedCount: appliedApps.length,
      responseRate: funnelStages[1].percentage,
      interviewRate: funnelStages[2].percentage,
      offerRate: funnelStages[3].percentage,
      methodStats: methodData,
      avgResponseDays,
      staleCount,
      toneData,
      topKeywords: successKeywords.slice(0, 5).map((k) => k.keyword),
    };

    return { funnelStages, methodData, bestMethod, atsRanges, avgResponseDays, dayStats, staleCount, successKeywords, failKeywords, thisWeek, thisMonth, lastMonth, toneData, aiSummary };
  }, [apps]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-sm text-muted-foreground">Understand what's working and optimize your job search strategy.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : apps.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No data yet</h3>
              <p className="text-muted-foreground mt-1">Tailor some applications to start seeing insights.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Row 1: Funnel + Weekly Summary */}
            <div className="grid md:grid-cols-2 gap-6">
              <ConversionFunnel stages={computed.funnelStages} />
              <WeeklySummary
                thisWeek={computed.thisWeek}
                thisMonth={computed.thisMonth}
                lastMonth={computed.lastMonth}
              />
            </div>

            {/* Row 2: Method + ATS */}
            <div className="grid md:grid-cols-2 gap-6">
              <MethodChart data={computed.methodData} bestMethod={computed.bestMethod} />
              <AtsImpactChart data={computed.atsRanges} />
            </div>

            {/* Row 3: Time + Keywords */}
            <div className="grid md:grid-cols-2 gap-6">
              <TimeAnalysis
                avgResponseDays={computed.avgResponseDays}
                dayOfWeekStats={computed.dayStats}
                staleCount={computed.staleCount}
              />
              <KeywordsInsight
                successKeywords={computed.successKeywords}
                failKeywords={computed.failKeywords}
              />
            </div>

            {/* Row 4: Patterns + AI */}
            <div className="grid md:grid-cols-2 gap-6">
              <SuccessPatterns toneData={computed.toneData} />
              <AiRecommendations summary={computed.aiSummary} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Insights;
