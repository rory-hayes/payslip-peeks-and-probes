import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AquaCorner, Brand, Notice, PrimaryButton, QuietButton, SectionHeading } from '../components/chrome';
import { DateInput } from '../components/date-input';
import { confirmReview, createPayslipOriginalUrl, loadReview, type ReviewInput } from '../lib/data';
import { asNumber, formatMoney } from '../lib/format';
import { colors, radius, spacing } from '../theme';
import type { CurrencyCode, Payslip, PayslipAnomaly, PayslipExtraction } from '../types/models';

type ReviewDraft = {
  payDate: string;
  grossPay: string;
  netPay: string;
  taxAmount: string;
  nationalInsuranceAmount: string;
  prsiAmount: string;
  uscAmount: string;
  pensionAmount: string;
  totalDeductions: string;
};

type LoadedReview = {
  payslip: Payslip;
  extraction: PayslipExtraction;
  anomalies: PayslipAnomaly[];
};

type FieldProvenance = {
  label: string;
  tone: 'auto' | 'edited' | 'missing' | 'manual';
};

type ReviewCountry = 'UK' | 'Ireland';

export function ReviewScreen({
  payslipId,
  currency = 'GBP',
  onComplete,
  onClose,
}: {
  payslipId: string;
  currency?: CurrencyCode;
  onComplete: () => void | Promise<void>;
  onClose?: () => void;
}) {
  const [review, setReview] = useState<LoadedReview | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingOriginal, setOpeningOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Set<keyof ReviewDraft>>(() => new Set());
  const [reviewCountry, setReviewCountry] = useState<ReviewCountry>('UK');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEditedFields(new Set());
    try {
      const nextReview = await loadReview(payslipId);
      setReview(nextReview);
      setDraft(toDraft(nextReview));
      setReviewCountry(nextReview.payslip.country === 'Ireland' ? 'Ireland' : 'UK');
    } catch (cause) {
      setReview(null);
      setDraft(null);
      setError(cause instanceof Error ? cause.message : 'We could not load this payslip review.');
    } finally {
      setLoading(false);
    }
  }, [payslipId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reviewCurrency = reviewCountry === 'Ireland' ? 'EUR' : 'GBP';
  const isIreland = reviewCountry === 'Ireland';
  const taxablePay = review?.extraction.taxable_pay;
  const isManualReview = review?.extraction.extraction_status === 'pending';
  const confidenceNote = useMemo(() => {
    if (review?.extraction.extraction_status === 'pending') {
      return 'No figures were added automatically. Use the original payslip to fill in only the details you can see.';
    }
    if (!review?.extraction.confidence_score) return null;
    return 'Some figures were read from your document. Compare them with the original payslip before they join your pay history.';
  }, [review?.extraction.confidence_score, review?.extraction.extraction_status]);

  const update = (field: keyof ReviewDraft, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setEditedFields((current) => new Set(current).add(field));
  };

  const chooseCountry = (country: ReviewCountry) => {
    if (country === reviewCountry) return;

    const incompatibleFields: Array<keyof ReviewDraft> = country === 'Ireland'
      ? ['nationalInsuranceAmount']
      : ['prsiAmount', 'uscAmount'];

    setReviewCountry(country);
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current };
      incompatibleFields.forEach((field) => {
        next[field] = '';
      });
      return next;
    });
    setEditedFields((current) => {
      const next = new Set(current);
      incompatibleFields.forEach((field) => next.add(field));
      return next;
    });
    setError(null);
  };

  const fieldProvenance = (field: keyof ReviewDraft): FieldProvenance => {
    const value = draft?.[field].trim() ?? '';
    if (isManualReview) {
      return value
        ? { label: 'Manual entry', tone: 'manual' }
        : { label: 'Add from original', tone: 'manual' };
    }
    if (editedFields.has(field)) return { label: 'Edited', tone: 'edited' };
    return value
      ? { label: 'Auto-filled', tone: 'auto' }
      : { label: 'Not found', tone: 'missing' };
  };

  const save = async () => {
    if (!draft) return;
    const grossPay = requiredAmount(draft.grossPay);
    const netPay = requiredAmount(draft.netPay);
    const optionalValues = {
      taxAmount: optionalAmount(draft.taxAmount),
      nationalInsuranceAmount: optionalAmount(draft.nationalInsuranceAmount),
      prsiAmount: optionalAmount(draft.prsiAmount),
      uscAmount: optionalAmount(draft.uscAmount),
      pensionAmount: optionalAmount(draft.pensionAmount),
      totalDeductions: optionalAmount(draft.totalDeductions),
    };

    if (!isIsoDate(draft.payDate)) {
      setError('Enter the pay date as YYYY-MM-DD before confirming.');
      return;
    }
    if (grossPay === null || grossPay <= 0 || netPay === null || netPay <= 0) {
      setError('Check that gross pay and net pay are positive amounts.');
      return;
    }
    if (Object.values(optionalValues).some((value) => value !== null && value < 0)) {
      setError('Deduction amounts cannot be negative.');
      return;
    }

    const input: ReviewInput = {
      payslipId,
      country: reviewCountry,
      payDate: draft.payDate,
      grossPay,
      netPay,
      ...optionalValues,
    };

    setSaving(true);
    setError(null);
    try {
      await confirmReview(input);
      await onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not confirm those figures. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openOriginal = async () => {
    setOpeningOriginal(true);
    setError(null);
    try {
      const originalUrl = await createPayslipOriginalUrl(payslipId);
      const supported = await Linking.canOpenURL(originalUrl);
      if (!supported) throw new Error('Your device cannot open the saved original payslip.');
      await Linking.openURL(originalUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not open the saved original payslip.');
    } finally {
      setOpeningOriginal(false);
    }
  };

  if (loading) {
    return <LoadingState label="Opening your payslip review…" />;
  }

  if (!review || !draft) {
    return (
      <View style={styles.root}>
        <AquaCorner />
        <View style={styles.errorState}>
          <View style={styles.errorIcon}><Ionicons color={colors.coral} name="alert-circle-outline" size={38} /></View>
          <Text style={styles.errorTitle}>We couldn’t open this review</Text>
          <Text style={styles.errorBody}>{error ?? 'Try again, or return to your payslips.'}</Text>
          <PrimaryButton label="Try again" onPress={() => void refresh()} style={styles.fullButton} />
          {onClose ? <QuietButton label="Back to my payslips" onPress={onClose} /> : null}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AquaCorner />
        <View style={styles.header}>
          <Brand compact />
          {onClose ? <QuietButton label="Close" onPress={onClose} /> : null}
        </View>

        <View style={styles.intro}>
          <Text style={styles.title}>{isManualReview ? 'Add the figures you can see.' : 'Make sure this feels right.'}</Text>
          <Text style={styles.subtitle}>
            {isManualReview
              ? `The automatic check could not create a draft from ${review.payslip.file_name || 'your payslip'}. Add the figures shown on the original before this payslip joins your history.`
              : `These figures were extracted from ${review.payslip.file_name || 'your payslip'}. It’s worth comparing them with the original before they join your pay history.`}
          </Text>
        </View>

        {review.payslip.file_path ? (
          <View style={styles.originalAction}>
            <QuietButton disabled={openingOriginal} label={openingOriginal ? 'Opening original…' : 'View original payslip'} onPress={() => void openOriginal()} />
          </View>
        ) : null}

        <Notice tone="aqua">
          <View style={styles.noticeRow}>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>{isManualReview ? 'Start with the original' : 'A quick, human check'}</Text>
              <Text style={styles.noticeBody}>{confidenceNote ?? 'We don’t make a call on whether a payslip is right. We help you spot figures worth checking.'}</Text>
            </View>
            <Ionicons color={colors.violet} name="search-outline" size={28} />
          </View>
        </Notice>

        {review.anomalies.length > 0 ? (
          <View style={styles.promptsSection}>
            <SectionHeading title="Worth checking" />
            <Text style={styles.promptsIntro}>These are prompts based on the extracted draft, not a verdict about your pay. Compare them with the payslip you uploaded.</Text>
            <View style={styles.promptsList}>
              {review.anomalies.map((anomaly) => <ReviewPrompt anomaly={anomaly} key={anomaly.id} />)}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading title="Pay country" />
          <View style={styles.countryCard}>
            <Text style={styles.countryHelp}>Choose the country shown on this payslip. Changing it clears the deduction fields that do not apply, so you can check them against the original.</Text>
            <View accessibilityLabel="Pay country" style={styles.countryChoices}>
              <CountryChoice country="UK" selected={reviewCountry === 'UK'} onPress={() => chooseCountry('UK')} />
              <CountryChoice country="Ireland" selected={reviewCountry === 'Ireland'} onPress={() => chooseCountry('Ireland')} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading title="Your pay" />
          <View style={styles.card}>
            <DateInput label="Pay date" provenance={fieldProvenance('payDate')} value={draft.payDate} onChangeText={(value) => update('payDate', value)} />
            <View style={styles.fieldDivider} />
            <AmountField currency={reviewCurrency} label="Gross pay" provenance={fieldProvenance('grossPay')} value={draft.grossPay} onChangeText={(value) => update('grossPay', value)} />
            <AmountField currency={reviewCurrency} label="Net pay" provenance={fieldProvenance('netPay')} value={draft.netPay} onChangeText={(value) => update('netPay', value)} />
            {taxablePay !== null && taxablePay !== undefined ? (
              <ReadOnlyAmount currency={reviewCurrency} label="Taxable pay from the payslip" value={taxablePay} />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading title="Deductions" />
          <View style={styles.card}>
            <AmountField currency={reviewCurrency} label="Income tax" provenance={fieldProvenance('taxAmount')} value={draft.taxAmount} onChangeText={(value) => update('taxAmount', value)} optional />
            {isIreland ? (
              <>
                <AmountField currency={reviewCurrency} label="PRSI" provenance={fieldProvenance('prsiAmount')} value={draft.prsiAmount} onChangeText={(value) => update('prsiAmount', value)} optional />
                <AmountField currency={reviewCurrency} label="USC" provenance={fieldProvenance('uscAmount')} value={draft.uscAmount} onChangeText={(value) => update('uscAmount', value)} optional />
              </>
            ) : (
              <AmountField currency={reviewCurrency} label="National Insurance" provenance={fieldProvenance('nationalInsuranceAmount')} value={draft.nationalInsuranceAmount} onChangeText={(value) => update('nationalInsuranceAmount', value)} optional />
            )}
            <AmountField currency={reviewCurrency} label="Pension" provenance={fieldProvenance('pensionAmount')} value={draft.pensionAmount} onChangeText={(value) => update('pensionAmount', value)} optional />
            <View style={styles.totalWrap}>
              <AmountField currency={reviewCurrency} label="Total deductions" provenance={fieldProvenance('totalDeductions')} value={draft.totalDeductions} onChangeText={(value) => update('totalDeductions', value)} optional />
            </View>
          </View>
        </View>

        {error ? (
          <Notice tone="coral"><Text style={styles.errorNotice}>{error}</Text></Notice>
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton disabled={saving} label={saving ? 'Confirming…' : 'Confirm these figures'} onPress={() => void save()} />
          <Text style={styles.disclaimer}>This check is for understanding and record-keeping only. It is not tax, financial, or payroll advice.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CountryChoice({
  country,
  selected,
  onPress,
}: {
  country: ReviewCountry;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Sets the country used for this payslip review."
      accessibilityLabel={`Set pay country to ${country}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.countryChoice, selected && styles.countryChoiceSelected, pressed && styles.countryChoicePressed]}
    >
      <Text style={[styles.countryChoiceText, selected && styles.countryChoiceTextSelected]}>{country}</Text>
      {selected ? <Ionicons color={colors.violet} name="checkmark-circle" size={20} /> : null}
    </Pressable>
  );
}

function ReviewPrompt({ anomaly }: { anomaly: PayslipAnomaly }) {
  const tone = anomaly.severity === 'high' || anomaly.severity === 'medium' ? 'coral' : 'aqua';
  return (
    <Notice tone={tone}>
      <Text style={styles.promptTitle}>{anomaly.title}</Text>
      {anomaly.description ? <Text style={styles.promptBody}>{anomaly.description}</Text> : null}
      {anomaly.suggested_action ? <Text style={styles.promptAction}>{anomaly.suggested_action}</Text> : null}
    </Notice>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.root}>
      <AquaCorner />
      <View style={styles.loadingState}>
        <ActivityIndicator color={colors.violet} size="large" />
        <Text style={styles.loadingLabel}>{label}</Text>
      </View>
    </View>
  );
}

function AmountField({
  currency,
  label,
  value,
  onChangeText,
  optional = false,
  provenance,
}: {
  currency: CurrencyCode;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  optional?: boolean;
  provenance?: FieldProvenance;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldMeta}>
          {optional ? <Text style={styles.fieldHint}>Optional</Text> : null}
          {provenance ? <Text style={[styles.provenance, provenanceStyle(provenance.tone)]}>{provenance.label}</Text> : null}
        </View>
      </View>
      <View style={styles.moneyInputWrap}>
        <Text style={styles.currencyPrefix}>{currency === 'EUR' ? '€' : '£'}</Text>
        <TextInput
          accessibilityLabel={provenance ? `${label}, ${provenance.label}` : label}
          autoCorrect={false}
          inputMode="decimal"
          keyboardType="decimal-pad"
          maxLength={16}
          onChangeText={onChangeText}
          placeholder="0.00"
          placeholderTextColor={colors.placeholder}
          style={styles.moneyInput}
          value={value}
        />
      </View>
    </View>
  );
}

function provenanceStyle(tone: FieldProvenance['tone']) {
  if (tone === 'edited') return styles.provenanceEdited;
  if (tone === 'missing') return styles.provenanceMissing;
  if (tone === 'manual') return styles.provenanceManual;
  return styles.provenanceAuto;
}

function ReadOnlyAmount({ currency, label, value }: { currency: CurrencyCode; label: string; value: number | string }) {
  return (
    <View style={styles.readOnlyField}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyAmount}>{formatMoney(value, currency)}</Text>
    </View>
  );
}

function toDraft({ payslip, extraction }: LoadedReview): ReviewDraft {
  return {
    payDate: payslip.pay_date ?? '',
    grossPay: amountText(extraction.gross_pay),
    netPay: amountText(extraction.net_pay),
    taxAmount: amountText(extraction.tax_amount),
    nationalInsuranceAmount: amountText(extraction.national_insurance_amount),
    prsiAmount: amountText(extraction.prsi_amount),
    uscAmount: amountText(extraction.usc_amount),
    pensionAmount: amountText(extraction.pension_amount),
    totalDeductions: amountText(extraction.total_deductions),
  };
}

function amountText(value: number | string | null): string {
  if (value === null || value === undefined) return '';
  return String(asNumber(value));
}

function requiredAmount(value: string): number | null {
  const parsed = amount(value);
  return parsed === null ? null : parsed;
}

function optionalAmount(value: string): number | null {
  return value.trim() ? amount(value) : null;
}

function amount(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const [year, month, day] = value.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1, position: 'relative' },
  scroll: { backgroundColor: colors.background, paddingBottom: 42, position: 'relative' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 62 },
  intro: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  originalAction: { alignItems: 'flex-start', marginHorizontal: spacing.lg, marginTop: spacing.md },
  title: { color: colors.navy, fontSize: 37, fontWeight: '900', letterSpacing: -1.8, lineHeight: 41, maxWidth: 335 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.md, maxWidth: 352 },
  noticeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.navy, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  noticeBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  promptsSection: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  promptsIntro: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md, marginTop: -8 },
  promptsList: { gap: spacing.sm },
  promptTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  promptBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  promptAction: { color: colors.violet, fontSize: 13, fontWeight: '800', lineHeight: 19, marginTop: spacing.xs },
  section: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, boxShadow: '0px 8px 16px rgba(23, 21, 93, 0.05)', overflow: 'hidden' },
  countryCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, boxShadow: '0px 8px 16px rgba(23, 21, 93, 0.05)', padding: spacing.md },
  countryHelp: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  countryChoices: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  countryChoice: { alignItems: 'center', borderColor: colors.lavenderLine, borderRadius: radius.small, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.sm },
  countryChoiceSelected: { backgroundColor: colors.lavender, borderColor: colors.violet, borderWidth: 2 },
  countryChoicePressed: { opacity: 0.74 },
  countryChoiceText: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  countryChoiceTextSelected: { color: colors.violet },
  field: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  fieldDivider: { backgroundColor: colors.lavenderLine, height: StyleSheet.hairlineWidth },
  fieldLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  fieldLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  fieldMeta: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  fieldHint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  provenance: { borderRadius: radius.pill, color: colors.navy, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 3 },
  provenanceAuto: { backgroundColor: colors.aquaSoft },
  provenanceEdited: { backgroundColor: colors.lavender },
  provenanceMissing: { backgroundColor: colors.coralSoft },
  provenanceManual: { backgroundColor: colors.greenSoft },
  textInput: { backgroundColor: colors.lavender, borderRadius: radius.small, color: colors.navy, fontSize: 17, fontWeight: '700', minHeight: 49, paddingHorizontal: spacing.sm },
  moneyInputWrap: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: radius.small, flexDirection: 'row', minHeight: 49, paddingLeft: spacing.sm },
  currencyPrefix: { color: colors.violet, fontSize: 18, fontWeight: '900', marginRight: 2 },
  moneyInput: { color: colors.navy, flex: 1, fontSize: 17, fontWeight: '700', minHeight: 49, paddingHorizontal: 2 },
  totalWrap: { backgroundColor: colors.lavender },
  readOnlyField: { alignItems: 'center', backgroundColor: colors.aquaSoft, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  readOnlyLabel: { color: colors.navy, flex: 1, fontSize: 14, fontWeight: '700' },
  readOnlyAmount: { color: colors.navy, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  actions: { gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.xl },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: spacing.sm, textAlign: 'center' },
  errorNotice: { color: colors.coral, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  loadingState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingHorizontal: spacing.xl },
  loadingLabel: { color: colors.navy, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorState: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  errorIcon: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 999, height: 78, justifyContent: 'center', width: 78 },
  errorTitle: { color: colors.navy, fontSize: 27, fontWeight: '900', letterSpacing: -1, marginTop: spacing.lg, textAlign: 'center' },
  errorBody: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, textAlign: 'center' },
  fullButton: { alignSelf: 'stretch', marginTop: spacing.xl },
});
