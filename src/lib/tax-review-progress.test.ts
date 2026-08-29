import { describe, expect, it } from 'vitest';
import {
  clearTaxReviewProgress,
  exportTaxReviewProgress,
  readTaxReviewProgress,
  writeTaxReviewProgress,
  writeTaxReviewTopicSelection,
  type TaxReviewProgressStorage,
} from './tax-review-progress';

function memoryStorage(): TaxReviewProgressStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('tax review progress', () => {
  it('keeps reviewed steps separate by account, country, and tax year', () => {
    const storage = memoryStorage();
    const validSteps = ['gather', 'official-account', 'outcome'];

    expect(writeTaxReviewProgress(storage, 'user-1', 'UK', '2025/26', ['gather'], validSteps)).toBe(true);
    expect(writeTaxReviewProgress(storage, 'user-1', 'Ireland', '2025', ['official-account'], validSteps)).toBe(true);

    expect(readTaxReviewProgress(storage, 'user-1', 'UK', '2025/26', validSteps).reviewedStepIds).toEqual(['gather']);
    expect(readTaxReviewProgress(storage, 'user-1', 'Ireland', '2025', validSteps).reviewedStepIds).toEqual(['official-account']);
    expect(readTaxReviewProgress(storage, 'user-2', 'UK', '2025/26', validSteps).reviewedStepIds).toEqual([]);
  });

  it('drops unknown and duplicated step ids before reading or exporting progress', () => {
    const storage = memoryStorage();
    const validSteps = ['gather', 'outcome'];

    writeTaxReviewProgress(storage, 'user-1', 'UK', '2025/26', ['gather', 'unknown', 'gather'], validSteps);

    expect(readTaxReviewProgress(storage, 'user-1', 'UK', '2025/26', validSteps).reviewedStepIds).toEqual(['gather']);
    expect(exportTaxReviewProgress(storage, 'user-1')).toEqual([{
      country: 'UK',
      reviewedStepIds: ['gather'],
      selectedTopicIds: [],
      taxYearLabel: '2025/26',
    }]);
  });

  it('preserves checklist steps and selected review topics when either changes', () => {
    const storage = memoryStorage();

    expect(writeTaxReviewTopicSelection(
      storage,
      'user-1',
      'UK',
      '2025/26',
      ['uk-pension', 'unknown'],
      ['uk-pension', 'uk-gift-aid'],
    )).toBe(true);
    expect(writeTaxReviewProgress(storage, 'user-1', 'UK', '2025/26', ['gather'], ['gather'])).toBe(true);

    expect(readTaxReviewProgress(
      storage,
      'user-1',
      'UK',
      '2025/26',
      ['gather'],
      ['uk-pension', 'uk-gift-aid'],
    )).toEqual({
      available: true,
      reviewedStepIds: ['gather'],
      selectedTopicIds: ['uk-pension'],
    });

    expect(writeTaxReviewTopicSelection(
      storage,
      'user-1',
      'UK',
      '2025/26',
      ['uk-gift-aid'],
      ['uk-pension', 'uk-gift-aid'],
    )).toBe(true);
    expect(readTaxReviewProgress(
      storage,
      'user-1',
      'UK',
      '2025/26',
      ['gather'],
      ['uk-pension', 'uk-gift-aid'],
    )).toEqual({
      available: true,
      reviewedStepIds: ['gather'],
      selectedTopicIds: ['uk-gift-aid'],
    });
  });

  it('fails safely when browser storage is unavailable and clears one account only', () => {
    const storage = memoryStorage();
    writeTaxReviewProgress(storage, 'user-1', 'UK', '2025/26', ['gather'], ['gather']);
    writeTaxReviewProgress(storage, 'user-2', 'UK', '2025/26', ['gather'], ['gather']);

    expect(clearTaxReviewProgress(storage, 'user-1')).toBe(true);
    expect(exportTaxReviewProgress(storage, 'user-1')).toEqual([]);
    expect(exportTaxReviewProgress(storage, 'user-2')).toHaveLength(1);
    expect(readTaxReviewProgress(null, 'user-1', 'UK', '2025/26', ['gather'])).toEqual({
      available: false,
      reviewedStepIds: [],
      selectedTopicIds: [],
    });
    expect(writeTaxReviewProgress(null, 'user-1', 'UK', '2025/26', ['gather'], ['gather'])).toBe(false);
  });
});
