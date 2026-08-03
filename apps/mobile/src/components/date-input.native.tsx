import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../lib/format';
import { colors, radius, spacing } from '../theme';

type FieldProvenance = {
  label: string;
  tone: 'auto' | 'edited' | 'missing' | 'manual';
};

export function DateInput({
  label,
  value,
  onChangeText,
  editable = true,
  provenance,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  provenance?: FieldProvenance;
}) {
  const [open, setOpen] = useState(false);
  const date = parseDate(value) ?? new Date();
  const displayValue = value ? formatDate(value) : 'Choose a date';

  const onChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && nextDate) onChangeText(toIsoDate(nextDate));
  };

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {provenance ? <Text style={[styles.provenance, provenanceStyle(provenance.tone)]}>{provenance.label}</Text> : <Text style={styles.hint}>{editable ? 'Choose a date' : 'Confirmed payslip'}</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={provenance ? `${label}, ${provenance.label}` : label}
        accessibilityState={{ disabled: !editable }}
        disabled={!editable}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.input, !editable && styles.inputReadOnly, pressed && editable && styles.inputPressed]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{displayValue}</Text>
        <Ionicons color={editable ? colors.violet : colors.muted} name="calendar-outline" size={21} />
      </Pressable>
      {open ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            accentColor={colors.violet}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            mode="date"
            onChange={onChange}
            themeVariant="light"
            value={date}
          />
          {Platform.OS === 'ios' ? <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

function provenanceStyle(tone: FieldProvenance['tone']) {
  if (tone === 'edited') return styles.provenanceEdited;
  if (tone === 'missing') return styles.provenanceMissing;
  if (tone === 'manual') return styles.provenanceManual;
  return styles.provenanceAuto;
}

function parseDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  field: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  provenance: { borderRadius: radius.pill, color: colors.navy, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 3 },
  provenanceAuto: { backgroundColor: colors.aquaSoft },
  provenanceEdited: { backgroundColor: colors.lavender },
  provenanceMissing: { backgroundColor: colors.coralSoft },
  provenanceManual: { backgroundColor: colors.greenSoft },
  input: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: radius.small, flexDirection: 'row', justifyContent: 'space-between', minHeight: 49, paddingHorizontal: spacing.sm },
  inputReadOnly: { backgroundColor: colors.aquaSoft },
  inputPressed: { opacity: 0.72 },
  value: { color: colors.navy, fontSize: 17, fontWeight: '700' },
  placeholder: { color: colors.muted },
  pickerWrap: { marginTop: spacing.sm },
  done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { color: colors.violet, fontSize: 15, fontWeight: '800' },
});
