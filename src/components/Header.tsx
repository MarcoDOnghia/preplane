import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Compass, LogOut, History, Home, BarChart3 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase.
      from("application_reminders").
      select("*", { count: "exact", head: true }).
      eq("user_id", user.id).
      eq("is_done", false).
      lte("due_date", new Date().toISOString());
      setReminderCount(count || 0);
    };
    fetchCount();
  }, [user, location.pathname]);

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">

          <Compass className="h-6 w-6" />
          <span className="text-xl font-bold tracking-tight">PrepLane</span>
        </button>

        {user &&
        <div className="flex items-center gap-2">
            <Button
            variant={location.pathname === "/app" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate("/app")}>

              <Home className="h-4 w-4 mr-1" />
              New
            </Button>
            <Button
            variant={location.pathname === "/history" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate("/history")}
            className="relative">
              <History className="h-4 w-4 mr-1" />
              History
              {reminderCount > 0 &&
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {reminderCount}
                </span>
            }
            </Button>
            <Button
            variant={location.pathname === "/insights" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate("/insights")}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Insights
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
          </div>
        }
      </div>
    </header>);

};

export default Header;