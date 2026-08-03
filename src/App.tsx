import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import DemoExitOnArrival from "@/components/DemoExitOnArrival";
import ProtectedRoute from "@/components/ProtectedRoute";
import CookieConsent from "@/components/CookieConsent";
import { initAnalytics } from "@/lib/analytics";

const queryClient = new QueryClient();

const Landing = lazy(() => import("./pages/Landing"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PayslipVault = lazy(() => import("./pages/PayslipVault"));
const PayslipDetail = lazy(() => import("./pages/PayslipDetail"));
const ComparePayslips = lazy(() => import("./pages/ComparePayslips"));
const Anomalies = lazy(() => import("./pages/Anomalies"));
const DraftQuery = lazy(() => import("./pages/DraftQuery"));
const Settings = lazy(() => import("./pages/Settings"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GuidesIndex = lazy(() => import("./pages/guides/GuidesIndex"));
const HowToCheckPayslip = lazy(() => import("./pages/guides/HowToCheckPayslip"));
const WhyNetPayDown = lazy(() => import("./pages/guides/WhyNetPayDown"));
const CommonMistakes = lazy(() => import("./pages/guides/CommonMistakes"));
const ComparePayslipsGuide = lazy(() => import("./pages/guides/ComparePayslips"));
const UkPayslipGuide = lazy(() => import("./pages/guides/UkPayslipGuide"));
const IrelandPayslipGuide = lazy(() => import("./pages/guides/IrelandPayslipGuide"));
const CalculatorIndex = lazy(() => import("./pages/calculator/CalculatorIndex"));
const CountryCalculator = lazy(() => import("./pages/calculator/CountryCalculator"));

const RouteLoadingFallback = () => (
  <main
    aria-busy="true"
    aria-live="polite"
    className="flex min-h-[12rem] items-center justify-center px-6 text-sm text-muted-foreground"
  >
    <span role="status">Loading page…</span>
  </main>
);

// Initialise the consent-aware analytics layer once at app boot.
// No provider is wired yet — calls remain no-ops until one is configured
// in src/lib/analytics.ts AND the user clicks "Accept all".
initAnalytics();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DemoProvider>
        <DemoExitOnArrival />
        <AuthProvider>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/sign-up" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/vault" element={<ProtectedRoute><PayslipVault /></ProtectedRoute>} />
              <Route path="/payslip/:id" element={<ProtectedRoute><PayslipDetail /></ProtectedRoute>} />
              <Route path="/compare" element={<ProtectedRoute><ComparePayslips /></ProtectedRoute>} />
              <Route path="/anomalies" element={<ProtectedRoute><Anomalies /></ProtectedRoute>} />
              <Route path="/draft/:id" element={<ProtectedRoute><DraftQuery /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/guides" element={<GuidesIndex />} />
              <Route path="/guides/how-to-check-your-payslip" element={<HowToCheckPayslip />} />
              <Route path="/guides/why-did-my-net-pay-go-down" element={<WhyNetPayDown />} />
              <Route path="/guides/common-payslip-mistakes" element={<CommonMistakes />} />
              <Route path="/guides/compare-two-payslips" element={<ComparePayslipsGuide />} />
              <Route path="/guides/uk-payslip-guide" element={<UkPayslipGuide />} />
              <Route path="/guides/ireland-payslip-guide" element={<IrelandPayslipGuide />} />
              <Route path="/calculator" element={<CalculatorIndex />} />
              <Route path="/calculator/:country" element={<CountryCalculator />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CookieConsent />
        </AuthProvider>
        </DemoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
