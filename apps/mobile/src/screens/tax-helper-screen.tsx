import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AquaCorner, Brand, Notice } from '../components/chrome';
import type { MobileDashboardData } from '../types/models';
import { colors, radius, spacing } from '../theme';

type TaxCountry = 'Ireland' | 'UK';

interface TaxStep {
  id: string;
  title: string;
  body: string;
  action: string;
  href?: string;
  opensHistory?: boolean;
  source: 'Revenue' | 'GOV.UK';
}

const stepsByCountry: Record<TaxCountry, TaxStep[]> = {
  Ireland: [
    { id: 'ie-history', title: 'Bring your confirmed pay together', body: 'Check that your saved payslips cover each employer and pay period you expect for the calendar year.', action: 'Open pay history', opensHistory: true, source: 'Revenue' },
    { id: 'ie-summary', title: 'Check your Employment Detail Summary', body: 'Compare Revenue’s employer-reported pay and deductions with the figures you confirmed from your own payslips.', action: 'Open Revenue guidance', href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/employment-detail-summary.aspx', source: 'Revenue' },
    { id: 'ie-preliminary', title: 'Read your Preliminary End of Year Statement', body: 'Use Revenue’s preliminary calculation before completing your PAYE Income Tax Return.', action: 'Open Revenue guidance', href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/preliminary-end-year-statement.aspx', source: 'Revenue' },
    { id: 'ie-return', title: 'Complete your PAYE Income Tax Return', body: 'Review relevant credits and reliefs, declare additional income, and submit through Revenue myAccount.', action: 'See Revenue’s return steps', href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/paye-income-tax-return.aspx', source: 'Revenue' },
    { id: 'ie-liability', title: 'Review your Statement of Liability', body: 'Revenue’s final statement shows whether its calculation results in a refund, a balanced position, or an underpayment.', action: 'Open Revenue guidance', href: 'https://www.revenue.ie/en/jobs-and-pensions/end-of-year-process/statement-of-liability.aspx', source: 'Revenue' },
  ],
  UK: [
    { id: 'uk-history', title: 'Bring your confirmed pay together', body: 'Check that your saved payslips cover each employer and pay period you expect for the UK tax year.', action: 'Open pay history', opensHistory: true, source: 'GOV.UK' },
    { id: 'uk-account', title: 'Check your HMRC employment record', body: 'Use your Personal Tax Account to review the pay, employer and tax-code information HMRC holds for you.', action: 'Open your official account', href: 'https://www.gov.uk/personal-tax-account', source: 'GOV.UK' },
    { id: 'uk-code', title: 'Review your tax code and estimate', body: 'Compare the tax code on your payslip with HMRC’s current record, especially after a job, benefit or pension change.', action: 'Check your Income Tax', href: 'https://www.gov.uk/check-income-tax-current-year', source: 'GOV.UK' },
    { id: 'uk-route', title: 'Find the correct refund route', body: 'HMRC uses different routes for employment pay, work expenses, pensions and Self Assessment.', action: 'Check how to claim', href: 'https://www.gov.uk/claim-tax-refund', source: 'GOV.UK' },
    { id: 'uk-result', title: 'Keep HMRC’s outcome with your records', body: 'Save the official calculation or response with the documents you used. Payslip Insights does not file a claim for you.', action: 'View HMRC response times', href: 'https://www.gov.uk/guidance/check-when-you-can-expect-a-reply-from-hmrc', source: 'GOV.UK' },
  ],
};

export function TaxHelperScreen({ data, onOpenHistory }: { data: MobileDashboardData; onOpenHistory: () => void }) {
  const [country, setCountry] = useState<TaxCountry>(data.profile?.country === 'Ireland' ? 'Ireland' : 'UK');
  const [period, setPeriod] = useState<'completed' | 'current'>('completed');
  const [complete, setComplete] = useState<Set<string>>(() => new Set());
  const window = useMemo(() => taxYear(country, new Date(), period === 'completed' ? -1 : 0), [country, period]);
  const steps = stepsByCountry[country];
  const confirmedCount = data.confirmedPayslips.filter((payslip) => payslip.country === country && inTaxYear(payslip.pay_date, window)).length;
  const completeCount = steps.filter((step) => complete.has(step.id)).length;

  const chooseCountry = (next: TaxCountry) => {
    setCountry(next);
    setComplete(new Set());
  };

  const choosePeriod = (next: 'completed' | 'current') => {
    setPeriod(next);
    setComplete(new Set());
  };

  const toggle = (id: string) => {
    setComplete((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openStep = async (step: TaxStep) => {
    if (step.opensHistory) {
      onOpenHistory();
      return;
    }
    if (!step.href) return;
    const supported = await Linking.canOpenURL(step.href);
    if (supported) await Linking.openURL(step.href);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AquaCorner />
      <View style={styles.header}>
        <Brand compact />
        <Text accessibilityRole="header" style={styles.title}>Your tax year, organised.</Text>
        <Text style={styles.intro}>Bring your confirmed payslips together, then follow the official steps. We guide the review; Revenue or HMRC makes the decision.</Text>
      </View>

      <View accessibilityRole="tablist" style={styles.countryPicker}>
        <CountryButton active={country === 'Ireland'} label="Ireland" onPress={() => chooseCountry('Ireland')} />
        <CountryButton active={country === 'UK'} label="United Kingdom" onPress={() => chooseCountry('UK')} />
      </View>
      <View accessibilityRole="tablist" style={styles.periodPicker}>
        <CountryButton active={period === 'completed'} label="Last completed" onPress={() => choosePeriod('completed')} />
        <CountryButton active={period === 'current'} label="Current year" onPress={() => choosePeriod('current')} />
      </View>

      <View style={styles.readiness}>
        <View style={styles.readinessIcon}><Ionicons color="#087A87" name="documents-outline" size={27} /></View>
        <View style={styles.readinessCopy}>
          <Text style={styles.readinessKicker}>{country === 'Ireland' ? 'Calendar year' : 'UK tax year'} {window.label}</Text>
          <Text style={styles.readinessTitle}>{confirmedCount} confirmed {confirmedCount === 1 ? 'payslip' : 'payslips'} ready</Text>
          <Text style={styles.readinessBody}>{confirmedCount ? 'Use these as your personal evidence when you review the figures held by the official service.' : 'Confirm payslips as you go so your year-end review does not start from a pile of documents.'}</Text>
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionKicker}>Official-source checklist</Text>
          <Text style={styles.sectionTitle}>Your {window.label} review</Text>
        </View>
        <Text style={styles.progressLabel}>{completeCount}/{steps.length}</Text>
      </View>
      <View accessibilityLabel={`${completeCount} of ${steps.length} steps reviewed`} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: steps.length, now: completeCount }} style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(completeCount / steps.length) * 100}%` }]} />
      </View>

      <View style={styles.steps}>
        {steps.map((step, index) => {
          const checked = complete.has(step.id);
          return (
            <View key={step.id} style={[styles.step, checked && styles.stepComplete]}>
              <Pressable
                accessibilityLabel={`${checked ? 'Mark as not reviewed' : 'Mark as reviewed'}: ${step.title}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() => toggle(step.id)}
                style={({ pressed }) => [styles.stepCheck, checked && styles.stepCheckComplete, pressed && styles.pressed]}
              >
                {checked ? <Ionicons color={colors.white} name="checkmark" size={20} /> : <Text style={styles.stepNumber}>{index + 1}</Text>}
              </Pressable>
              <View style={styles.stepCopy}>
                <View style={styles.sourcePill}><Ionicons color={colors.muted} name="business-outline" size={12} /><Text style={styles.sourceText}>{step.source}</Text></View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
                <Pressable accessibilityRole="link" onPress={() => void openStep(step)} style={({ pressed }) => [styles.stepLink, pressed && styles.pressed]}>
                  <Text style={styles.stepLinkText}>{step.action}</Text>
                  <Ionicons color={colors.violet} name={step.opensHistory ? 'arrow-forward' : 'open-outline'} size={17} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <Notice tone="aqua">
        <View style={styles.boundaryRow}>
          <Ionicons color="#087A87" name="shield-checkmark-outline" size={26} />
          <View style={styles.boundaryCopy}>
            <Text style={styles.boundaryTitle}>Guidance, not a refund calculation</Text>
            <Text style={styles.boundaryBody}>We do not calculate your final liability, decide which reliefs apply, access your government account, submit a return, or promise a refund.</Text>
          </View>
        </View>
      </Notice>

      <Text style={styles.disclaimer}>Confirm every figure in the official service or with a qualified professional. The checklist is not tax, legal, payroll, or financial advice.</Text>
    </ScrollView>
  );
}

function CountryButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.countryButton, active && styles.countryButtonActive, pressed && styles.pressed]}>
      <Text style={[styles.countryText, active && styles.countryTextActive]}>{label}</Text>
    </Pressable>
  );
}

