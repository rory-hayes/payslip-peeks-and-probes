import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  country: 'UK' | 'Ireland' | null;
  currency: 'GBP' | 'EUR';
  annual_salary: number | null;
  first_name: string | null;
  employer_name: string | null;
  pay_frequency: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<UserProfile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('country, currency, annual_salary, first_name, employer_name, pay_frequency')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return {
        country: data.country as UserProfile['country'],
        currency: (data.currency === 'EUR' ? 'EUR' : 'GBP') as UserProfile['currency'],
        annual_salary: data.annual_salary ? Number(data.annual_salary) : null,
        first_name: data.first_name,
        employer_name: data.employer_name,
        pay_frequency: data.pay_frequency,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrency() {
  const { data: profile } = useProfile();
  const currency = profile?.currency ?? 'GBP';
  const symbol = currency === 'EUR' ? '€' : '£';
  const locale = currency === 'EUR' ? 'en-IE' : 'en-GB';

  const format = (amount: number) =>
    `${symbol}${amount.toLocaleString(locale, { minimumFractionDigits: 2 })}`;

  return { currency, symbol, locale, format };
}
