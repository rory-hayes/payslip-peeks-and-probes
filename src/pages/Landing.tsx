import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemo } from '@/contexts/DemoContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Eye,
  FileCheck,
  MessageSquare,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import payslipCheckHero from '@/assets/option-one-payslip-check-hero-v1.webp';
import payslipMark from '@/assets/payslip-insights-mark.webp';
import aquaCorner from '@/assets/option-one-aqua-corner-v2.webp';
import './Landing.css';

const STEPS = [
  {
    icon: Upload,
    number: '01',
    title: 'Upload your payslip',
    description: 'Add a PDF or photo, then review the figures we find before you confirm anything.',
  },
  {
    icon: Eye,
    number: '02',
    title: 'See what changed',
    description: 'Compare this payday with the last one and bring changes worth checking into focus.',
  },
  {
    icon: MessageSquare,
    number: '03',
    title: 'Take the next step',
    description: 'Keep a clear history and prepare a message for payroll when you need one.',
  },
] as const;

const FEATURES = [
  {
    icon: FileCheck,
    title: 'Review before you rely on it',
    description: 'Check and edit extracted figures before a payslip becomes part of your history.',
  },
  {
    icon: TrendingUp,
    title: 'Track your pay over time',
    description: 'Follow net pay, tax, and deductions from one confirmed payslip to the next.',
  },
  {
    icon: AlertTriangle,
    title: 'Notice unexpected changes',
    description: 'Bring changes such as a new deduction or a tax jump into one clear review.',
  },
  {
    icon: BarChart3,
    title: 'Compare without the spreadsheet',
    description: 'See two confirmed payslips side by side when you want a closer look.',
  },
] as const;

const FREE_FEATURES = [
  '3 automatic payslip checks per Dublin calendar month',
  'Checks for changes worth reviewing',
  'Payslip comparison and history',
  '2 payroll-message drafts per Dublin calendar month',
] as const;

const PLUS_FEATURES = [
  'Automatic payslip checks beyond the Free plan allowance',
  'Payroll-message drafts beyond the Free plan allowance',
  'Review, track, and compare confirmed payslips',
  'PDF export of your payslip history',
] as const;

const FAQ_ITEMS = [
  {
    question: 'Is Payslip Insights tax advice?',
    answer: 'No. Payslip Insights is a payslip review and planning tool. It can flag changes worth checking, but it does not provide formal tax, legal, or payroll advice. Always confirm a concern with your employer or a qualified professional.',
  },
  {
    question: 'How is my payslip data handled?',
    answer: 'We use your payslip to provide review, tracking, and planning features. We may use service providers for hosting and document extraction. Read the Privacy Policy before uploading for the current details.',
  },
  {
    question: 'Which payslip formats do you support?',
    answer: "We support PDF payslips and photos/images of payslips. We're continually improving our extraction engine to handle more formats.",
  },
  {
    question: 'Which countries does Payslip Insights support?',
    answer: 'Payslip Insights is currently focused on employees paid in the UK and Ireland. You should still review every extracted figure and raise any question with your payroll team.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: "Yes. You can cancel your Plus subscription at any time. You'll keep access until the end of your current billing period.",
  },
  {
    question: 'What if the extraction gets something wrong?',
    answer: 'You can review and edit extracted values before confirming. If a figure is missing or does not match your original payslip, correct it or leave it blank before you save.',
  },
] as const;

