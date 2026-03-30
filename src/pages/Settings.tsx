import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, ArrowLeft, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  if (loading) return null;
  if (!user) {
    navigate("/onboarding");
    return null;
  }

  const handleExportData = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("gdpr-export-data", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;

      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `preplane-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Data exported", description: "Your data has been downloaded." });
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("gdpr-delete-account", {
        body: { confirmation: "DELETE_MY_ACCOUNT" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;

      toast({ title: "Account deleted", description: "All your data has been permanently removed." });
      await supabase.auth.signOut();
      navigate("/onboarding");
    } catch {
      toast({ title: "Deletion failed", description: "Please try again or contact support.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground mb-10">Manage your account and data privacy.</p>

        {/* Data & Privacy Section */}
        <div className="border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Data & Privacy</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            You have the right to access and export all your personal data at any time (GDPR Art. 15 & 20).
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={exporting}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {exporting ? "Exporting..." : "Export all my data"}
            </Button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="border border-destructive/30 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Permanently delete your account and all associated data. This action cannot be undone.
            All your campaigns, CVs, applications, and personal information will be erased (GDPR Art. 17).
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <span className="block">
                    This will permanently delete your account and all your data including:
                  </span>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>All campaigns and research signals</li>
                    <li>All CVs and uploaded files</li>
                    <li>All applications, notes, and feedback</li>
                    <li>Your profile and preferences</li>
                  </ul>
                  <span className="block font-medium">
                    Type <span className="font-mono text-destructive">DELETE</span> to confirm:
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirm("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== "DELETE" || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting..." : "Permanently delete everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <p className="text-xs text-muted-foreground mt-8 text-center">
          Questions about your data? Contact us at privacy@preplane.co
        </p>
      </div>
    </div>
  );
};

export default Settings;
