import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry error tracking for production environments
 * 
 * Only activates when VITE_SENTRY_DSN is set and MODE is production
 * Captures unhandled errors, tracks performance, and provides session replay
 */
export function initSentry() {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN
    const environment = import.meta.env.MODE

    // Allow Sentry in both development (for testing) and production
    if (sentryDsn) {
        Sentry.init({
            dsn: sentryDsn,
            environment,
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    maskAllText: false,
                    blockAllMedia: false,
                }),
            ],
            // Performance Monitoring
            tracesSampleRate: 1.0, // Capture 100% of transactions
            // Session Replay
            replaysSessionSampleRate: 0.1, // 10% of sessions
            replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
        })

        console.info(`✅ Sentry error tracking initialized (${environment} mode)`)
    }
}

/**
 * Manually capture an error to Sentry
 * 
 * @param error - Error object to capture
 * @param context - Additional context about the error
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
    if (context) {
        Sentry.setContext('additional', context)
    }
    Sentry.captureException(error)
}

/**
 * Track a custom event in Sentry
 * 
 * @param message - Event name/message
 * @param level - Severity level
 */
export function trackEvent(message: string, level: Sentry.SeverityLevel = 'info') {
    Sentry.captureMessage(message, level)
}

export { Sentry }