const Landing = () => {
  const navigate = useNavigate();
  const { enableDemo } = useDemo();
  const { user, loading } = useAuth();

  // If a logged-in user lands here (e.g. after OAuth callback), send them to the app.
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleTryDemo = () => {
    enableDemo();
    navigate('/dashboard');
  };

  return (
    <div className="pi-landing">
      <header className="pi-landing__nav-wrap">
        <nav className="pi-landing__nav" aria-label="Primary navigation">
          <Link to="/" className="pi-landing__brand" aria-label="Payslip Insights home">
            <img src={payslipMark} alt="" className="pi-landing__brand-mark" />
            <span>payslip insights</span>
          </Link>

          <div className="pi-landing__nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <Link to="/guides">Guides</Link>
          </div>

          <div className="pi-landing__nav-actions">
            <Link to="/sign-in" className="pi-landing__sign-in">Sign in</Link>
            <Link to="/sign-up" className="pi-landing__button pi-landing__button--small">Get started</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="pi-landing__hero">
          <img src={aquaCorner} alt="" className="pi-landing__aqua-corner" aria-hidden="true" />
          <div className="pi-landing__container pi-landing__hero-grid">
            <div className="pi-landing__hero-copy">
              <h1>Your payday, clear.</h1>
              <p>
                Upload your payslip, spot changes worth checking, and plan to your next payday. Clear figures and a calmer next step.
              </p>
              <div className="pi-landing__hero-actions">
                <Link to="/sign-up" className="pi-landing__button">
                  Check a payslip <ArrowRight aria-hidden="true" />
                </Link>
                <button type="button" className="pi-landing__secondary-action" onClick={handleTryDemo}>
                  Try the demo <ArrowRight aria-hidden="true" />
                </button>
              </div>
              <div className="pi-landing__hero-notes" aria-label="Product highlights">
                <span><Check aria-hidden="true" /> Review every extracted figure</span>
                <span><Check aria-hidden="true" /> UK &amp; Ireland focused</span>
              </div>
            </div>

            <div className="pi-landing__hero-art-wrap">
              <img
                src={payslipCheckHero}
                alt="Illustration of a payslip being checked"
                className="pi-landing__hero-art"
                width={1201}
                height={1309}
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="pi-landing__section pi-landing__steps-section">
          <div className="pi-landing__container">
            <div className="pi-landing__section-heading pi-landing__section-heading--split">
              <h2>Three small steps.<br />One clearer payday.</h2>
              <p>Everything starts with the payslip you already have. You stay in control of what gets confirmed.</p>
            </div>
            <div className="pi-landing__steps">
              {STEPS.map(({ icon: Icon, number, title, description }) => (
                <article className="pi-landing__step" key={number}>
                  <div className="pi-landing__step-topline">
                    <span>{number}</span>
                    <Icon aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="pi-landing__feature-band">
          <div className="pi-landing__container pi-landing__feature-grid">
            <div className="pi-landing__feature-intro">
              <h2>Built around the moment your pay lands.</h2>
              <p>Not another generic budgeting dashboard. A simple place to understand what changed and decide what to do next.</p>
              <Link to="/calculator" className="pi-landing__text-link">
                Try the take-home calculator <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div className="pi-landing__feature-list">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <article className="pi-landing__feature" key={title}>
                  <div className="pi-landing__feature-icon"><Icon aria-hidden="true" /></div>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pi-landing__section pi-landing__countries">
          <div className="pi-landing__container pi-landing__country-grid">
            <div className="pi-landing__country-copy">
              <h2>Made for the payslips you actually receive.</h2>
              <p>
                Payslip conventions differ across the UK and Ireland. Payslip Insights focuses on the figures and deductions employees commonly need to review.
              </p>
            </div>
            <div className="pi-landing__country-list" aria-label="Supported countries">
              <article>
                <span>UK</span>
                <div>
                  <h3>United Kingdom</h3>
                  <p>Income Tax, NI, student loans</p>
                </div>
                <ChevronRight aria-hidden="true" />
              </article>
              <article>
                <span>IE</span>
                <div>
                  <h3>Ireland</h3>
                  <p>PAYE, PRSI, USC</p>
                </div>
                <ChevronRight aria-hidden="true" />
              </article>
            </div>
          </div>
        </section>

        <section id="pricing" className="pi-landing__section pi-landing__pricing-section">
          <div className="pi-landing__container">
            <div className="pi-landing__section-heading pi-landing__section-heading--center">
              <h2>Simple, transparent pricing.</h2>
              <p>Start free. Upgrade when you need more.</p>
            </div>

            <div className="pi-landing__pricing-grid">
              <article className="pi-landing__price-card">
                <div>
                  <h3>Free</h3>
                  <p className="pi-landing__price"><strong>€0</strong><span>/month</span></p>
                  <p className="pi-landing__price-intro">Great for getting started.</p>
                </div>
                <ul>
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature}><Check aria-hidden="true" />{feature}</li>
                  ))}
                </ul>
                <Link to="/sign-up" className="pi-landing__outline-button">Get started free</Link>
              </article>

              <article className="pi-landing__price-card pi-landing__price-card--plus">
                <div>
                  <h3>Plus</h3>
                  <p className="pi-landing__price"><strong>€19.99</strong><span>/year</span></p>
                  <p className="pi-landing__price-intro">More automatic checks and payroll-message drafts when you need them.</p>
                </div>
                <ul>
                  {PLUS_FEATURES.map((feature) => (
                    <li key={feature}><Check aria-hidden="true" />{feature}</li>
                  ))}
                </ul>
                <Link to="/sign-up" className="pi-landing__button">Choose Plus <ArrowRight aria-hidden="true" /></Link>
              </article>
            </div>
            <div className="pi-landing__pricing-link-wrap">
              <Link to="/pricing" className="pi-landing__text-link">View full pricing comparison <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        </section>

        <section id="faq" className="pi-landing__section pi-landing__faq-section">
          <div className="pi-landing__container pi-landing__faq-grid">
            <div>
              <h2>Good questions.<br />Straight answers.</h2>
              <p>We want you to understand what the app can help with before you upload anything.</p>
              <Link to="/privacy" className="pi-landing__text-link">Read the Privacy Policy <ArrowRight aria-hidden="true" /></Link>
            </div>
            <Accordion type="single" collapsible className="pi-landing__faq-list">
              {FAQ_ITEMS.map(({ question, answer }, index) => (
                <AccordionItem key={question} value={`faq-${index}`}>
                  <AccordionTrigger>{question}</AccordionTrigger>
                  <AccordionContent>{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="pi-landing__closing-section">
          <div className="pi-landing__container">
            <div className="pi-landing__closing-panel">
              <div>
                <h2>Ready to check your payslips?</h2>
                <p>Upload a payslip, understand what changed, and make a simple plan to your next payday.</p>
              </div>
              <Link to="/sign-up" className="pi-landing__button pi-landing__button--light">
                Get started for free <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="pi-landing__footer">
        <div className="pi-landing__container pi-landing__footer-inner">
          <Link to="/" className="pi-landing__brand" aria-label="Payslip Insights home">
            <img src={payslipMark} alt="" className="pi-landing__brand-mark" />
            <span>payslip insights</span>
          </Link>
          <div className="pi-landing__footer-links">
            <Link to="/pricing">Pricing</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:support@payslipinsights.com">Contact</a>
          </div>
          <p>© 2026 Payslip Insights. Not tax or legal advice.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
