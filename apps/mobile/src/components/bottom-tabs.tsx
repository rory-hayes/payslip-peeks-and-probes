import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export type MainTab = 'home' | 'paycheck' | 'plan' | 'me';

const items: Array<{ id: MainTab; label: string; activeIcon: keyof typeof Ionicons.glyphMap; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'paycheck', label: 'Payslips', icon: 'document-text-outline', activeIcon: 'document-text' },
  { id: 'plan', label: 'Plan', icon: 'pie-chart-outline', activeIcon: 'pie-chart' },
  { id: 'me', label: 'Me', icon: 'person-outline', activeIcon: 'person' },
];

export function BottomTabs({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.shell}>
      {items.map((item) => {
        const selected = active === item.id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            key={item.id}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => [styles.item, selected && styles.itemSelected, pressed && styles.itemPressed]}
          >
            <Ionicons color={selected ? colors.violet : colors.muted} name={selected ? item.activeIcon : item.icon} size={23} />
            <Text style={[styles.label, selected && styles.labelSelected]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.white,
    borderTopColor: colors.lavenderLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  item: { alignItems: 'center', flex: 1, gap: 3, minHeight: 52, justifyContent: 'center' },
  itemSelected: { borderTopColor: colors.violet, borderTopWidth: 3, marginTop: -9, paddingTop: 6 },
  itemPressed: { opacity: 0.65 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  labelSelected: { color: colors.violet, fontWeight: '800' },
});
