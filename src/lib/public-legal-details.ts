type PublicLegalEnvironment = Partial<Record<
  | 'VITE_LEGAL_OPERATOR_NAME'
  | 'VITE_LEGAL_OPERATOR_ADDRESS'
  | 'VITE_LEGAL_GOVERNING_LAW'
  | 'VITE_CUSTOMER_WORKFLOWS_ENABLED',
  string
>>;

export interface PublicLegalDetails {
  operatorName: string | null;
  operatorAddress: string | null;
  governingLaw: string | null;
  configured: boolean;
}

function clean(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function publicLegalDetailsFrom(environment: PublicLegalEnvironment): PublicLegalDetails {
  const operatorName = clean(environment.VITE_LEGAL_OPERATOR_NAME);
  const operatorAddress = clean(environment.VITE_LEGAL_OPERATOR_ADDRESS);
  const governingLaw = clean(environment.VITE_LEGAL_GOVERNING_LAW);

  return {
    operatorName,
    operatorAddress,
    governingLaw,
    configured: Boolean(operatorName && operatorAddress && governingLaw),
  };
}

export const publicLegalDetails = publicLegalDetailsFrom(import.meta.env);

export function realPayslipAccessFrom(environment: PublicLegalEnvironment, isProduction: boolean): boolean {
  if (!isProduction) return true;
  return publicLegalDetailsFrom(environment).configured
    && environment.VITE_CUSTOMER_WORKFLOWS_ENABLED?.trim().toLowerCase() === 'true';
}

// Development and automated tests remain usable. Production needs both its
// public operator details and a separate, deliberate release switch that is
// enabled only after backend and real-account proof has passed.
export const acceptsRealPayslips = realPayslipAccessFrom(import.meta.env, import.meta.env.PROD);
