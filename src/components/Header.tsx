import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Rocket, ChevronDown, Target, LogOut, Settings, Download, Trash2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const handleExport = async () => {
    if (!user || exporting) return;
    setExporting(true);
    setDropdownOpen(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("gdpr-export-data", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw res.error;

      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preplane-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Export started", description: "Your data file is downloading." });
    } catch {
      toast({ title: "Export failed", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || deleting || deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("gdpr-delete-account", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.error) throw res.error;

      await supabase.auth.signOut();
      navigate("/onboarding");
      toast({ title: "Account deleted", description: "Your account has been deleted." });
    } catch {
      toast({ title: "Deletion failed", description: "Something went wrong. Please try again.", variant: "destructive" });
      setDeleting(false);
    }
  };

  const dropdownBtn = (onClick: () => void, icon: React.ReactNode, label: string, danger?: boolean) => (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors"
      style={{ color: danger ? "#ef4444" : "#94A3B8" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; if (!danger) e.currentTarget.style.color = "#FFFFFF"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = danger ? "#ef4444" : "#94A3B8"; }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <header
        className="sticky top-0 z-50 h-16"
        style={{
          background: "#111111",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div className="max-w-7xl mx-auto flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="bg-[#F97316] p-2 rounded-xl flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">PrepLane</span>
          </button>

          {user && (
            <nav className="flex items-center">
              <button
                onClick={() => navigate("/app")}
                className="text-sm font-medium transition-colors px-4 py-2 rounded-lg"
                style={{ color: isActive("/app") ? "#F97316" : "#94A3B8" }}
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
                  {dropdownBtn(() => { setDropdownOpen(false); navigate("/onboarding"); }, <Target className="w-4 h-4" />, "My Target")}
                  {dropdownBtn(() => { setDropdownOpen(false); navigate("/settings"); }, <Settings className="w-4 h-4" />, "Settings")}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                  {dropdownBtn(handleExport, <Download className="w-4 h-4" />, exporting ? "Exporting…" : "Export my data")}
                  {dropdownBtn(() => { setDropdownOpen(false); setShowDeleteModal(true); setDeleteInput(""); }, <Trash2 className="w-4 h-4" />, "Delete my account", true)}
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                  {dropdownBtn(() => { setDropdownOpen(false); signOut(); }, <LogOut className="w-4 h-4" />, "Sign out")}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div
            className="w-full max-w-md mx-4"
            style={{ background: "#1A1A1A", border: "1px solid #ef4444", borderRadius: 16, padding: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-3">Delete your account</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#94A3B8" }}>
              This will permanently delete:
            </p>
            <ul className="text-sm mb-5 space-y-1" style={{ color: "#94A3B8" }}>
              <li>• Your account and profile</li>
              <li>• All your campaigns and briefs</li>
              <li>• All your proof cards</li>
              <li>• All your CV data</li>
            </ul>
            <p className="text-sm font-semibold mb-4" style={{ color: "#ef4444" }}>This cannot be undone.</p>

            <label className="block text-sm font-medium text-white mb-2">Type DELETE to confirm</label>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none mb-5"
              style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.1)" }}
              placeholder="DELETE"
              disabled={deleting}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.2)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteInput !== "DELETE" || deleting}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all"
                style={{
                  background: deleteInput === "DELETE" ? "#ef4444" : "rgba(239,68,68,0.3)",
                  cursor: deleteInput === "DELETE" && !deleting ? "pointer" : "not-allowed",
                  opacity: deleteInput === "DELETE" ? 1 : 0.5,
                }}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
