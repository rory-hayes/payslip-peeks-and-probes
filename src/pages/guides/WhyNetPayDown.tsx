import GuideLayout from '@/components/guides/GuideLayout';
import GuideCTA from '@/components/guides/GuideCTA';

const WhyNetPayDown = () => (
  <GuideLayout
    title="Why Did My Net Pay Go Down?"
    description="The common reasons your take-home pay changes month to month, when it's normal, and when it's worth checking."
    breadcrumbLabel="Why Did My Net Pay Go Down?"
  >
    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Why Did My Net Pay Go Down?</h1>
    <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
      A drop in take-home pay can feel alarming, but it usually has a simple explanation. Here's how to work out which one applies to you — and when to dig deeper.
    </p>

    <h2 className="mt-12 text-2xl font-bold text-foreground">Common reasons your take-home pay changes</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li><strong className="text-foreground">Higher tax</strong> — a new tax code, end of an emergency code, or moving into a higher band.</li>
      <li><strong className="text-foreground">Pension changes</strong> — you (or your employer) increased the contribution percentage.</li>
      <li><strong className="text-foreground">Bonus effects</strong> — a bonus paid earlier in the year can push tax up the following month.</li>
      <li><strong className="text-foreground">Unpaid leave</strong> — even a single day of unpaid absence reduces gross pay.</li>
      <li><strong className="text-foreground">New deductions</strong> — season ticket loans, union fees, or salary sacrifice schemes starting up.</li>
      <li><strong className="text-foreground">Student loan</strong> — repayments kick in once you cross the threshold.</li>
    </ul>

    <h2 className="mt-10 text-2xl font-bold text-foreground">When the change is normal</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      If gross pay is the same but a deduction is slightly higher, that's usually a tax code or pension adjustment. After a bonus month, tax often takes a bigger bite the following payslip — that's the system catching up, not an error.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">When it might be worth checking</h2>
    <p className="mt-3 text-muted-foreground leading-relaxed">
      Raise it with payroll if your gross pay hasn't changed but tax has jumped sharply, your pension percentage looks different from your contract, or there's a deduction line you don't recognise.
    </p>

    <h2 className="mt-10 text-2xl font-bold text-foreground">What to compare with last month's payslip</h2>
    <ul className="mt-3 list-disc pl-6 space-y-1.5 text-muted-foreground">
      <li>Gross pay — identical, higher, or lower?</li>
      <li>Tax code — has it changed?</li>
      <li>Pension — same percentage as before?</li>
      <li>Deductions — anything new?</li>
      <li>Hours or days worked — any unpaid leave or sickness?</li>
    </ul>

    <GuideCTA />
  </GuideLayout>
);

export default WhyNetPayDown;