interface TaxWindow { label: string; start: number; end: number }

function taxYear(country: TaxCountry, now = new Date(), yearOffset = 0): TaxWindow {
  const year = now.getUTCFullYear();
  if (country === 'Ireland') {
    const targetYear = year + yearOffset;
    return { label: String(targetYear), start: Date.UTC(targetYear, 0, 1), end: Date.UTC(targetYear, 11, 31, 23, 59, 59) };
  }
  const thisStart = Date.UTC(year, 3, 6);
  const startYear = (now.getTime() >= thisStart ? year : year - 1) + yearOffset;
  return { label: `${startYear}/${String(startYear + 1).slice(-2)}`, start: Date.UTC(startYear, 3, 6), end: Date.UTC(startYear + 1, 3, 5, 23, 59, 59) };
}

function inTaxYear(value: string | null, window: TaxWindow): boolean {
  if (!value) return false;
  const timestamp = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(timestamp) && timestamp >= window.start && timestamp <= window.end;
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, paddingBottom: 44, paddingHorizontal: spacing.lg, position: 'relative' },
  header: { paddingTop: 64 },
  title: { color: colors.navy, fontSize: 39, fontWeight: '900', letterSpacing: -1.9, lineHeight: 41, marginTop: 42, maxWidth: 330 },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.md, maxWidth: 410 },
  countryPicker: { alignSelf: 'flex-start', backgroundColor: colors.lavender, borderRadius: radius.pill, flexDirection: 'row', gap: 3, marginTop: spacing.xl, padding: 4 },
  periodPicker: { alignSelf: 'flex-start', backgroundColor: colors.lavender, borderRadius: radius.pill, flexDirection: 'row', gap: 3, marginTop: spacing.sm, padding: 4 },
  countryButton: { borderRadius: radius.pill, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  countryButtonActive: { backgroundColor: colors.white, boxShadow: '0px 4px 12px rgba(23, 21, 93, 0.10)' },
  countryText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  countryTextActive: { color: colors.navy },
  readiness: { alignItems: 'flex-start', backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md },
  readinessIcon: { alignItems: 'center', backgroundColor: colors.aquaSoft, borderRadius: radius.small, height: 48, justifyContent: 'center', width: 48 },
  readinessCopy: { flex: 1 },
  readinessKicker: { color: colors.violet, fontSize: 10, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  readinessTitle: { color: colors.navy, fontSize: 19, fontWeight: '900', letterSpacing: -0.4, marginTop: 4 },
  readinessBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  sectionHeading: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
  sectionKicker: { color: colors.violet, fontSize: 10, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  sectionTitle: { color: colors.navy, fontSize: 25, fontWeight: '900', letterSpacing: -0.8, marginTop: 4 },
  progressLabel: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  progressTrack: { backgroundColor: colors.lavender, borderRadius: radius.pill, height: 7, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.violet, borderRadius: radius.pill, height: 7 },
  steps: { gap: spacing.sm, marginTop: spacing.md },
  step: { alignItems: 'flex-start', backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.medium, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  stepComplete: { backgroundColor: '#F6FFF9', borderColor: '#B7EAD1' },
  stepCheck: { alignItems: 'center', backgroundColor: colors.lavender, borderColor: colors.lavenderLine, borderRadius: radius.pill, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  stepCheckComplete: { backgroundColor: colors.green, borderColor: colors.green },
  stepNumber: { color: colors.violet, fontSize: 13, fontWeight: '900' },
  stepCopy: { flex: 1 },
  sourcePill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.lavender, borderRadius: radius.pill, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  sourceText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  stepTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginTop: spacing.sm },
  stepBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  stepLink: { alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 44, paddingTop: spacing.xs },
  stepLinkText: { color: colors.violet, fontSize: 13, fontWeight: '900' },
  boundaryRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  boundaryCopy: { flex: 1 },
  boundaryTitle: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  boundaryBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.lg, textAlign: 'center' },
  pressed: { opacity: 0.62 },
});
