import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/components/layout/AppLayout';
import PayslipUpload from '@/components/PayslipUpload';
import { usePayslips } from '@/hooks/use-payslip-data';
import { useCurrency } from '@/hooks/use-profile';
import { formatDate } from '@/lib/date-utils';
import { AlertTriangle, ChevronRight, FileText, Search } from 'lucide-react';
import aquaCorner from '@/assets/option-one-aqua-corner-v2.webp';
import payslipCheckHero from '@/assets/option-one-payslip-check-hero-v1.webp';

const PayslipVault = () => {
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const { data: payslips, isLoading } = usePayslips();
  const { format: formatCurrency } = useCurrency();
  const reviewId = searchParams.get('review');

  const allPayslips = payslips || [];
  const filtered = allPayslips.filter(
    (slip) =>
      slip.employer_name.toLowerCase().includes(search.toLowerCase()) ||
      slip.pay_date.includes(search),
  );

  return (
    <AppLayout>
      <div className="pi-vault-page">
        <img alt="" aria-hidden="true" className="pi-page-aqua-corner" src={aquaCorner} />

        <section className="pi-vault-intro" aria-labelledby="pay-check-heading">
          <div className="pi-vault-copy">
            <p className="pi-eyebrow">Pay check</p>
            <h1 id="pay-check-heading">Check the details.</h1>
            <p>
              Upload a payslip, then review the figures before you save it. We’ll point out changes worth a closer look—never make a payroll decision for you.
            </p>
          </div>
          <img alt="" aria-hidden="true" className="pi-vault-hero-art" src={payslipCheckHero} />
        </section>

        <section className="pi-vault-upload" aria-label="Upload a payslip">
          <PayslipUpload onUploadComplete={() => {}} resumeReviewId={reviewId} />
        </section>

        <section className="pi-vault-library" aria-labelledby="saved-payslips-heading">
          <div className="pi-vault-library-heading">
            <div>
              <p className="pi-eyebrow">Your history</p>
              <h2 id="saved-payslips-heading">Saved payslips</h2>
              <p>{allPayslips.length} payslip{allPayslips.length !== 1 ? 's' : ''} in your account</p>
            </div>
          </div>

          <label className="pi-vault-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search your saved payslips</span>
            <Input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by employer or date"
              value={search}
            />
          </label>

          {isLoading ? (
            <div className="pi-vault-list" aria-label="Loading payslips">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="pi-vault-row pi-vault-row--loading" key={index}>
                  <Skeleton className="h-12 w-12 rounded-[16px]" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="pi-vault-empty">
              <div className="pi-vault-empty-icon"><FileText aria-hidden="true" /></div>
              <h3>{allPayslips.length === 0 ? 'Your first pay check starts here.' : 'No payslips match that search.'}</h3>
              <p>{allPayslips.length === 0 ? 'Upload a PDF or image above. You’ll see the extracted figures before anything is confirmed.' : 'Try a different employer name or pay date.'}</p>
            </div>
          ) : (
            <div className="pi-vault-list">
              {filtered.slice().reverse().map((slip) => (
                <Link className="pi-vault-row" key={slip.id} to={slip.status === 'extracted' ? `/vault?review=${encodeURIComponent(slip.id)}` : `/payslip/${slip.id}`}>
                  <div className="pi-vault-file-icon"><FileText aria-hidden="true" /></div>
                  <div className="pi-vault-row-copy">
                    <div className="pi-vault-row-title">
                      <strong>{slip.pay_date ? formatDate(slip.pay_date) : 'Payslip ready to review'}</strong>
                      {slip.status === 'extracted' ? <span className="pi-vault-review-ready">Ready to review</span> : null}
                      {slip.anomaly_count > 0 ? (
                        <span className="pi-vault-alert"><AlertTriangle aria-hidden="true" /> {slip.anomaly_count} to check</span>
                      ) : null}
                    </div>
                    <p>{slip.status === 'extracted' ? 'Check the extracted figures before you confirm this payslip.' : slip.employer_name}</p>
                  </div>
                  <div className="pi-vault-row-amount">
                    {slip.status === 'extracted' ? <><strong>Review</strong><span>Before you plan</span></> : <><strong>{formatCurrency(slip.net_pay)}</strong><span>Net pay</span></>}
                  </div>
                  <ChevronRight aria-hidden="true" className="pi-vault-chevron" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

export default PayslipVault;
