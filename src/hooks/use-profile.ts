import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import type { CountryCode } from '@/lib/countries';

export interface UserProfile {
  country: CountryCode | null;
  currency: 'GBP' | 'EUR' | 'USD';
  annual_salary: number | null;
  first_name: string | null;
  employer_name: string | null;
  pay_frequency: string | null;
  has_pension: boolean;
  has_student_loan: boolean;
  pension_percent: number | null;
  student_loan_plan: string | null;
  onboarding_complete: boolean;
  payroll_email: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<UserProfile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('country, currency, annual_salary, first_name, employer_name, pay_frequency, has_pension, has_student_loan, pension_percent, student_loan_plan, onboarding_complete, payroll_email')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return {
        country: data.country as UserProfile['country'],
        currency: ((['EUR', 'USD'].includes(data.currency ?? '') ? data.currency : 'GBP') as UserProfile['currency']),
        annual_salary: data.annual_salary ? Number(data.annual_salary) : null,
        first_name: data.first_name,
        employer_name: data.employer_name,
        pay_frequency: data.pay_frequency,
        has_pension: !!data.has_pension,
        has_student_loan: !!data.has_student_loan,
        pension_percent: data.pension_percent ? Number(data.pension_percent) : null,
        student_loan_plan: data.student_loan_plan ?? null,
        onboarding_complete: !!data.onboarding_complete,
        payroll_email: data.payroll_email ?? null,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrency() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? 'GBP';
  const symbolMap = { GBP: '£', EUR: '€', USD: '$' } as const;
  const symbol = symbolMap[currency];
  // Locale per country so European number formatting (€1.234,56) works correctly
  const localeMap: Record<string, string> = {
    UK: 'en-GB',
    Ireland: 'en-IE',
    Germany: 'de-DE',
    France: 'fr-FR',
    Netherlands: 'nl-NL',
    Spain: 'es-ES',
    Italy: 'it-IT',
    Belgium: 'fr-BE',
    Portugal: 'pt-PT',
    US: 'en-US',
  };
  const defaultLocale = currency === 'USD' ? 'en-US' : currency === 'EUR' ? 'en-IE' : 'en-GB';
  const locale = localeMap[profile?.country ?? ''] ?? defaultLocale;

  const format = (amount: number) =>
    `${symbol}${amount.toLocaleString(locale, { minimumFractionDigits: 2 })}`;

  return { currency, symbol, locale, format };
}
