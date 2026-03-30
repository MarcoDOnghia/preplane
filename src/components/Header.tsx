import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Rocket, ChevronDown, Target, LogOut, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header
      className="sticky top-0 z-50 h-16"
      style={{
        background: "#111111",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="max-w-7xl mx-auto flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="bg-[#F97316] p-2 rounded-xl flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">PrepLane</span>
        </button>

        {/* Center nav */}
        {user && (
          <nav className="flex items-center">
            <button
              onClick={() => navigate("/app")}
              className="text-sm font-medium transition-colors px-4 py-2 rounded-lg"
              style={{
                color: isActive("/app") ? "#F97316" : "#94A3B8",
              }}
              onMouseEnter={(e) => { if (!isActive("/app")) (e.target as HTMLButtonElement).style.color = "#FFFFFF"; }}
              onMouseLeave={(e) => { if (!isActive("/app")) (e.target as HTMLButtonElement).style.color = "#94A3B8"; }}
            >
              My Campaigns
            </button>
            <span
              className="text-sm font-medium flex items-center gap-1.5 px-4 py-2"
              style={{ color: '#64748B', cursor: 'default' }}
            >
              CV Workspace
              <span style={{ background: 'rgba(249,116,22,0.15)', color: '#F97416', fontSize: '10px', borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>Soon</span>
            </span>
          </nav>
        )}

        {/* Right: Avatar dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-10 w-10 rounded-full flex items-center justify-center transition-all"
              style={{
                background: "rgba(249,115,22,0.15)",
                border: "1px solid rgba(249,115,22,0.3)",
              }}
            >
              <span className="text-sm font-semibold" style={{ color: "#F97316" }}>
                {user.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-48 py-1 z-50"
                style={{
                  background: "#1A1A1A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                }}
              >
                <button
                  onClick={() => { setDropdownOpen(false); navigate("/onboarding"); }}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors"
                  style={{ color: "#94A3B8" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; }}
                >
                  <Target className="w-4 h-4" />
                  My Target
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); signOut(); }}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors"
                  style={{ color: "#94A3B8" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8"; }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
