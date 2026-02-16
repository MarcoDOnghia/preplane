import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, AlertTriangle, Info, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Recommendation {
  title: string;
  description: string;
  type: "success" | "warning" | "info" | "action";
}

interface AiRecommendationsProps {
  summary: Record<string, any>;
}

const ICONS: Record<string, React.ElementType> = {
  success: Lightbulb,
  warning: AlertTriangle,
  info: Info,
  action: Zap,
};

const STYLES: Record<string, string> = {
  success: "border-success/30 bg-success/5",
  warning: "border-warm/30 bg-warm/5",
  info: "border-primary/30 bg-primary/5",
  action: "border-primary/30 bg-primary/5",
};

const AiRecommendations = ({ summary }: AiRecommendationsProps) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: { summary },
      });

      if (error) throw error;
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to generate insights",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Strategy Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Get personalized AI-powered recommendations based on your application data.
            </p>
            <Button onClick={generateInsights} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {loading ? "Analyzing..." : "Generate Insights"}
            </Button>
          </div>
        ) : (
          <>
            {recommendations.map((rec, i) => {
              const Icon = ICONS[rec.type] || Info;
              return (
                <div key={i} className={`rounded-lg border p-3 ${STYLES[rec.type] || STYLES.info}`}>
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={generateInsights} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Refresh Insights
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AiRecommendations;
