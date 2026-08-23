import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { DemoProvider } from "@/contexts/DemoContext";
import DemoExitOnArrival from "@/components/DemoExitOnArrival";
import ScrollToTop from "@/components/ScrollToTop";
import CookieConsent from "@/components/CookieConsent";
import { initAnalytics } from "@/lib/analytics";
import AppErrorBoundary from "@/components/AppErrorBoundary";

const Landing = lazy(() => import("./pages/Landing"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Plan = lazy(() => import("./pages/Plan"));
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
// Keep account providers (and therefore the Supabase SDK, React Query and
// authenticated UI) out of the marketing entry path. React Router only
// renders these layouts for account routes, so a first visit to `/` can paint
// before the account runtime is requested.
const AccountRouteLayout = lazy(() => import("./components/AccountRouteLayout"));
const ProtectedRouteLayout = lazy(() => import("./components/ProtectedRouteLayout"));

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
  <AppErrorBoundary>
    <BrowserRouter>
      <DemoProvider>
        <DemoExitOnArrival />
        <ScrollToTop />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
              <Route path="/" element={<Landing />} />
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
              <Route element={<AccountRouteLayout />}>
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/sign-up" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route element={<ProtectedRouteLayout />}>
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/plan" element={<Plan />} />
                  <Route path="/vault" element={<PayslipVault />} />
                  <Route path="/payslip/:id" element={<PayslipDetail />} />
                  <Route path="/compare" element={<ComparePayslips />} />
                  <Route path="/anomalies" element={<Anomalies />} />
                  <Route path="/draft/:id" element={<DraftQuery />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/checkout/return" element={<CheckoutReturn />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <CookieConsent />
      </DemoProvider>
    </BrowserRouter>
  </AppErrorBoundary>
);

export default App;
