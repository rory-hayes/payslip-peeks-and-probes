import { Ionicons } from '@expo/vector-icons';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AquaCorner, Brand, HeroIllustration, Notice, PrimaryButton, SectionHeading } from '../components/chrome';
import type { MainTab } from '../components/bottom-tabs';
import { asNumber, formatDate, formatMoney, formatShortMoney } from '../lib/format';
import { confirmedPayslipAmount, currencyForPayslip } from '../lib/pay-history';
import { deriveUsualPayBaseline } from '../lib/usual-pay';
import type { MobileDashboardData, Payslip } from '../types/models';
import { colors, radius, spacing } from '../theme';

export function HomeScreen({
  data,
  refreshing,
  onRefresh,
  onTabChange,
  onOpenReview,
  onOpenPayHistory,
}: {
  data: MobileDashboardData | null;
  refreshing: boolean;
  onRefresh: () => void;
  onTabChange: (tab: MainTab) => void;
  onOpenReview: (payslipId: string) => void;
  onOpenPayHistory: (payslipId?: string) => void;
}) {
  const profile = data?.profile;
  const currency = profile?.currency ?? (profile?.country === 'Ireland' ? 'EUR' : 'GBP');
  const latest = data?.latestPayslip;
  const latestExtraction = data?.latestExtraction;
  const previousExtraction = data?.previousExtraction;
  const pendingPayslips = data?.pendingPayslips ?? [];

  if (!latest || !latestExtraction) {
    return (
      <ScrollView contentContainerStyle={styles.emptyScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}>
        <AquaCorner />
        <View style={styles.emptyTop}>
          <Brand />
          {pendingPayslips[0] ? (
            <PendingPayslipState onOpenReview={onOpenReview} onTabChange={onTabChange} payslip={pendingPayslips[0]} />
          ) : (
            <>
              <Text style={styles.emptyTitle}>Just got paid?</Text>
              <Text style={styles.emptySubtitle}>Add a payslip and we’ll help you understand the important bits before you make your plan.</Text>
              <HeroIllustration size={245} />
            </>
          )}
        </View>
        {pendingPayslips[0] ? null : (
          <View style={styles.emptyBottom}>
            <PrimaryButton label="Check my payslip" onPress={() => onTabChange('paycheck')} />
            <Text style={styles.helper}>Add a PDF, photo or screenshot</Text>
            <View style={styles.lastCheck}>
              <View style={styles.checkIcon}><Ionicons color={colors.green} name="checkmark" size={22} /></View>
              <View>
                <Text style={styles.lastCheckTitle}>Ready when you are</Text>
                <Text style={styles.lastCheckBody}>Your first check starts here</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  const netPay = asNumber(latestExtraction.net_pay);
  const previousNet = previousExtraction ? asNumber(previousExtraction.net_pay) : null;
  const netDifference = previousNet === null ? null : netPay - previousNet;
  const usualPay = deriveUsualPayBaseline(data?.confirmedPayslips ?? []);
  const hasUsualPay = usualPay.status === 'ready' && usualPay.currentPayslipId === latest.id;
  const payDifference = hasUsualPay ? usualPay.netDifference : netDifference;
  const plan = data?.activePlan;
  const essentialBills = allocation(data?.allocations ?? [], 'essential_bills');
  const buffer = allocation(data?.allocations ?? [], 'buffer');
  const everyday = allocation(data?.allocations ?? [], 'everyday_spending');
  const insight = getInsight(data, currency);

  return (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}>
      <AquaCorner />
      <View style={styles.header}>
        <Brand />
        <Pressable accessibilityLabel="Your account" accessibilityRole="button" onPress={() => onTabChange('me')} style={({ pressed }) => [styles.profileCircle, pressed && styles.profileCirclePressed]}><Ionicons color={colors.navy} name="person-outline" size={23} /></Pressable>
      </View>

      {pendingPayslips[0] ? <View style={styles.pendingBanner}><PendingPayslipState compact onOpenReview={onOpenReview} onTabChange={onTabChange} payslip={pendingPayslips[0]} /></View> : null}

      <Text style={styles.title}>Your payday, clear.</Text>
      <View style={styles.payCard}>
        <Text style={styles.payLabel}>Net pay</Text>
        <Text style={styles.payAmount}>{formatMoney(netPay, currency)}</Text>
        <View style={styles.payFoot}>
          <Ionicons color={colors.violet} name="calendar-outline" size={21} />
          <Text style={styles.payDate}>Paid {formatDate(latest.pay_date)}</Text>
        </View>
        {payDifference !== null ? (
          <View style={styles.difference}>
            <View style={[styles.differenceIcon, payDifference >= 0 ? styles.differenceGood : styles.differenceWatch]}>
              <Ionicons color={payDifference >= 0 ? colors.green : colors.coral} name={payDifference >= 0 ? 'arrow-up' : 'arrow-down'} size={17} />
            </View>
            <Text style={styles.differenceText}>
              <Text style={{ color: payDifference >= 0 ? colors.green : colors.coral, fontWeight: '800' }}>{formatShortMoney(Math.abs(payDifference), currency)}</Text>
              {hasUsualPay
                ? (payDifference >= 0 ? ' more than your usual pay' : ' less than your usual pay')
                : (payDifference >= 0 ? ' more than last time' : ' less than last time')}
            </Text>
          </View>
        ) : <Text style={styles.firstPay}>Your first confirmed payslip</Text>}
      </View>

      <Notice tone="aqua">
        <View style={styles.insightRow}>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>{hasUsualPay ? 'Your usual pay' : 'Build your usual pay'}</Text>
            <Text style={styles.insightBody}>
              {hasUsualPay && usualPay.usualNetPay !== null
                ? `Your usual take-home is ${formatShortMoney(usualPay.usualNetPay, currency)}, based on the middle of your last ${usualPay.sampleSize} comparable confirmed payslips.`
                : usualPay.sampleSize === 1
                  ? 'One more comparable confirmed payslip will build a personal take-home reference.'
                  : 'We’ll build a personal take-home reference after two comparable confirmed payslips.'}
            </Text>
          </View>
          <Ionicons color="#0989A5" name={hasUsualPay ? 'analytics-outline' : 'time-outline'} size={27} />
        </View>
      </Notice>

      <Notice tone={insight.tone}>
        <View style={styles.insightRow}>
          <View style={styles.insightCopy}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightBody}>{insight.body}</Text>
          </View>
          <Ionicons color={colors.navy} name={insight.icon} size={27} />
        </View>
        {latest.status === 'needs_review' ? <PrimaryButton label="Check the details" onPress={() => onOpenReview(latest.id)} style={styles.insightButton} /> : null}
      </Notice>

      {data?.latestAnomalies.length ? (
        <Notice tone="aqua">
          <View style={styles.insightRow}>
            <View style={styles.insightCopy}>
              <Text style={styles.insightTitle}>One thing worth checking</Text>
              <Text style={styles.insightBody}>{data.latestAnomalies[0].title}{data.latestAnomalies[0].description ? ` ${data.latestAnomalies[0].description}` : ''}</Text>
            </View>
            <Ionicons color="#0989A5" name="search-outline" size={27} />
          </View>
        </Notice>
      ) : null}

      <View style={styles.section}>
        <SectionHeading title="Plan until payday" />
        {plan ? (
          <View style={styles.planCard}>
            <View style={styles.planAllocations}>
              <PlanColumn icon="home-outline" label="Bills" amount={essentialBills} currency={currency} tone="violet" />
              <View style={styles.planDivider} />
              <PlanColumn icon="basket-outline" label="Everyday" amount={everyday} currency={currency} tone="aqua" />
              <View style={styles.planDivider} />
              <PlanColumn icon="umbrella-outline" label="Buffer" amount={buffer} currency={currency} tone="coral" />
            </View>
            <PrimaryButton label="Edit my payday plan" onPress={() => onTabChange('plan')} />
          </View>
        ) : (
          <View style={styles.unplanned}>
            <Text style={styles.unplannedTitle}>Give this pay a simple plan.</Text>
            <Text style={styles.unplannedBody}>Set aside essentials, everyday spending and a little buffer before the month gets busy.</Text>
            <PrimaryButton label="Make my payday plan" onPress={() => onTabChange('plan')} />
          </View>
        )}
      </View>

      {data?.confirmedPayslips.length ? (
        <View style={styles.section}>
          <SectionHeading
            title="Your pay history"
            action={(
              <Pressable
                accessibilityHint="Opens all of your confirmed payslips"
                accessibilityLabel="See all pay history"
                accessibilityRole="button"
                onPress={() => onOpenPayHistory()}
                style={({ pressed }) => [styles.historyAction, pressed && styles.historyActionPressed]}
              >
                <Text style={styles.historyActionText}>See all</Text>
                <Ionicons color={colors.violet} name="chevron-forward" size={18} />
              </Pressable>
            )}
          />
          <View style={styles.historyCard}>
            {data.confirmedPayslips.slice(0, 3).map((payslip, index) => (
              <PayHistoryRow
                currency={currencyForPayslip(payslip.country, currency)}
                isLast={index === Math.min(data.confirmedPayslips.length, 3) - 1}
                key={payslip.id}
                onPress={() => onOpenPayHistory(payslip.id)}
                payslip={payslip}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.disclaimer}>Payslip Insights highlights changes worth checking; it does not give tax or financial advice.</Text>
    </ScrollView>
  );
}

function PendingPayslipState({
  payslip,
  compact = false,
  onOpenReview,
  onTabChange,
}: {
  payslip: Payslip;
  compact?: boolean;
  onOpenReview: (payslipId: string) => void;
  onTabChange: (tab: MainTab) => void;
}) {
  const isReview = payslip.status === 'needs_review';
  const isFailed = payslip.status === 'failed';
  const title = isReview ? 'Your review is ready' : isFailed ? (payslip.processing_failure_code === 'monthly_upload_limit' ? 'Checks used for this month' : 'That check needs another try') : 'Still checking your payslip';
  const body = isReview
    ? 'Compare the extracted figures before this payslip joins your pay history.'
    : isFailed
      ? (payslip.processing_failure_code === 'monthly_upload_limit' ? 'This file is saved. Open Payslips to add the figures yourself or remove the upload.' : 'Your file is still saved. Open Payslips to retry it, add the figures yourself, or remove the upload.')
      : 'Your saved upload stays here. Open Payslips to refresh its status or retry it if it remains waiting.';
  const icon = isReview ? 'create-outline' : isFailed ? 'alert-circle-outline' : 'time-outline';
  // The processor has no client-side background queue. Let people return to
  // the saved upload, where they can refresh or retry it, instead of implying
  // a plain refresh will always advance the work.
  const action = isReview ? () => onOpenReview(payslip.id) : () => onTabChange('paycheck');
  const label = isReview ? 'Review my payslip' : 'Open payslips';
  return (
    <View style={[styles.pendingState, compact && styles.pendingStateCompact, isFailed && styles.pendingStateFailed]}>
      <View style={styles.pendingStateRow}>
        <View style={[styles.pendingStateIcon, isFailed ? styles.pendingStateIconFailed : null]}><Ionicons color={isFailed ? colors.coral : isReview ? colors.violet : '#0989A5'} name={icon} size={25} /></View>
        <View style={styles.pendingStateCopy}>
          <Text style={styles.pendingStateTitle}>{title}</Text>
          <Text style={styles.pendingStateBody}>{body}</Text>
        </View>
      </View>
      <PrimaryButton label={label} onPress={action} style={styles.pendingStateButton} />
    </View>
  );
}

function PayHistoryRow({
  payslip,
  currency,
  isLast,
  onPress,
}: {
  payslip: MobileDashboardData['confirmedPayslips'][number];
  currency: 'GBP' | 'EUR';
  isLast: boolean;
  onPress: () => void;
}) {
  const netPay = confirmedPayslipAmount(payslip, 'net_pay');
  return (
    <Pressable
      accessibilityHint={`Opens the confirmed payslip from ${formatDate(payslip.pay_date)}`}
      accessibilityLabel={`Confirmed payslip, ${formatDate(payslip.pay_date)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.historyRow, !isLast && styles.historyRowBorder, pressed && styles.historyRowPressed]}
    >
      <View style={styles.historyIcon}><Ionicons color={colors.green} name="checkmark" size={18} /></View>
      <View style={styles.historyCopy}>
        <Text style={styles.historyDate}>{formatDate(payslip.pay_date)}</Text>
        <Text style={styles.historyStatus}>Confirmed payslip</Text>
      </View>
      <View style={styles.historyRowEnd}>
        {netPay !== null ? <Text style={styles.historyAmount}>{formatShortMoney(netPay, currency)}</Text> : null}
        <Ionicons color={colors.muted} name="chevron-forward" size={19} />
      </View>
    </Pressable>
  );
}

function allocation(items: MobileDashboardData['allocations'], category: 'essential_bills' | 'everyday_spending' | 'buffer'): number {
  return asNumber(items.find((item) => item.category === category)?.amount);
}

function getInsight(data: MobileDashboardData, currency: 'GBP' | 'EUR') {
  const current = data.latestExtraction;
  const previous = data.previousExtraction;
  if (data.latestPayslip?.status === 'needs_review') {
    return { title: 'A few details need you', body: 'Check the extracted figures before you rely on this payslip.', icon: 'create-outline' as const, tone: 'coral' as const };
  }
  if (current && previous) {
    const pensionDifference = asNumber(current.pension_amount) - asNumber(previous.pension_amount);
    if (Math.abs(pensionDifference) >= 1) {
      return {
        title: 'One thing worth checking',
        body: `Your pension payment ${pensionDifference > 0 ? 'increased' : 'decreased'} by ${formatShortMoney(Math.abs(pensionDifference), currency)}.`,
        icon: 'search-outline' as const,
        tone: 'aqua' as const,
      };
    }
  }
  return { title: 'Your payslip is ready', body: 'You can now make a clear plan for this payday.', icon: 'checkmark-circle-outline' as const, tone: 'green' as const };
}

function PlanColumn({ icon, label, amount, currency, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; amount: number; currency: 'GBP' | 'EUR'; tone: 'violet' | 'aqua' | 'coral' }) {
  const surface = tone === 'violet' ? colors.lavender : tone === 'aqua' ? colors.aquaSoft : colors.coralSoft;
  const color = tone === 'violet' ? colors.violet : tone === 'aqua' ? '#0989A5' : colors.coral;
  return (
    <View style={styles.planColumn}>
      <View style={[styles.planColumnIcon, { backgroundColor: surface }]}><Ionicons color={color} name={icon} size={23} /></View>
      <Text style={styles.planColumnLabel}>{label}</Text>
      <Text style={styles.planColumnValue}>{formatShortMoney(amount, currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, paddingBottom: 36, position: 'relative' },
  emptyScroll: { backgroundColor: colors.background, flexGrow: 1, justifyContent: 'space-between', position: 'relative' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 64 },
  profileCircle: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: 999, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  profileCirclePressed: { backgroundColor: colors.lavender },
  pendingBanner: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  pendingState: { backgroundColor: colors.aquaSoft, borderRadius: radius.large, gap: spacing.md, padding: spacing.md },
  pendingStateCompact: { borderRadius: radius.medium },
  pendingStateFailed: { backgroundColor: colors.coralSoft },
  pendingStateRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  pendingStateIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 999, height: 46, justifyContent: 'center', width: 46 },
  pendingStateIconFailed: { backgroundColor: '#FFE0D9' },
  pendingStateCopy: { flex: 1 },
  pendingStateTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  pendingStateBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  pendingStateButton: { minHeight: 50 },
  title: { color: colors.navy, fontSize: 37, fontWeight: '800', letterSpacing: -1.7, marginHorizontal: spacing.lg, marginTop: 36 },
  payCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, boxShadow: '0px 8px 18px rgba(23, 21, 93, 0.08)', marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg },
  payLabel: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  payAmount: { color: colors.navy, fontSize: 42, fontWeight: '900', letterSpacing: -2, marginTop: 5 },
  payFoot: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  payDate: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  difference: { alignItems: 'center', borderTopColor: colors.lavenderLine, borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md },
  differenceIcon: { alignItems: 'center', borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  differenceGood: { backgroundColor: colors.greenSoft },
  differenceWatch: { backgroundColor: colors.coralSoft },
  differenceText: { color: colors.muted, fontSize: 15 },
  firstPay: { color: colors.muted, fontSize: 14, marginTop: spacing.md },
  insightRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  insightCopy: { flex: 1 },
  insightTitle: { color: colors.navy, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  insightBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  insightButton: { marginTop: spacing.md, minHeight: 48 },
  section: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  planCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, overflow: 'hidden', padding: spacing.md },
  planAllocations: { alignItems: 'stretch', flexDirection: 'row', marginBottom: spacing.md },
  planColumn: { alignItems: 'center', flex: 1, gap: spacing.xs },
  planColumnIcon: { alignItems: 'center', borderRadius: 999, height: 46, justifyContent: 'center', width: 46 },
  planColumnLabel: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  planColumnValue: { color: colors.navy, fontSize: 18, fontWeight: '900', letterSpacing: -0.7, textAlign: 'center' },
  planDivider: { alignSelf: 'center', backgroundColor: colors.lavenderLine, height: 74, width: 1 },
  unplanned: { backgroundColor: colors.lavender, borderRadius: radius.large, gap: spacing.md, padding: spacing.lg },
  unplannedTitle: { color: colors.navy, fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  unplannedBody: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  historyCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, overflow: 'hidden', paddingHorizontal: spacing.md },
  historyRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 70 },
  historyRowBorder: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth },
  historyRowPressed: { backgroundColor: colors.lavender },
  historyIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 999, height: 36, justifyContent: 'center', width: 36 },
  historyCopy: { flex: 1 },
  historyDate: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  historyStatus: { color: colors.muted, fontSize: 12, marginTop: 2 },
  historyRowEnd: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  historyAmount: { color: colors.navy, fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  historyAction: { alignItems: 'center', flexDirection: 'row', minHeight: 36, paddingLeft: spacing.sm },
  historyActionPressed: { opacity: 0.62 },
  historyActionText: { color: colors.violet, fontSize: 14, fontWeight: '800' },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginHorizontal: spacing.lg, marginTop: spacing.xl, textAlign: 'center' },
  emptyTop: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 64 },
  emptyTitle: { alignSelf: 'flex-start', color: colors.navy, fontSize: 48, fontWeight: '900', letterSpacing: -2.4, lineHeight: 50, marginTop: 54 },
  emptySubtitle: { alignSelf: 'flex-start', color: colors.muted, fontSize: 18, lineHeight: 26, marginTop: spacing.md, maxWidth: 325 },
  emptyBottom: { borderTopColor: colors.lavenderLine, borderTopWidth: 1, gap: spacing.md, padding: spacing.lg },
  helper: { color: colors.violet, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  lastCheck: { alignItems: 'center', borderTopColor: colors.lavenderLine, borderTopWidth: 1, flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.md },
  checkIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 999, height: 48, justifyContent: 'center', width: 48 },
  lastCheckTitle: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  lastCheckBody: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
