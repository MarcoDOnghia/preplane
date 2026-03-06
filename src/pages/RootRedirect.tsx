import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const ONBOARDING_KEY = "preplane_onboarding_done";

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  // Logged-in user → straight to app
  if (user) return <Navigate to="/app" replace />;

  // Not logged in — check if they finished onboarding (pre-auth)
  const onboardingDone = localStorage.getItem(ONBOARDING_KEY) === "true";

  if (onboardingDone) {
    // Completed onboarding but not signed up → go to sign-up step
    return <Navigate to="/onboarding?step=4" replace />;
  }

  // Brand new user → onboarding
  return <Navigate to="/onboarding" replace />;
};

export default RootRedirect;
