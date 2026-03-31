import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import RootRedirect from "./pages/RootRedirect";

const Index = lazy(() => import("./pages/Index"));
const NewCampaign = lazy(() => import("./pages/NewCampaign"));
const CvWorkspace = lazy(() => import("./pages/CvWorkspace"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Campaign = lazy(() => import("./pages/Campaign"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProofCard = lazy(() => import("./pages/ProofCard"));
const Settings = lazy(() => import("./pages/Settings"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/app" element={<Index />} />
              <Route path="/app/new" element={<NewCampaign />} />
              <Route path="/cv-workspace" element={<CvWorkspace />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/campaign/:id" element={<Campaign />} />
              <Route path="/p/:slug" element={<ProofCard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/auth" element={<Navigate to="/onboarding?step=4&mode=login" replace />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
