type PublicLegalEnvironment = Partial<Record<
  | 'VITE_LEGAL_OPERATOR_NAME'
  | 'VITE_LEGAL_OPERATOR_ADDRESS'
  | 'VITE_LEGAL_GOVERNING_LAW',
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

// Development and automated tests must remain usable, but an accidentally
// published production bundle fails closed before accepting a real payslip.
export const acceptsRealPayslips = !import.meta.env.PROD || publicLegalDetails.configured;
