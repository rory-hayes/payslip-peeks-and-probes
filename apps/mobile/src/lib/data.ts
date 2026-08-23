import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';
import { findPreviousSameCountryConfirmedPayslip } from './pay-history';
import { supabase } from './supabase';
import { validatePaydayCheckIn } from './payday-check-in';
import type {
  CurrencyCode,
  ConfirmedPayslip,
  MobileDashboardData,
  PaydayPlan,
  Payslip,
  PayslipAnomaly,
  PayslipExtraction,
  PlanAllocation,
  Profile,
  RecurringBill,
  SavingsGoal,
} from '../types/models';

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface PickedPayslipFile {
  uri: string;
  name: string;
  mimeType: string | null | undefined;
  size: number | null | undefined;
  webFile?: unknown;
}

export interface PlanInput {
  payslipId: string | null;
  payDate: string;
  nextPayday: string;
  currency: CurrencyCode;
  netPay: number;
  essentialBills: number;
  everydaySpending: number;
  buffer: number;
}

export interface PaydayCheckInInput {
  planId: string;
  plannedEveryday: number;
  everydayRemaining: number;
}

export interface ReviewInput {
  payslipId: string;
  country?: 'UK' | 'Ireland' | null;
  payDate: string;
  grossPay: number;
  netPay: number;
  taxAmount: number | null;
  nationalInsuranceAmount: number | null;
  prsiAmount: number | null;
  uscAmount: number | null;
  pensionAmount: number | null;
  totalDeductions: number | null;
}

export interface UploadResult {
  payslipId: string;
  status: 'completed' | 'needs_review' | 'processing' | 'failed';
  failureCode?: string | null;
}

export interface ProfileSetupInput {
  country: 'UK' | 'Ireland';
  payFrequency: 'weekly' | 'fortnightly' | 'monthly' | 'other';
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asOne<T>(value: unknown): T | null {
  return value && typeof value === 'object' ? value as T : null;
}

function fileExtensionMimeType(name: string): string | null {
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return null;
}

interface IssuedPayslipUpload {
  sessionId: string;
  path: string;
  token: string;
  contentType: string;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSecureIssuedUpload(value: unknown, userId: string): value is IssuedPayslipUpload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const path = record.path;
  const prefix = `${userId}/`;
  const leaf = typeof path === 'string' ? path.slice(prefix.length) : '';
  return isUuid(record.sessionId)
    && typeof path === 'string'
    && path.startsWith(prefix)
    && leaf.length > 0
    && !leaf.includes('/')
    && !leaf.includes('\\')
    && !leaf.includes('\0')
    && typeof record.token === 'string'
    && record.token.length >= 16
    && typeof record.contentType === 'string'
    && ALLOWED_FILE_TYPES.has(record.contentType);
}

async function finishIssuedPayslipUpload(db: ReturnType<typeof client>, sessionId: string): Promise<string | null> {
  const { data, error } = await db.functions.invoke('finish-payslip-upload', {
    body: { sessionId },
  });
  return !error && data && typeof data.payslipId === 'string' ? data.payslipId : null;
}

async function readArrayBuffer(file: PickedPayslipFile): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' && file.webFile && typeof (file.webFile as Blob).arrayBuffer === 'function') {
    return (file.webFile as Blob).arrayBuffer();
  }
  return new ExpoFile(file.uri).arrayBuffer();
}

