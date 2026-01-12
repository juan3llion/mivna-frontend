/**
 * Analytics tracking utilities for Mivna
 * 
 * Supports both Plausible (recommended) and Google Analytics
 * Uses Plausible's simple event API for privacy-focused tracking
 */

declare global {
    interface Window {
        plausible?: (event: string, options?: { props: Record<string, string | number> }) => void
    }
}

/**
 * Track a page view (automatically handled by Plausible script)
 * This is mainly for manual tracking if needed
 * 
 * @param path - Page path to track
 */
export function trackPageView(path: string) {
    if (typeof window.plausible !== 'undefined') {
        window.plausible('pageview', { props: { path } })
    }
}

/**
 * Track a custom event
 * 
 * @param eventName - Name of the event (e.g., 'generate_diagram', 'export_png')
 * @param props - Additional properties to track
 * 
 * @example
 * ```ts
 * trackEvent('diagram_generated', { repo: 'example', success: true })
 * trackEvent('export', { format: 'png' })
 * ```
 */
export function trackEvent(eventName: string, props?: Record<string, string | number>) {
    if (typeof window.plausible !== 'undefined') {
        window.plausible(eventName, { props: props || {} })
    }
}

/**
 * Common analytics events for Mivna
 */
export const AnalyticsEvents = {
    // Repository actions
    CONNECT_REPO: 'connect_repository',
    DELETE_REPO: 'delete_repository',

    // Generation actions  
    GENERATE_DIAGRAM: 'generate_diagram',
    GENERATE_README: 'generate_readme',
    UPDATE_DIAGRAM: 'update_diagram',
    UPDATE_README: 'update_readme',

    // Export actions
    EXPORT_PNG: 'export_png',
    EXPORT_SVG: 'export_svg',
    COPY_README: 'copy_readme',

    // UI interactions
    SEARCH_REPOS: 'search_repositories',
    FILTER_REPOS: 'filter_repositories',
    EXPLAIN_NODE: 'explain_node',

    // Auth
    LOGIN: 'login',
    LOGOUT: 'logout',
} as const
