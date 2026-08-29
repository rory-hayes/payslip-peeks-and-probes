export type TaxReviewProgressCountry = 'Ireland' | 'UK';

export interface TaxReviewProgressEntry {
  country: TaxReviewProgressCountry;
  reviewedStepIds: string[];
  selectedTopicIds: string[];
  taxYearLabel: string;
}

export interface TaxReviewProgressReadResult {
  available: boolean;
  reviewedStepIds: string[];
  selectedTopicIds: string[];
}

export interface TaxReviewProgressStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface TaxReviewProgressDocument {
  reviews: TaxReviewProgressEntry[];
  version: 1;
}

const STORAGE_PREFIX = 'payslip-insights.tax-review.v1';
const MAX_DOCUMENT_LENGTH = 50_000;
const MAX_REVIEWS = 12;
const MAX_REVIEWED_STEPS = 20;
const MAX_STEP_ID_LENGTH = 100;
const MAX_TAX_YEAR_LABEL_LENGTH = 32;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}`;
}

function isCountry(value: unknown): value is TaxReviewProgressCountry {
  return value === 'Ireland' || value === 'UK';
}

function uniqueStepIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter((stepId): stepId is string => (
    typeof stepId === 'string'
    && stepId.length > 0
    && stepId.length <= MAX_STEP_ID_LENGTH
  )))].slice(0, MAX_REVIEWED_STEPS);
}

function normaliseEntry(value: unknown): TaxReviewProgressEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<TaxReviewProgressEntry>;
  if (!isCountry(candidate.country)) return null;
  if (
    typeof candidate.taxYearLabel !== 'string'
    || candidate.taxYearLabel.length === 0
    || candidate.taxYearLabel.length > MAX_TAX_YEAR_LABEL_LENGTH
  ) return null;

  return {
    country: candidate.country,
    reviewedStepIds: uniqueStepIds(candidate.reviewedStepIds),
    selectedTopicIds: uniqueStepIds(candidate.selectedTopicIds),
    taxYearLabel: candidate.taxYearLabel,
  };
}

function emptyDocument(): TaxReviewProgressDocument {
  return { reviews: [], version: 1 };
}

function readDocument(
  storage: TaxReviewProgressStorage | null,
  userId: string,
): { available: boolean; document: TaxReviewProgressDocument } {
  if (!storage || !userId) return { available: false, document: emptyDocument() };

  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return { available: true, document: emptyDocument() };
    if (raw.length > MAX_DOCUMENT_LENGTH) return { available: true, document: emptyDocument() };

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { available: true, document: emptyDocument() };
    const candidate = parsed as Partial<TaxReviewProgressDocument>;
    if (candidate.version !== 1 || !Array.isArray(candidate.reviews)) {
      return { available: true, document: emptyDocument() };
    }

    const reviews = candidate.reviews
      .map(normaliseEntry)
      .filter((entry): entry is TaxReviewProgressEntry => Boolean(entry))
      .slice(0, MAX_REVIEWS);

    return { available: true, document: { reviews, version: 1 } };
  } catch {
    return { available: false, document: emptyDocument() };
  }
}

export function browserTaxReviewProgressStorage(): TaxReviewProgressStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTaxReviewProgress(
  storage: TaxReviewProgressStorage | null,
  userId: string,
  country: TaxReviewProgressCountry,
  taxYearLabel: string,
  validStepIds: readonly string[],
  validTopicIds: readonly string[] = [],
): TaxReviewProgressReadResult {
  const { available, document } = readDocument(storage, userId);
  const review = document.reviews.find((entry) => (
    entry.country === country && entry.taxYearLabel === taxYearLabel
  ));
  const validSteps = new Set(validStepIds);
  const validTopics = new Set(validTopicIds);

  return {
    available,
    reviewedStepIds: (review?.reviewedStepIds ?? []).filter((stepId) => validSteps.has(stepId)),
    selectedTopicIds: (review?.selectedTopicIds ?? []).filter((topicId) => validTopics.has(topicId)),
  };
}

export function writeTaxReviewProgress(
  storage: TaxReviewProgressStorage | null,
  userId: string,
  country: TaxReviewProgressCountry,
  taxYearLabel: string,
  reviewedStepIds: readonly string[],
  validStepIds: readonly string[],
): boolean {
  const current = readDocument(storage, userId);
  if (!current.available || !storage) return false;

  const validSteps = new Set(validStepIds);
  const previousEntry = current.document.reviews.find((entry) => (
    entry.country === country && entry.taxYearLabel === taxYearLabel
  ));
  const nextEntry: TaxReviewProgressEntry = {
    country,
    reviewedStepIds: uniqueStepIds(reviewedStepIds).filter((stepId) => validSteps.has(stepId)),
    selectedTopicIds: previousEntry?.selectedTopicIds ?? [],
    taxYearLabel,
  };
  const nextReviews = current.document.reviews.filter((entry) => !(
    entry.country === country && entry.taxYearLabel === taxYearLabel
  ));
  nextReviews.push(nextEntry);

  try {
    storage.setItem(storageKey(userId), JSON.stringify({
      reviews: nextReviews.slice(-MAX_REVIEWS),
      version: 1,
    } satisfies TaxReviewProgressDocument));
    return true;
  } catch {
    return false;
  }
}

export function writeTaxReviewTopicSelection(
  storage: TaxReviewProgressStorage | null,
  userId: string,
  country: TaxReviewProgressCountry,
  taxYearLabel: string,
  selectedTopicIds: readonly string[],
  validTopicIds: readonly string[],
): boolean {
  const current = readDocument(storage, userId);
  if (!current.available || !storage) return false;

  const validTopics = new Set(validTopicIds);
  const previousEntry = current.document.reviews.find((entry) => (
    entry.country === country && entry.taxYearLabel === taxYearLabel
  ));
  const nextEntry: TaxReviewProgressEntry = {
    country,
    reviewedStepIds: previousEntry?.reviewedStepIds ?? [],
    selectedTopicIds: uniqueStepIds(selectedTopicIds).filter((topicId) => validTopics.has(topicId)),
    taxYearLabel,
  };
  const nextReviews = current.document.reviews.filter((entry) => !(
    entry.country === country && entry.taxYearLabel === taxYearLabel
  ));
  nextReviews.push(nextEntry);

  try {
    storage.setItem(storageKey(userId), JSON.stringify({
      reviews: nextReviews.slice(-MAX_REVIEWS),
      version: 1,
    } satisfies TaxReviewProgressDocument));
    return true;
  } catch {
    return false;
  }
}

export function exportTaxReviewProgress(
  storage: TaxReviewProgressStorage | null,
  userId: string,
): TaxReviewProgressEntry[] {
  return readDocument(storage, userId).document.reviews;
}

export function clearTaxReviewProgress(
  storage: TaxReviewProgressStorage | null,
  userId: string,
): boolean {
  if (!storage || !userId) return false;
  try {
    storage.removeItem(storageKey(userId));
    return true;
  } catch {
    return false;
  }
}
