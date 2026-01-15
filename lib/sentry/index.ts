// CocoaTrack V2 - Sentry Configuration
// Error tracking and performance monitoring
// Note: Install @sentry/nextjs when ready to enable: pnpm add @sentry/nextjs

// Stub types when Sentry is not installed
type SentrySpan = { end: () => void };
type SentryEvent = Record<string, unknown>;
type SentryHint = { originalException?: unknown };

// Sentry stub - replace with real import when installed
const Sentry = {
  init: (_config: Record<string, unknown>) => {},
  captureException: (_error: unknown, _context?: Record<string, unknown>) => {},
  captureMessage: (_message: string, _options?: Record<string, unknown>) => {},
  setUser: (_user: Record<string, unknown> | null) => {},
  addBreadcrumb: (_breadcrumb: Record<string, unknown>) => {},
  startInactiveSpan: (_options: Record<string, unknown>): SentrySpan | undefined => undefined,
  replayIntegration: () => ({}),
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Sentry for client-side
 * Called in app/providers.tsx
 */
export function initSentryClient(): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      
      // Environment
      environment: process.env.NODE_ENV,
      
      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Session replay (optional)
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Integrations
      integrations: [
        Sentry.replayIntegration(),
      ],
      
      // Filter out non-critical errors
      beforeSend(event: SentryEvent, hint: SentryHint) {
        // Ignore network errors that are expected
        const error = hint.originalException;
        if (error instanceof Error) {
          // Ignore offline errors
          if (error.message.includes('Failed to fetch') || 
              error.message.includes('NetworkError')) {
            return null;
          }
        }
        return event;
      },
    });
  }
}

// ============================================================================
// ERROR CAPTURE
// ============================================================================

/**
 * Capture an exception with context
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    // Log to console in development
    console.error('Sentry would capture:', error, context);
  }
}

/**
 * Capture a message with level
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  } else {
    console.log(`[${level}] ${message}`, context);
  }
}

// ============================================================================
// USER CONTEXT
// ============================================================================

/**
 * Set user context for error tracking
 */
export function setUser(user: {
  id: string;
  email?: string;
  role?: string;
  cooperative_id?: string;
} | null): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        // Custom data
        role: user.role,
        cooperative_id: user.cooperative_id,
      });
    } else {
      Sentry.setUser(null);
    }
  }
}

// ============================================================================
// BREADCRUMBS
// ============================================================================

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

// ============================================================================
// PERFORMANCE
// ============================================================================

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string
): SentrySpan | undefined {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return Sentry.startInactiveSpan({
      name,
      op,
    });
  }
  return undefined;
}

// ============================================================================
// SYNC ERROR TRACKING
// ============================================================================

/**
 * Track sync operation errors
 */
export function trackSyncError(
  operation: string,
  error: Error | unknown,
  context: {
    table: string;
    recordId: string;
    retryCount: number;
  }
): void {
  captureException(error, {
    operation,
    ...context,
    tags: {
      feature: 'offline-sync',
    },
  });
}

/**
 * Track sync queue overflow
 */
export function trackSyncQueueOverflow(queueSize: number): void {
  captureMessage('Sync queue overflow detected', 'warning', {
    queueSize,
    tags: {
      feature: 'offline-sync',
      alert: 'queue-overflow',
    },
  });
}

// ============================================================================
// AUTH ERROR TRACKING
// ============================================================================

/**
 * Track authentication failures
 */
export function trackAuthFailure(
  type: 'login' | 'token_refresh' | 'session_expired',
  error?: Error | unknown
): void {
  if (error) {
    captureException(error, {
      authFailureType: type,
      tags: {
        feature: 'authentication',
      },
    });
  } else {
    captureMessage(`Auth failure: ${type}`, 'warning', {
      authFailureType: type,
      tags: {
        feature: 'authentication',
      },
    });
  }
}

// Re-export Sentry for direct access if needed
export { Sentry };
