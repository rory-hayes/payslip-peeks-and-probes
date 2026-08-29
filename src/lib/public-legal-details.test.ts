import { describe, expect, it } from 'vitest';
import { publicLegalDetailsFrom, realPayslipAccessFrom } from './public-legal-details';

describe('public legal details', () => {
  it('is configured only when every public operator field is present', () => {
    expect(publicLegalDetailsFrom({
      VITE_LEGAL_OPERATOR_NAME: 'Example Operator',
      VITE_LEGAL_OPERATOR_ADDRESS: '1 Example Street, Dublin',
      VITE_LEGAL_GOVERNING_LAW: 'the laws of Ireland',
    })).toEqual({
      operatorName: 'Example Operator',
      operatorAddress: '1 Example Street, Dublin',
      governingLaw: 'the laws of Ireland',
      configured: true,
    });

    expect(publicLegalDetailsFrom({
      VITE_LEGAL_OPERATOR_NAME: 'Example Operator',
      VITE_LEGAL_OPERATOR_ADDRESS: ' ',
      VITE_LEGAL_GOVERNING_LAW: 'the laws of Ireland',
    }).configured).toBe(false);
  });

  it('trims public values and never turns an absent value into visible filler', () => {
    expect(publicLegalDetailsFrom({
      VITE_LEGAL_OPERATOR_NAME: '  Example Operator  ',
    })).toMatchObject({
      operatorName: 'Example Operator',
      operatorAddress: null,
      governingLaw: null,
      configured: false,
    });
  });

  it('requires an explicit production workflow switch as well as complete legal details', () => {
    const legalDetails = {
      VITE_LEGAL_OPERATOR_NAME: 'Example Operator',
      VITE_LEGAL_OPERATOR_ADDRESS: '1 Example Street, Dublin',
      VITE_LEGAL_GOVERNING_LAW: 'the laws of Ireland',
    };

    expect(realPayslipAccessFrom(legalDetails, true)).toBe(false);
    expect(realPayslipAccessFrom({
      ...legalDetails,
      VITE_CUSTOMER_WORKFLOWS_ENABLED: 'true',
    }, true)).toBe(true);
    expect(realPayslipAccessFrom({ VITE_CUSTOMER_WORKFLOWS_ENABLED: 'true' }, true)).toBe(false);
    expect(realPayslipAccessFrom({}, false)).toBe(true);
  });
});
