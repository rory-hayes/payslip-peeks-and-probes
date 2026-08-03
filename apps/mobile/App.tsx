import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabs, type MainTab } from './src/components/bottom-tabs';
import { AquaCorner, Brand, PrimaryButton, QuietButton } from './src/components/chrome';
import { loadDashboard } from './src/lib/data';
import { parseAuthRedirect } from './src/lib/deep-links';
import { hasSupabaseConfig, manageSupabaseTokenRefresh, supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/auth-screen';
import { HomeScreen } from './src/screens/home-screen';
import { MeScreen } from './src/screens/me-screen';
import { PaycheckScreen } from './src/screens/paycheck-screen';
import { PlanScreen } from './src/screens/plan-screen';
import { ProfileSetupScreen } from './src/screens/profile-setup-screen';
import { PasswordResetScreen } from './src/screens/password-reset-screen';
import { ReviewScreen } from './src/screens/review-screen';
import { colors, spacing } from './src/theme';
import type { MobileDashboardData } from './src/types/models';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dashboard, setDashboard] = useState<MobileDashboardData | null>(null);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [reviewPayslipId, setReviewPayslipId] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const consumeAuthRedirect = useCallback(async (url: string) => {
    if (!supabase) return;
    const redirect = parseAuthRedirect(url);
    if (!redirect) return;

    if (redirect.errorDescription) {
      Alert.alert('That link is no longer available', 'Request a fresh confirmation or password-reset link, then try again.');
      return;
    }

    try {
      const result = redirect.code
        ? await supabase.auth.exchangeCodeForSession(redirect.code)
        : redirect.accessToken && redirect.refreshToken
          ? await supabase.auth.setSession({ access_token: redirect.accessToken, refresh_token: redirect.refreshToken })
          : null;
      if (!result?.data.session || result.error) throw result?.error ?? new Error('No session returned');
      if (redirect.type === 'recovery') setPasswordRecovery(true);
    } catch {
      Alert.alert('That link could not be used', 'Request a fresh confirmation or password-reset link, then try again.');
    }
  }, []);

  const refreshDashboard = useCallback(async (userId: string, showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setDashboardError(null);
    try {
      const nextDashboard = await loadDashboard(userId);
      setDashboard(nextDashboard);
    } catch {
      setDashboard(null);
      setDashboardError('We could not load your payday data. Check your connection and try again.');
    } finally {
      setDashboardReady(true);
      if (showRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthReady(true);
      return () => undefined;
    }

    let mounted = true;
    const stopTokenRefresh = manageSupabaseTokenRefresh();
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    }).catch(() => {
      if (!mounted) return;
      setSession(null);
      setAuthReady(true);
    });
    const { data: authState } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (_event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      authState.subscription.unsubscribe();
      stopTokenRefresh();
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return () => undefined;

    let mounted = true;
    void Linking.getInitialURL().then((url) => {
      if (mounted && url) void consumeAuthRedirect(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void consumeAuthRedirect(url);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [consumeAuthRedirect]);

  useEffect(() => {
    if (!session) {
      setDashboard(null);
      setDashboardError(null);
      setDashboardReady(false);
      setReviewPayslipId(null);
      setActiveTab('home');
      return;
    }

    if (passwordRecovery) {
      setDashboard(null);
      setDashboardError(null);
      setDashboardReady(false);
      return;
    }

    setDashboard(null);
    setDashboardError(null);
    setDashboardReady(false);
    void refreshDashboard(session.user.id);
  }, [passwordRecovery, refreshDashboard, session]);

  const changeTab = (nextTab: MainTab) => {
    setReviewPayslipId(null);
    setActiveTab(nextTab);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const handleAccountDeleted = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  };

  const handlePasswordRecoveryCancelled = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPasswordRecovery(false);
  };

  const handleDashboardChanged = async () => {
    if (session) await refreshDashboard(session.user.id, true);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.appViewport}>
        <View style={styles.appFrame}>
          {!hasSupabaseConfig || !supabase || !authReady ? <BootScreen /> : null}
          {hasSupabaseConfig && supabase && authReady && !session ? <AuthScreen /> : null}
          {hasSupabaseConfig && supabase && authReady && session && passwordRecovery ? (
            <PasswordResetScreen
              onCancel={handlePasswordRecoveryCancelled}
              onComplete={() => setPasswordRecovery(false)}
            />
          ) : null}
          {hasSupabaseConfig && supabase && authReady && session && !passwordRecovery ? (
            <AuthenticatedApp
              activeTab={activeTab}
              dashboard={dashboard}
              dashboardError={dashboardError}
              dashboardReady={dashboardReady}
              onAccountDeleted={handleAccountDeleted}
              onDashboardChanged={handleDashboardChanged}
              onOpenReview={setReviewPayslipId}
              onRefresh={() => refreshDashboard(session.user.id, true)}
              onSignOut={handleSignOut}
              onTabChange={changeTab}
              refreshing={refreshing}
              reviewPayslipId={reviewPayslipId}
              userId={session.user.id}
              user={session.user}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

function AuthenticatedApp({
  activeTab,
  dashboard,
  dashboardError,
  dashboardReady,
  onAccountDeleted,
  onDashboardChanged,
  onOpenReview,
  onRefresh,
  onSignOut,
  onTabChange,
  refreshing,
  reviewPayslipId,
  user,
  userId,
}: {
  activeTab: MainTab;
  dashboard: MobileDashboardData | null;
  dashboardError: string | null;
  dashboardReady: boolean;
  onAccountDeleted: () => Promise<void>;
  onDashboardChanged: () => Promise<void>;
  onOpenReview: (payslipId: string) => void;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onTabChange: (tab: MainTab) => void;
  refreshing: boolean;
  reviewPayslipId: string | null;
  user: NonNullable<Session['user']>;
  userId: string;
}) {
  const currency = dashboard?.profile?.currency ?? (dashboard?.profile?.country === 'Ireland' ? 'EUR' : 'GBP');

  if (reviewPayslipId) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <ReviewScreen
          currency={currency}
          onClose={() => onTabChange('paycheck')}
          onComplete={() => {
            return onDashboardChanged().then(() => onTabChange('home'));
          }}
          payslipId={reviewPayslipId}
        />
      </SafeAreaView>
    );
  }

  if (!dashboardReady) {
    return <BootScreen message="Getting your payday view ready…" />;
  }

  if (dashboardError || !dashboard) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <LoadFailure onRetry={onRefresh} onSignOut={onSignOut} />
      </SafeAreaView>
    );
  }

  if (dashboard.profile?.country !== 'UK' && dashboard.profile?.country !== 'Ireland') {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <ProfileSetupScreen firstName={dashboard.profile?.first_name} onComplete={onRefresh} userId={userId} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.content}>
        {activeTab === 'home' ? (
          <HomeScreen data={dashboard} onOpenReview={onOpenReview} onRefresh={onRefresh} onTabChange={onTabChange} refreshing={refreshing} />
        ) : null}
        {activeTab === 'paycheck' ? (
          <PaycheckScreen
            onComplete={onDashboardChanged}
            onRefresh={onRefresh}
            onReview={onOpenReview}
            pendingPayslips={dashboard.pendingPayslips}
            userId={userId}
          />
        ) : null}
        {activeTab === 'plan' ? (
          <PlanScreen
            data={dashboard}
            onOpenPaycheck={() => onTabChange('paycheck')}
            onOpenReview={onOpenReview}
            onSaved={onDashboardChanged}
            userId={userId}
          />
        ) : null}
        {activeTab === 'me' ? (
          <MeScreen
            onAccountDeleted={onAccountDeleted}
            onProfileChanged={onDashboardChanged}
            onSignOut={onSignOut}
            profile={dashboard.profile}
            user={user}
          />
        ) : null}
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.tabSafeArea}>
        <BottomTabs active={activeTab} onChange={onTabChange} />
      </SafeAreaView>
    </View>
  );
}

