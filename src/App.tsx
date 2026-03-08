import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BASE_PATH } from "@/lib/config";
import { PlaidEnvironmentProvider } from "@/contexts/PlaidEnvironmentContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { CookieConsentBanner, getCookieConsent, CookieConsentLevel } from "@/components/consent/CookieConsentBanner";
import { CookieDeclinedScreen } from "@/components/consent/CookieDeclinedScreen";
import { DataConsentDialog } from "@/components/consent/DataConsentDialog";
import { Loader2 } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Reports from "./pages/Reports";
import Accounts from "./pages/Accounts";
import Connections from "./pages/Connections";
import Settings from "./pages/Settings";
import AdminUsers from "./pages/AdminUsers";
import AdminPlaid from "./pages/AdminPlaid";
import AdminBackend from "./pages/AdminBackend";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

const queryClient = new QueryClient();

function CookieGate({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = React.useState<CookieConsentLevel>(getCookieConsent());

  React.useEffect(() => {
    const handler = (e: Event) => setConsent((e as CustomEvent).detail);
    window.addEventListener('cookie-consent-changed', handler);
    return () => window.removeEventListener('cookie-consent-changed', handler);
  }, []);

  const updateConsent = (level: CookieConsentLevel) => {
    localStorage.setItem('cookie_consent', level!);
    setConsent(level);
    window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: level }));
  };

  if (consent === 'declined') {
    return (
      <CookieDeclinedScreen
        onAcceptEssential={() => updateConsent('essential')}
        onAcceptAll={() => updateConsent('accepted')}
      />
    );
  }

  return <>{children}</>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <>{children}</>;
}

const App = () => (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlaidEnvironmentProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <CookieConsentBanner />
            <CookieGate>
            <AuthGate>
              <PreferencesProvider>
                <DataConsentDialog />
                <BrowserRouter basename={BASE_PATH}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/budgets" element={<Budgets />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/connections" element={<Connections />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/plaid" element={<AdminPlaid />} />
                    <Route path="/admin/backend" element={<AdminBackend />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </PreferencesProvider>
            </AuthGate>
            </CookieGate>
          </TooltipProvider>
        </PlaidEnvironmentProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

export default App;
