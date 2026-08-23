const STORAGE_FILENAME_MAX_LENGTH = 96;
const SAFE_STORAGE_FILENAME_CHARACTERS = /[^A-Za-z0-9._-]+/g;
const STORAGE_FILENAME_SEPARATORS = /[\\/]+/g;

export const PAYSLIP_ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const PAYSLIP_MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface IssuedPayslipUpload {
  sessionId: string;
  path: string;
  token: string;
  contentType: (typeof PAYSLIP_ALLOWED_FILE_TYPES)[number];
  expiresAt: string;
}

export function sanitizePayslipDisplayFileName(fileName: string): string {
  const lastPathSegment = fileName
    .normalize('NFKC')
    .replace(STORAGE_FILENAME_SEPARATORS, '/')
    .split('/')
    .pop() ?? '';

  const sanitized = lastPathSegment
    .replace(SAFE_STORAGE_FILENAME_CHARACTERS, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, STORAGE_FILENAME_MAX_LENGTH);

  return sanitized || 'payslip';
}

export function isOwnedPayslipObjectPath(userId: string, filePath: string): boolean {
  const prefix = `${userId}/`;
  const filename = filePath.slice(prefix.length);
  return /^[A-Fa-f0-9]{8}-(?:[A-Fa-f0-9]{4}-){3}[A-Fa-f0-9]{12}$/.test(userId)
    && filePath.startsWith(prefix)
    && filename.length > 0
    && filename !== '.'
    && filename !== '..'
    && !filename.includes('/')
    && !filename.includes('\\')
    && !filename.includes('\0');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseIssuedPayslipUpload(value: unknown, userId: string): IssuedPayslipUpload | null {
  if (!isRecord(value)) return null;
  const { sessionId, path, token, contentType, expiresAt } = value;
  if (
    !isUuid(sessionId)
    || typeof path !== 'string'
    || !isOwnedPayslipObjectPath(userId, path)
    || typeof token !== 'string'
    || token.length < 16
    || typeof contentType !== 'string'
    || !PAYSLIP_ALLOWED_FILE_TYPES.includes(contentType as (typeof PAYSLIP_ALLOWED_FILE_TYPES)[number])
    || typeof expiresAt !== 'string'
    || !Number.isFinite(Date.parse(expiresAt))
  ) {
    return null;
  }

  return {
    sessionId,
    path,
    token,
    contentType: contentType as IssuedPayslipUpload['contentType'],
    expiresAt,
  };
}
