import { File as ExpoFile } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from './supabase';
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

export interface ReviewInput {
  payslipId: string;
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

function safeFileName(fileName: string): string {
  const finalSegment = fileName.normalize('NFKC').replace(/[\\/]+/g, '/').split('/').pop() ?? '';
  const sanitized = finalSegment
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 96);
  return sanitized || 'payslip';
}

function fileExtensionMimeType(name: string): string | null {
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return null;
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
    db.from('payslips').select('id, file_path, pay_date, country, file_name, status, processing_failure_code, created_at').eq('user_id', userId)
      .eq('status', 'completed').order('pay_date', { ascending: false, nullsFirst: false }).limit(4),
    db.from('payslips').select('id, file_path, pay_date, country, file_name, status, processing_failure_code, created_at').eq('user_id', userId)
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
  const previousPayslip = confirmedPayslips[1] ?? null;
  const planResult = latestPayslip
    ? await db.from('payday_plans').select('id, user_id, payslip_id, pay_date, next_payday, currency, net_pay, status, created_at')
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
    db.from('payslips').select('id, file_path, pay_date, country, file_name, status, processing_failure_code, created_at').eq('id', payslipId).single(),
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

export async function uploadPayslip(userId: string, file: PickedPayslipFile): Promise<UploadResult> {
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

  const path = `${userId}/${Crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: storageError } = await db.storage.from('payslips').upload(path, data, {
    contentType: inferredMimeType,
    upsert: false,
  });
  if (storageError) throw new Error('We could not upload that payslip. Please try again.');

  const { data: payslip, error: payslipError } = await db
    .from('payslips')
    .insert({ user_id: userId, file_name: file.name, file_path: path, status: 'processing' })
    .select('id')
    .single();

  if (payslipError || !payslip) {
    await db.storage.from('payslips').remove([path]);
    throw new Error('We could not save that payslip. Please try again.');
  }

  const { error: processingError } = await db.functions.invoke('process-payslip', {
    body: { payslip_id: payslip.id },
  });

  const { data: processedPayslip } = await db
    .from('payslips')
    .select('status, processing_failure_code')
    .eq('id', payslip.id)
    .single();
  const status = processedPayslip?.status;

  if (status === 'failed') return { payslipId: payslip.id, status: 'failed', failureCode: processedPayslip?.processing_failure_code ?? null };
  if (status === 'needs_review') return { payslipId: payslip.id, status: 'needs_review' };
  if (status === 'completed') return { payslipId: payslip.id, status: 'completed' };
  if (status === 'processing') return { payslipId: payslip.id, status: 'processing' };
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
  const [{ data: payslip, error: payslipError }, { data: authData, error: authError }] = await Promise.all([
    db.from('payslips').select('file_path').eq('id', payslipId).single(),
    db.auth.getUser(),
  ]);
  const userId = authData.user?.id;

  if (payslipError || authError || !userId || !payslip?.file_path || !isOwnedPayslipStoragePath(payslip.file_path, userId)) {
    throw new Error('We could not safely open the saved original payslip.');
  }

  const { data, error } = await db.storage.from('payslips').createSignedUrl(payslip.file_path, 60);
  if (error || !data?.signedUrl) {
    throw new Error('We could not open the saved original payslip. Please try again.');
  }
  return data.signedUrl;
}

function isOwnedPayslipStoragePath(path: string, userId: string): boolean {
  const prefix = `${userId}/`;
  const fileName = path.slice(prefix.length);
  return path.startsWith(prefix)
    && fileName.length > 0
    && fileName !== '.'
    && fileName !== '..'
    && !fileName.includes('/')
    && !fileName.includes('\\')
    && !fileName.includes('\0');
}

export async function deleteFailedPayslip(userId: string, payslipId: string): Promise<void> {
  const db = client();
  const { data: payslip, error: payslipError } = await db
    .from('payslips')
    .select('file_path, status')
    .eq('id', payslipId)
    .single();

  if (payslipError || !payslip || payslip.status !== 'failed') {
    throw new Error('This unfinished upload is no longer available to remove. Refresh and try again.');
  }

  if (payslip.file_path) {
    if (!isOwnedPayslipStoragePath(payslip.file_path, userId)) {
      throw new Error('We could not safely remove that uploaded file. Please contact support.');
    }
    const { error: storageError } = await db.storage.from('payslips').remove([payslip.file_path]);
    if (storageError) {
      throw new Error('We could not remove the saved file, so its record has been kept. Please try again.');
    }
  }

  const { error: deleteError } = await db.rpc('delete_failed_payslip', { p_payslip_id: payslipId });
  if (deleteError) {
    throw new Error('The saved file was removed, but we could not finish removing its unfinished record. Try removing it again.');
  }
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

  const { data, error } = await db.rpc('save_payday_plan', {
    p_payslip_id: input.payslipId,
    p_pay_date: input.payDate,
    p_next_payday: input.nextPayday,
    p_currency: input.currency,
    p_net_pay: input.netPay,
    p_essential_bills: input.essentialBills,
    p_everyday_spending: input.everydaySpending,
    p_buffer: input.buffer,
  });
  if (error || !data) throw new Error('We could not save your payday plan. Please try again.');
  return data as PaydayPlan;
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
