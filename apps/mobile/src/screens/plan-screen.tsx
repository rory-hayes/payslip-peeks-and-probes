import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AquaCorner, Brand, Notice, PrimaryButton, QuietButton, SectionHeading } from '../components/chrome';
import { DateInput } from '../components/date-input';
import { addBill, savePlan, savePrimaryGoal } from '../lib/data';
import { asNumber, daysUntil, formatDate, formatMoney, inferNextPayday } from '../lib/format';
import { colors, radius, spacing } from '../theme';
import type { CurrencyCode, MobileDashboardData, PaydayPlan, PlanAllocation, Profile } from '../types/models';

type PlanDraft = {
  payDate: string;
  nextPayday: string;
  netPay: string;
  essentialBills: string;
  everydaySpending: string;
  buffer: string;
};

export function PlanScreen({
  userId,
  data,
  onSaved,
  onOpenPaycheck,
  onOpenReview,
}: {
  userId: string;
  data: MobileDashboardData | null;
  onSaved: () => void | Promise<void>;
  onOpenPaycheck?: () => void;
  onOpenReview?: (payslipId: string) => void;
}) {
  const activePlan = data?.activePlan ?? null;
  const latestPayslip = data?.latestPayslip ?? null;
  const latestExtraction = data?.latestExtraction ?? null;
  const pendingReview = data?.pendingPayslips.find((payslip) => payslip.status === 'needs_review') ?? null;
  const profile = data?.profile ?? null;
  const bills = useMemo(() => data?.bills ?? [], [data?.bills]);
  const goal = data?.primaryGoal ?? null;
  const currency = currencyFor(profile);
  const draftSeed = useMemo(() => {
    const allocations = data?.allocations ?? [];
    return createPlanDraft(activePlan, latestPayslip?.pay_date ?? null, latestExtraction?.net_pay ?? null, profile, allocations, bills);
  }, [activePlan, bills, data?.allocations, latestExtraction?.net_pay, latestPayslip?.pay_date, profile]);
  const [draft, setDraft] = useState<PlanDraft>(draftSeed);
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('');
  const [showBillForm, setShowBillForm] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingBill, setSavingBill] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(draftSeed);
  }, [draftSeed]);

  useEffect(() => {
    setGoalTarget(goal ? amountText(goal.target_amount) : '');
    setGoalCurrent(goal ? amountText(goal.current_amount) : '');
  }, [goal]);

  const confirmedSource = !pendingReview && Boolean(
    activePlan || (
      latestPayslip?.status === 'completed'
      && latestPayslip.pay_date
      && latestExtraction?.extraction_status === 'completed'
    ),
  );
  const waitingForReview = Boolean(pendingReview);
  const unallocated = asOptionalAmount(draft.netPay) - (
    asOptionalAmount(draft.essentialBills)
    + asOptionalAmount(draft.everydaySpending)
    + asOptionalAmount(draft.buffer)
  );
  const essentialBillTotal = bills.filter((bill) => bill.is_essential).reduce((total, bill) => total + asNumber(bill.amount), 0);
  const essentialBillCount = bills.filter((bill) => bill.is_essential).length;
  const daysToNextPayday = isIsoDate(draft.nextPayday) ? daysUntil(draft.nextPayday) : 0;
  const dailyGuide = daysToNextPayday > 0 ? asOptionalAmount(draft.everydaySpending) / daysToNextPayday : null;
  const everydaySpending = asOptionalAmount(draft.everydaySpending);
  const bufferTarget = asOptionalAmount(goalTarget);
  const bufferCurrent = asOptionalAmount(goalCurrent);
  const bufferProgress = bufferTarget > 0 ? Math.min(100, Math.max(0, (bufferCurrent / bufferTarget) * 100)) : 0;
  const overAllocated = unallocated < -0.005;
  const fullyAssigned = Math.abs(unallocated) < 0.005;

  const update = (field: keyof PlanDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const saveCurrentPlan = async () => {
    const netPay = requiredAmount(draft.netPay);
    const essentialBills = asOptionalAmount(draft.essentialBills);
    const everydaySpending = asOptionalAmount(draft.everydaySpending);
    const buffer = asOptionalAmount(draft.buffer);
    if (!isIsoDate(draft.payDate) || !isIsoDate(draft.nextPayday)) {
      setError('Enter both dates as YYYY-MM-DD before saving.');
      return;
    }
    if (netPay === null || netPay <= 0) {
      setError('Add the net pay from your confirmed payslip.');
      return;
    }
    if ([draft.essentialBills, draft.everydaySpending, draft.buffer].some((value) => value.trim() && requiredAmount(value) === null)) {
      setError('Check that every set-aside amount is a valid number.');
      return;
    }
    if ([essentialBills, everydaySpending, buffer].some((value) => value < 0)) {
      setError('Plan amounts cannot be negative.');
      return;
    }
    if (essentialBills + everydaySpending + buffer > netPay) {
      setError('Your allocations are more than this net pay. Reduce one before saving.');
      return;
    }

    setSavingPlan(true);
    setError(null);
    setMessage(null);
    try {
      await savePlan({
        payslipId: activePlan?.payslip_id ?? latestPayslip?.id ?? null,
        payDate: draft.payDate,
        nextPayday: draft.nextPayday,
        currency,
        netPay,
        essentialBills,
        everydaySpending,
        buffer,
      });
      await onSaved();
      setMessage('Your payday plan is saved. You can adjust it whenever your plans change.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not save your payday plan. Please try again.');
    } finally {
      setSavingPlan(false);
    }
  };

  const saveGoal = async () => {
    const targetAmount = requiredAmount(goalTarget);
    const currentAmount = requiredAmount(goalCurrent);
    if (targetAmount === null || targetAmount <= 0 || currentAmount === null || currentAmount < 0) {
      setError('Add a positive target and the amount you have set aside so far.');
      return;
    }
    setSavingGoal(true);
    setError(null);
    setMessage(null);
    try {
      await savePrimaryGoal(userId, { targetAmount, currentAmount, currency });
      await onSaved();
      setMessage('Your one-payday buffer goal is saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not save your buffer goal. Please try again.');
    } finally {
      setSavingGoal(false);
    }
  };

  const saveBill = async () => {
    const billValue = requiredAmount(billAmount);
    const dueDay = billDueDay.trim() ? Number(billDueDay) : null;
    if (!billName.trim() || billValue === null || billValue < 0) {
      setError('Add a bill name and a valid amount.');
      return;
    }
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      setError('Use a due day between 1 and 31, or leave it blank.');
      return;
    }
    setSavingBill(true);
    setError(null);
    setMessage(null);
    try {
      await addBill(userId, { name: billName, amount: billValue, dueDay });
      setBillName('');
      setBillAmount('');
      setBillDueDay('');
      setShowBillForm(false);
      await onSaved();
      setMessage('Your regular bill is saved for future payday plans.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not add that bill. Please try again.');
    } finally {
      setSavingBill(false);
    }
  };

  if (!data) {
    return <LoadingPlan />;
  }

  if (!confirmedSource) {
    return (
      <View style={styles.root}>
        <AquaCorner />
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons color={colors.violet} name={waitingForReview ? 'create-outline' : 'document-text-outline'} size={38} /></View>
          <Text style={styles.emptyTitle}>{waitingForReview ? 'Confirm your payslip first.' : 'Start with the pay you received.'}</Text>
          <Text style={styles.emptyBody}>
            {waitingForReview
              ? 'Your latest figures are ready for a quick review. Confirm them before you make this payday plan.'
              : 'Once you have a confirmed payslip, you can give this pay a clear, personal plan.'}
          </Text>
          {waitingForReview && pendingReview && onOpenReview ? <PrimaryButton label="Review my payslip" onPress={() => onOpenReview(pendingReview.id)} style={styles.fullButton} /> : null}
          {!waitingForReview && onOpenPaycheck ? <PrimaryButton label="Check a payslip" onPress={onOpenPaycheck} style={styles.fullButton} /> : null}
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
          <View style={styles.planIcon}><Ionicons color={colors.violet} name="pie-chart-outline" size={24} /></View>
        </View>

        <View style={styles.intro}>
          <Text style={styles.title}>Give this pay a job.</Text>
          <Text style={styles.subtitle}>Start with the money on your confirmed payslip, then decide what you want to set aside before the next pay day.</Text>
        </View>

        <View style={styles.outcomeCard}>
          <View style={styles.outcomeHeader}>
            <View>
              <Text style={styles.outcomeEyebrow}>{daysToNextPayday > 0 ? `${daysToNextPayday} ${daysToNextPayday === 1 ? 'day' : 'days'} until next payday` : 'Your payday guide'}</Text>
              <Text style={styles.outcomeLabel}>Safe to spend</Text>
              <Text style={styles.outcomeValue}>{formatMoney(everydaySpending, currency)}</Text>
            </View>
            <View style={styles.outcomeIcon}><Ionicons color={colors.violet} name="wallet-outline" size={29} /></View>
          </View>
          <Text style={styles.outcomeBody}>
            {dailyGuide !== null
              ? `${formatMoney(dailyGuide, currency)} a day from the amount you set aside for everyday spending. It is a planning guide, not your bank balance.`
              : 'Set an everyday-spending amount below to turn this into a guide. It is a planning guide, not your bank balance.'}
          </Text>
          {bufferTarget > 0 ? (
            <View style={styles.bufferProgressWrap}>
              <View style={styles.bufferProgressLabelRow}>
                <Text style={styles.bufferProgressLabel}>One-payday buffer</Text>
                <Text style={styles.bufferProgressValue}>{formatMoney(bufferCurrent, currency)} of {formatMoney(bufferTarget, currency)}</Text>
              </View>
              <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: bufferTarget, now: Math.min(bufferCurrent, bufferTarget) }} style={styles.bufferProgressTrack}>
                <View style={[styles.bufferProgressFill, { width: `${bufferProgress}%` }]} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionHeading title="This pay" />
          <View style={styles.card}>
            <DateInput editable={false} label="Pay date" value={draft.payDate} onChangeText={(value) => update('payDate', value)} />
            <DateInput label="Next payday" value={draft.nextPayday} onChangeText={(value) => update('nextPayday', value)} />
            <AmountField currency={currency} editable={false} label="Net pay" value={draft.netPay} onChangeText={(value) => update('netPay', value)} />
          </View>
          {activePlan ? <Text style={styles.sourceNote}>Editing the plan you saved for {formatDate(activePlan.pay_date)}.</Text> : <Text style={styles.sourceNote}>This plan uses the figures you confirmed on your payslip.</Text>}
        </View>

        <View style={styles.section}>
          <SectionHeading title="Set it aside" />
          <View style={styles.card}>
            <PlanAmountField currency={currency} icon="home-outline" label="Essential bills" value={draft.essentialBills} onChangeText={(value) => update('essentialBills', value)} tone="violet" />
            <PlanAmountField currency={currency} icon="basket-outline" label="Everyday spending" value={draft.everydaySpending} onChangeText={(value) => update('everydaySpending', value)} tone="aqua" />
            <PlanAmountField currency={currency} icon="umbrella-outline" label="One-payday buffer" value={draft.buffer} onChangeText={(value) => update('buffer', value)} tone="coral" />
          </View>

          <View style={[styles.balanceCard, overAllocated && styles.balanceCardWarning]}>
            <View>
              <Text style={styles.balanceLabel}>{overAllocated ? 'Allocated over net pay' : fullyAssigned ? 'Everything is assigned' : 'Left to assign'}</Text>
              <Text style={[styles.balanceValue, overAllocated && styles.balanceValueWarning]}>{formatMoney(Math.abs(unallocated), currency)}</Text>
            </View>
            <Ionicons color={overAllocated ? colors.coral : colors.green} name={overAllocated ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={31} />
          </View>
          {overAllocated ? <Text style={styles.warningNote}>Your plan adds up to more than this net pay. It’s worth checking the amounts before you rely on it.</Text> : null}
          {!activePlan && essentialBillCount > 0 ? <Text style={styles.sourceNote}>We started Essential bills with {formatMoney(essentialBillTotal, currency)} from {essentialBillCount} saved regular {essentialBillCount === 1 ? 'bill' : 'bills'}. Adjust it for this pay period if needed.</Text> : null}
        </View>

        <View style={styles.section}>
          <SectionHeading
            title="Regular bills"
            action={!showBillForm ? <QuietButton label="Add a bill" onPress={() => setShowBillForm(true)} /> : undefined}
          />
          <View style={styles.card}>
            {bills.length ? bills.map((bill, index) => (
              <View key={bill.id} style={[styles.billRow, index < bills.length - 1 && styles.rowDivider]}>
                <View style={styles.billIcon}><Ionicons color={colors.violet} name="receipt-outline" size={20} /></View>
                <View style={styles.billCopy}>
                  <Text style={styles.billName}>{bill.name}</Text>
                  <Text style={styles.billMeta}>{bill.frequency}{bill.due_day ? ` · due day ${bill.due_day}` : ''}</Text>
                </View>
                <Text style={styles.billAmount}>{formatMoney(bill.amount, currency)}</Text>
              </View>
            )) : (
              <View style={styles.billEmpty}>
                <Text style={styles.billEmptyTitle}>No regular bills saved yet.</Text>
                <Text style={styles.billEmptyBody}>Add the bills you want to remember when you plan a payday.</Text>
              </View>
            )}
            {showBillForm ? (
              <View style={styles.billForm}>
                <Text style={styles.billFormTitle}>Add a monthly bill</Text>
                <PlainField label="Bill name" value={billName} onChangeText={setBillName} placeholder="e.g. Rent" />
                <AmountField currency={currency} label="Amount" value={billAmount} onChangeText={setBillAmount} />
                <PlainField label="Due day (optional)" value={billDueDay} onChangeText={setBillDueDay} placeholder="e.g. 1" inputMode="numeric" keyboardType="number-pad" maxLength={2} />
                <View style={styles.billActions}>
                  <PrimaryButton disabled={savingBill} label={savingBill ? 'Saving…' : 'Save bill'} onPress={() => void saveBill()} style={styles.billSave} />
                  <QuietButton label="Cancel" onPress={() => setShowBillForm(false)} />
                </View>
              </View>
            ) : null}
          </View>
          <Text style={styles.sourceNote}>Bills stay separate from your plan so you can decide what belongs in this pay period.</Text>
        </View>

        <View style={styles.section}>
          <SectionHeading title="One-payday buffer" />
          <Notice tone="green">
            <Text style={styles.bufferTitle}>A calmer goal than a savings leaderboard.</Text>
            <Text style={styles.bufferBody}>Set the amount that would cover one ordinary pay period of essentials, then track what you have set aside.</Text>
          </Notice>
          <View style={[styles.card, styles.goalCard]}>
            <AmountField currency={currency} label="Buffer target" value={goalTarget} onChangeText={setGoalTarget} />
            <AmountField currency={currency} label="Already set aside" value={goalCurrent} onChangeText={setGoalCurrent} />
            <PrimaryButton disabled={savingGoal} label={savingGoal ? 'Saving…' : goal ? 'Update my buffer goal' : 'Save my buffer goal'} onPress={() => void saveGoal()} style={styles.goalButton} />
          </View>
        </View>

        {error ? <Notice tone="coral"><Text style={styles.errorNotice}>{error}</Text></Notice> : null}
        {message ? <Notice tone="green"><Text style={styles.successNotice}>{message}</Text></Notice> : null}

        <View style={styles.saveArea}>
          <PrimaryButton disabled={savingPlan} label={savingPlan ? 'Saving your plan…' : 'Save payday plan'} onPress={() => void saveCurrentPlan()} />
          <Text style={styles.disclaimer}>This is a personal planning tool. It does not provide financial or tax advice.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LoadingPlan() {
  return (
    <View style={styles.root}>
      <AquaCorner />
      <View style={styles.loadingState}>
        <ActivityIndicator color={colors.violet} size="large" />
        <Text style={styles.loadingText}>Opening your payday plan…</Text>
      </View>
    </View>
  );
}

function PlainField({ label, value, onChangeText, placeholder, ...inputProps }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  inputMode?: 'numeric';
  keyboardType?: 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={styles.plainField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={styles.textInput}
        value={value}
        {...inputProps}
      />
    </View>
  );
}

function AmountField({ currency, label, value, onChangeText, editable = true }: { currency: CurrencyCode; label: string; value: string; onChangeText: (value: string) => void; editable?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.moneyInputWrap}>
        <Text style={styles.currencyPrefix}>{currency === 'EUR' ? '€' : '£'}</Text>
        <TextInput
          accessibilityLabel={label}
          autoCorrect={false}
          editable={editable}
          inputMode="decimal"
          keyboardType="decimal-pad"
          maxLength={16}
          onChangeText={onChangeText}
          placeholder="0.00"
          placeholderTextColor={colors.placeholder}
          style={[styles.moneyInput, !editable && styles.readOnlyMoneyInput]}
          value={value}
        />
      </View>
    </View>
  );
}

function PlanAmountField({
  currency,
  icon,
  label,
  value,
  onChangeText,
  tone,
}: {
  currency: CurrencyCode;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  tone: 'violet' | 'aqua' | 'coral';
}) {
  const surface = tone === 'violet' ? colors.lavender : tone === 'aqua' ? colors.aquaSoft : colors.coralSoft;
  const iconColor = tone === 'violet' ? colors.violet : tone === 'aqua' ? '#0989A5' : colors.coral;
  return (
    <View style={styles.planField}>
      <View style={[styles.planFieldIcon, { backgroundColor: surface }]}><Ionicons color={iconColor} name={icon} size={22} /></View>
      <View style={styles.planFieldCopy}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.inlineMoneyInput}>
          <Text style={[styles.currencyPrefix, { color: iconColor }]}>{currency === 'EUR' ? '€' : '£'}</Text>
          <TextInput
            accessibilityLabel={label}
            autoCorrect={false}
            inputMode="decimal"
            keyboardType="decimal-pad"
            maxLength={16}
            onChangeText={onChangeText}
            placeholder="0.00"
            placeholderTextColor={colors.placeholder}
            style={styles.inlineMoneyTextInput}
            value={value}
          />
        </View>
      </View>
    </View>
  );
}

function createPlanDraft(
  activePlan: PaydayPlan | null,
  latestPayDate: string | null,
  latestNetPay: number | string | null,
  profile: Profile | null,
  allocations: PlanAllocation[],
  bills: MobileDashboardData['bills'],
): PlanDraft {
  const payDate = activePlan?.pay_date ?? latestPayDate ?? '';
  const savedEssentialBills = bills
    .filter((bill) => bill.is_essential)
    .reduce((total, bill) => total + asNumber(bill.amount), 0);
  return {
    payDate,
    nextPayday: activePlan?.next_payday ?? (payDate ? inferNextPayday(payDate, profile?.pay_frequency) : ''),
    netPay: activePlan ? amountText(activePlan.net_pay) : amountText(latestNetPay),
    essentialBills: activePlan ? amountText(allocation(allocations, 'essential_bills')) : amountText(savedEssentialBills),
    everydaySpending: activePlan ? amountText(allocation(allocations, 'everyday_spending')) : '',
    buffer: activePlan ? amountText(allocation(allocations, 'buffer')) : '',
  };
}

function allocation(items: PlanAllocation[], category: PlanAllocation['category']): number {
  return asNumber(items.find((item) => item.category === category)?.amount);
}

function currencyFor(profile: Profile | null): CurrencyCode {
  if (profile?.currency) return profile.currency;
  return profile?.country === 'Ireland' ? 'EUR' : 'GBP';
}

function amountText(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(asNumber(value));
}

function requiredAmount(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function asOptionalAmount(value: string): number {
  return requiredAmount(value) ?? 0;
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
  planIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 46, justifyContent: 'center', width: 46 },
  intro: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  title: { color: colors.navy, fontSize: 37, fontWeight: '900', letterSpacing: -1.8, lineHeight: 41 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.md, maxWidth: 355 },
  outcomeCard: { backgroundColor: colors.aquaSoft, borderColor: '#BDEEF6', borderRadius: radius.large, borderWidth: 1, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md },
  outcomeHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  outcomeEyebrow: { color: colors.violet, fontSize: 12, fontWeight: '900', letterSpacing: 0.2, textTransform: 'uppercase' },
  outcomeLabel: { color: colors.navy, fontSize: 16, fontWeight: '800', marginTop: spacing.sm },
  outcomeValue: { color: colors.navy, fontSize: 39, fontWeight: '900', letterSpacing: -1.7, lineHeight: 43, marginTop: 1 },
  outcomeIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 999, height: 50, justifyContent: 'center', width: 50 },
  outcomeBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  bufferProgressWrap: { borderTopColor: '#BDEEF6', borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md },
  bufferProgressLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  bufferProgressLabel: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  bufferProgressValue: { color: colors.navy, fontSize: 12, fontWeight: '800' },
  bufferProgressTrack: { backgroundColor: colors.white, borderRadius: radius.pill, height: 8, marginTop: spacing.xs, overflow: 'hidden' },
  bufferProgressFill: { backgroundColor: colors.green, borderRadius: radius.pill, height: '100%' },
  section: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, boxShadow: '0px 8px 16px rgba(23, 21, 93, 0.05)', overflow: 'hidden' },
  field: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  fieldLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  fieldLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  fieldHint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  textInput: { backgroundColor: colors.lavender, borderRadius: radius.small, color: colors.navy, fontSize: 17, fontWeight: '700', minHeight: 49, paddingHorizontal: spacing.sm },
  moneyInputWrap: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: radius.small, flexDirection: 'row', minHeight: 49, paddingLeft: spacing.sm },
  currencyPrefix: { color: colors.violet, fontSize: 18, fontWeight: '900', marginRight: 2 },
  moneyInput: { color: colors.navy, flex: 1, fontSize: 17, fontWeight: '700', minHeight: 49, paddingHorizontal: 2 },
  readOnlyMoneyInput: { color: colors.muted },
  sourceNote: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  planField: { alignItems: 'center', borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  planFieldIcon: { alignItems: 'center', borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  planFieldCopy: { flex: 1, gap: spacing.xs },
  inlineMoneyInput: { alignItems: 'center', flexDirection: 'row' },
  inlineMoneyTextInput: { color: colors.navy, flex: 1, fontSize: 19, fontWeight: '800', minHeight: 32, padding: 0 },
  balanceCard: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: radius.medium, flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, padding: spacing.md },
  balanceCardWarning: { backgroundColor: colors.coralSoft },
  balanceLabel: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  balanceValue: { color: colors.green, fontSize: 28, fontWeight: '900', letterSpacing: -1.1, marginTop: 2 },
  balanceValueWarning: { color: colors.coral },
  warningNote: { color: colors.coral, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  billRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 68, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rowDivider: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth },
  billIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  billCopy: { flex: 1 },
  billName: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  billMeta: { color: colors.muted, fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  billAmount: { color: colors.navy, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  billEmpty: { padding: spacing.md },
  billEmptyTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  billEmptyBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  billForm: { backgroundColor: colors.lavender, borderTopColor: colors.lavenderLine, borderTopWidth: 1, gap: spacing.md, padding: spacing.md },
  billFormTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  plainField: { gap: spacing.xs },
  billActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  billSave: { flex: 1, minHeight: 50 },
  bufferTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  bufferBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  goalCard: { marginTop: spacing.md },
  goalButton: { margin: spacing.md },
  errorNotice: { color: colors.coral, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  successNotice: { color: colors.green, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  saveArea: { gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.xl },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: spacing.sm, textAlign: 'center' },
  loadingState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  loadingText: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  emptyState: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 80, justifyContent: 'center', width: 80 },
  emptyTitle: { color: colors.navy, fontSize: 28, fontWeight: '900', letterSpacing: -1.1, marginTop: spacing.lg, textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm, textAlign: 'center' },
  fullButton: { alignSelf: 'stretch', marginTop: spacing.xl },
});
