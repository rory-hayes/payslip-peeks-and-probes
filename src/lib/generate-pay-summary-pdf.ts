import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Payslip } from '@/lib/types';
import { calculateExpectedMonthly, type DeductionOptions } from '@/lib/tax-calculator';
import type { CountryCode } from '@/lib/countries';
import { getCountryConfig } from '@/lib/countries';

interface PdfOptions {
  payslips: Payslip[];
  currency: 'GBP' | 'EUR' | 'USD';
  country: CountryCode | null;
  annualSalary?: number | null;
  deductionOpts?: DeductionOptions;
  firstName?: string | null;
}

function fmt(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generatePaySummaryPdf(options: PdfOptions) {
  const { payslips, currency, country, annualSalary, deductionOpts = {}, firstName } = options;
  const symbolMap = { GBP: '£', EUR: '€', USD: '$' } as const;
  const sym = symbolMap[currency];
  const regionLabel = getCountryConfig(country).name;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;

  // ── Header ──
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Pay Summary', margin, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const generatedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Generated ${generatedDate}${firstName ? ` for ${firstName}` : ''} • ${regionLabel}`, margin, 26);

  let y = 46;

  // ── Stats row ──
  const sorted = [...payslips].sort((a, b) => a.pay_date.localeCompare(b.pay_date));
  const totalGross = sorted.reduce((s, p) => s + p.gross_pay, 0);
  const totalNet = sorted.reduce((s, p) => s + p.net_pay, 0);
  const totalTax = sorted.reduce((s, p) => s + p.tax_amount, 0);
  const totalDeductions = sorted.reduce((s, p) => s + p.total_deductions, 0);

  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(9);
  doc.text('TOTAL GROSS', margin, y);
  doc.text('TOTAL NET', margin + 45, y);
  doc.text('TOTAL TAX', margin + 90, y);
  doc.text('TOTAL DEDUCTIONS', margin + 135, y);
  y += 5;
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(totalGross, sym), margin, y);
  doc.text(fmt(totalNet, sym), margin + 45, y);
  doc.text(fmt(totalTax, sym), margin + 90, y);
  doc.text(fmt(totalDeductions, sym), margin + 135, y);
  y += 10;

  // ── Divider ──
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Monthly breakdown table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Monthly Breakdown', margin, y);
  y += 6;

  const isIreland = country === 'Ireland';

  const head = isIreland
    ? [['Month', 'Gross', 'Tax', 'PRSI', 'USC', 'Pension', 'Net']]
    : [['Month', 'Gross', 'Tax', 'NI', 'Pension', 'Student Loan', 'Net']];

  const body = sorted.map((slip) => {
    const monthLabel = new Date(slip.pay_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    if (isIreland) {
      return [
        monthLabel,
        fmt(slip.gross_pay, sym),
        fmt(slip.tax_amount, sym),
        fmt(slip.prsi_amount ?? 0, sym),
        fmt(slip.usc_amount ?? 0, sym),
        fmt(slip.pension_amount ?? 0, sym),
        fmt(slip.net_pay, sym),
      ];
    }
    return [
      monthLabel,
      fmt(slip.gross_pay, sym),
      fmt(slip.tax_amount, sym),
      fmt(slip.ni_amount ?? 0, sym),
      fmt(slip.pension_amount ?? 0, sym),
      fmt(slip.student_loan_amount ?? 0, sym),
      fmt(slip.net_pay, sym),
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [51, 65, 85], // slate-700
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { cellWidth: 28 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Expected vs Actual section ──
  if (annualSalary && annualSalary > 0 && sorted.length > 0) {
    const expected = calculateExpectedMonthly(annualSalary, country, deductionOpts);

    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Expected vs Actual (Latest Month)', margin, y);
    y += 6;

    const latestSlip = sorted[sorted.length - 1];
    const compRows = [
      ['Gross pay', fmt(expected.grossMonthly, sym), fmt(latestSlip.gross_pay, sym), fmt(latestSlip.gross_pay - expected.grossMonthly, sym)],
      ['Income tax', fmt(expected.incomeTax, sym), fmt(latestSlip.tax_amount, sym), fmt(latestSlip.tax_amount - expected.incomeTax, sym)],
    ];

    if (isIreland) {
      compRows.push(['PRSI', fmt(expected.nationalInsurance, sym), fmt(latestSlip.prsi_amount ?? 0, sym), fmt((latestSlip.prsi_amount ?? 0) - expected.nationalInsurance, sym)]);
      compRows.push(['USC', fmt(expected.usc, sym), fmt(latestSlip.usc_amount ?? 0, sym), fmt((latestSlip.usc_amount ?? 0) - expected.usc, sym)]);
    } else {
      compRows.push(['National Insurance', fmt(expected.nationalInsurance, sym), fmt(latestSlip.ni_amount ?? 0, sym), fmt((latestSlip.ni_amount ?? 0) - expected.nationalInsurance, sym)]);
    }

    if (expected.pension > 0) {
      compRows.push(['Pension', fmt(expected.pension, sym), fmt(latestSlip.pension_amount ?? 0, sym), fmt((latestSlip.pension_amount ?? 0) - expected.pension, sym)]);
    }
    if (expected.studentLoan > 0) {
      compRows.push(['Student loan', fmt(expected.studentLoan, sym), fmt(latestSlip.student_loan_amount ?? 0, sym), fmt((latestSlip.student_loan_amount ?? 0) - expected.studentLoan, sym)]);
    }
    compRows.push(['Net pay', fmt(expected.netPay, sym), fmt(latestSlip.net_pay, sym), fmt(latestSlip.net_pay - expected.netPay, sym)]);

    autoTable(doc, {
      startY: y,
      head: [['', 'Expected', 'Actual', 'Difference']],
      body: compRows,
      theme: 'grid',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  // ── Footer ──
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'PayCheck — This report is for informational purposes only. Not formal tax or payroll advice.',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  // Download
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`pay-summary-${dateStr}.pdf`);
}
