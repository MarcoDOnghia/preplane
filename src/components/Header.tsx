import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Rocket, LogOut, FileText, Target, LayoutDashboard } from "lucide-react";
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

  const navLinks = [
    { label: "Dashboard", path: "/app", icon: LayoutDashboard },
    { label: "CV Library", path: "/cv-workspace", icon: FileText },
    { label: "My Target", path: "/onboarding", icon: Target },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#F97316]/10 h-16">
      <div className="max-w-7xl mx-auto flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="bg-[#F97316] p-2 rounded-xl flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">PrepLane</span>
        </button>

        {/* Center nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`text-sm transition-colors ${
                  isActive(link.path)
                    ? "text-[#F97316] font-semibold"
                    : "text-slate-600 hover:text-[#F97316]"
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={signOut}
              className="text-sm text-slate-600 hover:text-[#F97316] transition-colors"
            >
              Sign Out
            </button>
          </nav>
        )}

        {/* Right avatar */}
        {user && (
          <div className="h-10 w-10 rounded-full bg-[#F97316]/10 border border-[#F97316]/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-[#F97316]">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
