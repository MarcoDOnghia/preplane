import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Compass, LogOut, History, Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
        >
          <Compass className="h-6 w-6" />
          <span className="text-xl font-bold tracking-tight">OfferPath</span>
        </button>

        {user && (
          <div className="flex items-center gap-2">
            <Button
              variant={location.pathname === "/app" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate("/app")}
            >
              <Home className="h-4 w-4 mr-1" />
              New
            </Button>
            <Button
              variant={location.pathname === "/history" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate("/history")}
            >
              <History className="h-4 w-4 mr-1" />
              History
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
