import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Compass, LogOut, FileText, Target, LayoutDashboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetRole, setTargetRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("target_role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data && (data as any).target_role) {
          setTargetRole((data as any).target_role);
        }
      });
  }, [user]);

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <Compass className="h-6 w-6" />
          <span className="text-xl font-bold tracking-tight">PrepLane</span>
        </button>

        {user && (
          <div className="flex items-center gap-2">
            {targetRole && (
              <span className="hidden md:inline text-xs text-muted-foreground mr-2 max-w-[180px] truncate">
                🎯 {targetRole}
              </span>
            )}
            <Button
              variant={location.pathname === "/app" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate("/app")}
            >
              <LayoutDashboard className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
            <Button
              variant={location.pathname === "/cv-workspace" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate("/cv-workspace")}
            >
              <FileText className="h-4 w-4 mr-1" />
              CV Workspace
            </Button>
            <Button
              variant={location.pathname === "/onboarding" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate("/onboarding")}
            >
              <Target className="h-4 w-4 mr-1" />
              My Target
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
