import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const migration = readFileSync(resolve(
  projectRoot,
  'supabase/migrations/20260828190000_confirm_review_line_items.sql',
), 'utf8');

describe('reviewed line-item persistence contract', () => {
  it('keeps confirmation owner-scoped and writes reviewed rows atomically', () => {
    expect(migration).toContain('AND user_id = auth.uid()');
    expect(migration).toContain("AND status = 'needs_review'");
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("'{line_items}'");
    expect(migration).toContain("'reviewed', true");
    expect(migration).toContain('WHEN p_line_items IS NULL THEN normalized_json');
  });

  it('bounds the row count, labels, kinds, money, and source references on the server', () => {
    expect(migration).toContain('jsonb_array_length(p_line_items) > 60');
    expect(migration).toContain('char_length(reviewed_label) > 120');
    expect(migration).toContain("reviewed_kind NOT IN ('earning', 'deduction', 'employer_contribution', 'information')");
    expect(migration).toContain('reviewed_amount > 10000000');
    expect(migration).toContain("source_index') ~ '^[0-9]{1,2}$'");
  });

  it('preserves source evidence only from the server-owned extraction transcript', () => {
    expect(migration).toContain("existing_normalized_json -> 'line_items' -> source_index");
    expect(migration).toContain("char_length(original_line_item ->> 'evidence') <= 300");
    expect(migration).not.toContain("candidate_line_item ->> 'evidence'");
  });
});
