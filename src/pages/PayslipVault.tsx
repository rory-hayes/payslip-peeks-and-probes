import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/layout/AppLayout';
import PayslipUpload from '@/components/PayslipUpload';
import { demoPayslips, formatCurrency, formatDate } from '@/lib/demo-data';
import { FileText, Search, AlertTriangle } from 'lucide-react';

const PayslipVault = () => {
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const filtered = demoPayslips.filter(
    (s) =>
      s.employer_name.toLowerCase().includes(search.toLowerCase()) ||
      s.pay_date.includes(search)
  );

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payslip Vault</h1>
            <p className="text-sm text-muted-foreground">{demoPayslips.length} payslips stored securely</p>
          </div>
        </div>

        <PayslipUpload onUploadComplete={() => setShowUpload(false)} />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by employer or date…" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No payslips found</h3>
              <p className="mt-2 text-sm text-muted-foreground">Try a different search or upload your first payslip.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.slice().reverse().map((slip) => (
              <Link key={slip.id} to={`/payslip/${slip.id}`}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{formatDate(slip.pay_date)}</p>
                        {slip.anomaly_count > 0 && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" /> {slip.anomaly_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{slip.employer_name} · {slip.file_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(slip.net_pay)}</p>
                      <p className="text-xs text-muted-foreground">Gross {formatCurrency(slip.gross_pay)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PayslipVault;
