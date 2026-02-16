import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ResultsSection from "@/components/ResultsSection";
import type { TailorResult } from "@/lib/types";

interface AppRow {
  id: string;
  job_title: string;
  company: string;
  tone: string;
  key_requirements: any;
  cv_suggestions: any;
  cover_letter: string;
  created_at: string;
}

const History = () => {
  const { user, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<AppRow | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchApps();
  }, [user]);

  const fetchApps = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("id, job_title, company, tone, key_requirements, cv_suggestions, cover_letter, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) setApps(data);
    setLoading(false);
  };

  const deleteApp = async (id: string) => {
    const { error } = await supabase.from("applications").delete().eq("id", id);
    if (!error) {
      setApps((prev) => prev.filter((a) => a.id !== id));
      if (selectedApp?.id === id) setSelectedApp(null);
      toast({ title: "Deleted", description: "Application removed from history." });
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (selectedApp) {
    const result: TailorResult = {
      keyRequirements: selectedApp.key_requirements as string[],
      cvSuggestions: selectedApp.cv_suggestions as any[],
      coverLetter: selectedApp.cover_letter,
    };

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
          <Button variant="ghost" onClick={() => setSelectedApp(null)}>
            ← Back to History
          </Button>
          <ResultsSection result={result} jobTitle={selectedApp.job_title} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Application History</h2>
            <p className="text-muted-foreground mt-1">
              {apps.length} past application{apps.length !== 1 ? "s" : ""}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : apps.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No applications yet</h3>
                <p className="text-muted-foreground mt-1">
                  Tailor your first application and it will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {apps.map((app) => (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="space-y-1 flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{app.job_title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{app.company}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(app.created_at).toLocaleDateString()}
                        <Badge variant="outline" className="text-xs capitalize">
                          {app.tone}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => setSelectedApp(app)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteApp(app.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