export async function loadDashboard(userId: string): Promise<MobileDashboardData> {
  const db = client();
  const [profileResult, confirmedPayslipResult, pendingPayslipResult, billsResult, goalResult] = await Promise.all([
    db.from('profiles').select('user_id, first_name, country, currency, pay_frequency').eq('user_id', userId).maybeSingle(),
    // A payslip becomes `completed` only through the review-confirmation RPC.
    // Load enough owner-scoped history to find up to three comparable records,
    // rather than treating a provider extraction as confirmed pay.
    db.from('payslips').select('id, employer_id, file_path, pay_date, pay_period_end, pay_period_start, country, file_name, status, processing_failure_code, cleanup_requested_at, created_at').eq('user_id', userId)
      .eq('status', 'completed').order('pay_date', { ascending: false, nullsFirst: false }).limit(12),
    db.from('payslips').select('id, employer_id, file_path, pay_date, pay_period_end, pay_period_start, country, file_name, status, processing_failure_code, cleanup_requested_at, created_at').eq('user_id', userId)
      .in('status', ['processing', 'failed', 'needs_review']).order('created_at', { ascending: false }).limit(10),
    db.from('recurring_bills').select('id, name, amount, due_day, frequency, is_essential, is_active')
      .eq('user_id', userId).eq('is_active', true).order('due_day', { ascending: true, nullsFirst: false }),
    db.from('savings_goals').select('id, name, target_amount, current_amount, currency, is_primary')
      .eq('user_id', userId).eq('is_primary', true).maybeSingle(),
  ]);

  const firstError = [profileResult, confirmedPayslipResult, pendingPayslipResult, billsResult, goalResult]
    .map((result) => result.error)
    .find(Boolean);
  if (firstError) throw new Error('We could not load your payday data.');

  const confirmedPayslips = asArray<Payslip>(confirmedPayslipResult.data);
  const pendingPayslips = asArray<Payslip>(pendingPayslipResult.data);
  const latestPayslip = confirmedPayslips[0] ?? null;
  const planResult = latestPayslip
    ? await db.from('payday_plans').select('id, user_id, payslip_id, pay_date, next_payday, currency, net_pay, everyday_remaining, everyday_checked_in_at, status, created_at')
      .eq('user_id', userId).eq('payslip_id', latestPayslip.id).eq('status', 'active').maybeSingle()
    : { data: null, error: null };
  if (planResult.error) throw new Error('We could not load your payday plan.');
  const activePlan = asOne<PaydayPlan>(planResult.data);

  const [confirmedExtractionResult, allocationResult, anomalyResult] = await Promise.all([
    confirmedPayslips.length > 0
      ? db.from('payslip_extractions').select('payslip_id, extraction_status, confidence_score, gross_pay, net_pay, taxable_pay, tax_amount, national_insurance_amount, prsi_amount, usc_amount, pension_amount, total_deductions').in('payslip_id', confirmedPayslips.map((payslip) => payslip.id))
      : Promise.resolve({ data: [], error: null }),
    activePlan
      ? db.from('payday_plan_allocations').select('id, plan_id, category, amount').eq('plan_id', activePlan.id)
      : Promise.resolve({ data: [], error: null }),
    latestPayslip
      ? db.from('anomaly_results').select('id, payslip_id, severity, title, description, suggested_action, status').eq('payslip_id', latestPayslip.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (confirmedExtractionResult.error || allocationResult.error || anomalyResult.error) {
    throw new Error('We could not load your pay details.');
  }

  const extractions = asArray<PayslipExtraction>(confirmedExtractionResult.data);
  const extractionsByPayslipId = new Map(extractions.map((extraction) => [extraction.payslip_id, extraction]));
  const confirmedPayHistory: ConfirmedPayslip[] = confirmedPayslips.map((payslip) => ({
    ...payslip,
    extraction: extractionsByPayslipId.get(payslip.id) ?? null,
  }));
  const latestConfirmedPayslip = confirmedPayHistory.find((payslip) => payslip.id === latestPayslip?.id) ?? null;
  const previousPayslip = latestConfirmedPayslip
    ? findPreviousSameCountryConfirmedPayslip(latestConfirmedPayslip, confirmedPayHistory)
    : null;

  return {
    profile: asOne<Profile>(profileResult.data),
    latestPayslip,
    latestExtraction: latestPayslip ? extractionsByPayslipId.get(latestPayslip.id) ?? null : null,
    previousExtraction: previousPayslip ? extractionsByPayslipId.get(previousPayslip.id) ?? null : null,
    confirmedPayslips: confirmedPayHistory,
    pendingPayslips,
    latestAnomalies: asArray<PayslipAnomaly>(anomalyResult.data),
    activePlan,
    allocations: asArray<PlanAllocation>(allocationResult.data),
    bills: asArray<RecurringBill>(billsResult.data),
    primaryGoal: asOne<SavingsGoal>(goalResult.data),
  };
}

export async function saveProfileSetup(userId: string, input: ProfileSetupInput): Promise<void> {
  const db = client();
  const { error } = await db.from('profiles').upsert({
    user_id: userId,
    country: input.country,
    currency: input.country === 'Ireland' ? 'EUR' : 'GBP',
    pay_frequency: input.payFrequency,
    onboarding_complete: true,
  }, { onConflict: 'user_id' });
  if (error) throw new Error('We could not save your payday setup. Please try again.');
}

export async function loadReview(payslipId: string): Promise<{ payslip: Payslip; extraction: PayslipExtraction; anomalies: PayslipAnomaly[] }> {
  const db = client();
  const [payslipResult, extractionResult, anomalyResult] = await Promise.all([
    db.from('payslips').select('id, employer_id, file_path, pay_date, pay_period_end, pay_period_start, country, file_name, status, processing_failure_code, cleanup_requested_at, created_at').eq('id', payslipId).single(),
    db.from('payslip_extractions').select('payslip_id, extraction_status, confidence_score, gross_pay, net_pay, taxable_pay, tax_amount, national_insurance_amount, prsi_amount, usc_amount, pension_amount, total_deductions').eq('payslip_id', payslipId).single(),
    db.from('anomaly_results').select('id, payslip_id, severity, title, description, suggested_action, status').eq('payslip_id', payslipId).order('created_at', { ascending: false }),
  ]);
  if (payslipResult.error || extractionResult.error || anomalyResult.error || !payslipResult.data || !extractionResult.data) {
    throw new Error('We could not load the payslip review details.');
  }
  return {
    payslip: payslipResult.data as Payslip,
    extraction: extractionResult.data as PayslipExtraction,
    anomalies: asArray<PayslipAnomaly>(anomalyResult.data),
  };
}

export async function uploadPayslip(file: PickedPayslipFile): Promise<UploadResult> {
  const db = client();
  const inferredMimeType = file.mimeType && ALLOWED_FILE_TYPES.has(file.mimeType)
    ? file.mimeType
    : fileExtensionMimeType(file.name);
  if (!inferredMimeType || !ALLOWED_FILE_TYPES.has(inferredMimeType)) {
    throw new Error('Choose a PDF, PNG, JPG, or WebP payslip.');
  }
  if (file.size && file.size > MAX_FILE_BYTES) {
    throw new Error('Choose a file smaller than 10 MB.');
  }

  const data = await readArrayBuffer(file);
  if (data.byteLength > MAX_FILE_BYTES) {
    throw new Error('Choose a file smaller than 10 MB.');
  }

  const { data: authData, error: authError } = await db.auth.getUser();
  const userId = authData.user?.id;
  if (authError || !userId || !isUuid(userId)) {
    throw new Error('Please sign in again before uploading a payslip.');
  }

  const { data: issuedData, error: issueError } = await db.functions.invoke('start-payslip-upload', {
    body: { fileName: file.name, contentType: inferredMimeType },
  });
  if (issueError || !isSecureIssuedUpload(issuedData, userId)) {
    throw new Error('We could not prepare a secure upload. Please try again.');
  }

  const { error: storageError } = await db.storage.from('payslips').uploadToSignedUrl(issuedData.path, issuedData.token, data, {
    cacheControl: '0',
    contentType: issuedData.contentType,
  });

  // A transport error can occur after Storage accepts the scoped object. The
  // server finaliser is idempotent, so use it as the recovery read before
  // asking someone to start a second upload session.
  const payslipId = await finishIssuedPayslipUpload(db, issuedData.sessionId);
  if (!payslipId) {
    if (storageError) {
      throw new Error('We could not confirm that upload. Its secure session will clear automatically; please try again shortly.');
    }
    throw new Error('We could not save that payslip. Its secure session will clear automatically; please try again shortly.');
  }

  const { error: processingError } = await db.functions.invoke('process-payslip', {
    body: { payslip_id: payslipId },
  });

  const { data: processedPayslip } = await db
    .from('payslips')
    .select('status, processing_failure_code')
    .eq('id', payslipId)
    .single();
  const status = processedPayslip?.status;

  if (status === 'failed') return { payslipId, status: 'failed', failureCode: processedPayslip?.processing_failure_code ?? null };
  if (status === 'needs_review') return { payslipId, status: 'needs_review' };
  if (status === 'completed') return { payslipId, status: 'completed' };
  if (status === 'processing') return { payslipId, status: 'processing' };
  if (processingError) throw new Error('We could not start checking that payslip. It has not been confirmed as checked.');
  throw new Error('We could not confirm the status of that payslip. Please refresh and try again.');
}

export async function retryPayslipProcessing(payslipId: string): Promise<UploadResult> {
  const db = client();
  const { error } = await db.functions.invoke('process-payslip', { body: { payslip_id: payslipId } });
  const { data: payslip } = await db.from('payslips').select('status, processing_failure_code').eq('id', payslipId).single();
  const status = payslip?.status;
  if (status === 'failed') return { payslipId, status: 'failed', failureCode: payslip?.processing_failure_code ?? null };
  if (status === 'needs_review') return { payslipId, status: 'needs_review' };
  if (status === 'completed') return { payslipId, status: 'completed' };
  if (status === 'processing') return { payslipId, status: 'processing' };
  if (error) throw new Error('We could not retry that payslip. It has not been confirmed as checked.');
  throw new Error('We could not confirm the status of that payslip. Please refresh and try again.');
}

export async function beginManualPayslipReview(payslipId: string): Promise<void> {
  const db = client();
  const { error } = await db.rpc('begin_manual_payslip_review', { p_payslip_id: payslipId });
  if (error) {
    throw new Error('We could not open a blank review for that payslip. Please try again.');
  }
}

export async function createPayslipOriginalUrl(payslipId: string): Promise<string> {
  const db = client();
  const { data, error } = await db.functions.invoke('get-payslip-original-url', {
    body: { payslipId },
  });
  if (error || !data || typeof data.url !== 'string') {
    throw new Error('We could not open the saved original payslip. Please try again.');
  }
  return data.url;
}

export async function deleteFailedPayslip(payslipId: string): Promise<{ pending: boolean }> {
  const db = client();
  const { data, error } = await db.functions.invoke('delete-failed-payslip', {
    body: { payslipId },
  });
  if (error || !data?.success) {
    throw new Error(typeof data?.error === 'string'
      ? data.error
      : 'We could not remove that upload. Please try again.');
  }
  return { pending: data.pending === true };
}

export async function confirmReview(input: ReviewInput): Promise<void> {
  const db = client();
  if (!input.payDate || input.grossPay <= 0 || input.netPay <= 0) {
    throw new Error('Add a pay date, gross pay, and net pay before confirming.');
  }
  const values = [
    input.grossPay,
    input.netPay,
    input.taxAmount,
    input.nationalInsuranceAmount,
    input.prsiAmount,
    input.uscAmount,
    input.pensionAmount,
    input.totalDeductions,
  ];
  if (values.some((value) => value !== null && !Number.isFinite(value))) {
    throw new Error('Check that every amount is a valid number.');
  }

  const { error } = await db.rpc('confirm_payslip_review', {
    p_country: input.country ?? null,
    p_payslip_id: input.payslipId,
    p_pay_date: input.payDate,
    p_gross_pay: input.grossPay,
    p_net_pay: input.netPay,
    p_tax_amount: input.taxAmount,
    p_national_insurance_amount: input.nationalInsuranceAmount,
    p_prsi_amount: input.prsiAmount,
    p_usc_amount: input.uscAmount,
    p_pension_amount: input.pensionAmount,
    p_total_deductions: input.totalDeductions,
  });
  if (error) {
    throw new Error('We could not confirm those figures. Please try again.');
  }
}

export async function savePlan(input: PlanInput): Promise<PaydayPlan> {
  const db = client();
  if (!input.payslipId) throw new Error('Confirm a payslip before saving a payday plan.');
  if (input.nextPayday <= input.payDate) throw new Error('Your next payday must be after this pay date.');
  const values = [input.netPay, input.essentialBills, input.everydaySpending, input.buffer];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('Plan amounts must be valid, non-negative numbers.');
  }
  if (input.essentialBills + input.everydaySpending + input.buffer > input.netPay) {
    throw new Error('Your allocations are more than this net pay. Reduce one before saving.');
  }

  // The database derives the source pay date, currency, and net pay from the
  // signed-in person's confirmed payslip. Never send those browser-controlled
  // values back to the server as part of a plan write.
  const { data, error } = await db.rpc('save_payday_plan', {
    p_payslip_id: input.payslipId,
    p_next_payday: input.nextPayday,
    p_essential_bills: input.essentialBills,
    p_everyday_spending: input.everydaySpending,
    p_buffer: input.buffer,
  });
  const savedPlan = Array.isArray(data) ? data[0] : data;
  if (error || !savedPlan) throw new Error('We could not save your payday plan. Please try again.');
  return savedPlan as PaydayPlan;
}

export async function savePaydayCheckIn(input: PaydayCheckInInput): Promise<PaydayPlan> {
  const validation = validatePaydayCheckIn(input);
  if (!validation.ok) throw new Error(validation.error);

  const db = client();
  const { data, error } = await db.rpc('save_payday_check_in', {
    p_plan_id: input.planId,
    p_everyday_remaining: validation.everydayRemaining,
  });
  const savedPlan = Array.isArray(data) ? data[0] : data;
  if (error || !savedPlan) throw new Error('We could not save your payday check-in. Please try again.');
  return savedPlan as PaydayPlan;
}

export async function addBill(userId: string, input: { name: string; amount: number; dueDay: number | null }): Promise<void> {
  const db = client();
  const name = input.name.trim();
  if (!name || input.amount < 0) throw new Error('Add a bill name and a valid amount.');
  const { error } = await db.from('recurring_bills').insert({
    user_id: userId,
    name,
    amount: input.amount,
    due_day: input.dueDay,
    frequency: 'monthly',
    is_essential: true,
    is_active: true,
  });
  if (error) throw new Error('We could not add that bill. Please try again.');
}

export async function savePrimaryGoal(userId: string, input: { targetAmount: number; currentAmount: number; currency: CurrencyCode }): Promise<void> {
  const db = client();
  if (input.targetAmount <= 0 || input.currentAmount < 0) throw new Error('Add a valid buffer target and current amount.');

  const { data: existing, error: existingError } = await db
    .from('savings_goals').select('id').eq('user_id', userId).eq('is_primary', true).maybeSingle();
  if (existingError) throw new Error('We could not load your buffer goal.');

  const values = {
    user_id: userId,
    name: 'One-payday buffer',
    target_amount: input.targetAmount,
    current_amount: input.currentAmount,
    currency: input.currency,
    is_primary: true,
  };
  const result = existing?.id
    ? await db.from('savings_goals').update(values).eq('id', existing.id)
    : await db.from('savings_goals').insert(values);
  if (result.error) throw new Error('We could not save your buffer goal.');
}
