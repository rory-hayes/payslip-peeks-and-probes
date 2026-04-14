import { supabase } from '@/integrations/supabase/client';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEvent {
  level: LogLevel;
  event_type: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an event to the audit_events table for monitoring.
 * Fire-and-forget — never throws.
 */
export async function logEvent({ level, event_type, message, metadata }: LogEvent) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Can't log without a user (RLS requires user_id)

    await supabase.from('audit_events').insert({
      user_id: user.id,
      event_type: `${level}:${event_type}`,
      entity_type: 'system',
      metadata_json: { message, ...metadata, timestamp: new Date().toISOString() },
    });
  } catch {
    // Swallow — logging should never break the app
    console.error(`[logger] Failed to log: ${event_type} - ${message}`);
  }
}

/** Convenience wrappers */
export const logInfo = (event_type: string, message: string, metadata?: Record<string, unknown>) =>
  logEvent({ level: 'info', event_type, message, metadata });

export const logWarn = (event_type: string, message: string, metadata?: Record<string, unknown>) =>
  logEvent({ level: 'warn', event_type, message, metadata });

export const logError = (event_type: string, message: string, metadata?: Record<string, unknown>) =>
  logEvent({ level: 'error', event_type, message, metadata });