function BootScreen({ message }: { message?: string }) {
  const missingConnection = !hasSupabaseConfig;
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.boot}>
      <AquaCorner />
      <View style={styles.bootInner}>
        <Brand />
        <View style={styles.bootMessage}>
          {missingConnection ? (
            <>
              <Text style={styles.bootTitle}>This build needs its app connection.</Text>
              <Text style={styles.bootText}>Add the public Supabase URL and publishable key to the mobile app’s local configuration, then restart it.</Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.violet} size="large" />
              <Text style={styles.bootTitle}>{message || 'Opening Payslip Insights…'}</Text>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function LoadFailure({ onRetry, onSignOut }: { onRetry: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const [tryingAgain, setTryingAgain] = useState(false);
  const retry = async () => {
    setTryingAgain(true);
    try {
      await onRetry();
    } finally {
      setTryingAgain(false);
    }
  };

  return (
    <View style={styles.failure}>
      <AquaCorner />
      <Brand />
      <View style={styles.failureCopy}>
        <Text style={styles.failureTitle}>We could not load your payday view.</Text>
        <Text style={styles.failureText}>Nothing has been changed. Check your connection and try again.</Text>
      </View>
      <PrimaryButton disabled={tryingAgain} label={tryingAgain ? 'Trying again…' : 'Try again'} onPress={retry} />
      <QuietButton label="Sign out" onPress={() => void onSignOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  appViewport: { backgroundColor: Platform.OS === 'web' ? '#F6F7FC' : colors.background, flex: 1 },
  appFrame: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    flex: 1,
    maxWidth: 560,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    ...(Platform.OS === 'web' ? { boxShadow: '0px 18px 60px rgba(23, 21, 93, 0.12)' } : {}),
  },
  root: { backgroundColor: colors.background, flex: 1 },
  content: { flex: 1 },
  tabSafeArea: { backgroundColor: colors.white },
  boot: { backgroundColor: colors.background, flex: 1, position: 'relative' },
  bootInner: { flex: 1, justifyContent: 'space-between', padding: spacing.lg, paddingTop: 34, zIndex: 1 },
  bootMessage: { alignItems: 'flex-start', gap: spacing.md, marginBottom: 72 },
  bootTitle: { color: colors.navy, fontSize: 34, fontWeight: '900', letterSpacing: -1.4, lineHeight: 39, maxWidth: 330 },
  bootText: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 330 },
  failure: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg, position: 'relative' },
  failureCopy: { gap: spacing.sm, marginTop: spacing.xxl },
  failureTitle: { color: colors.navy, fontSize: 34, fontWeight: '900', letterSpacing: -1.4, lineHeight: 39 },
  failureText: { color: colors.muted, fontSize: 16, lineHeight: 23 },
});
