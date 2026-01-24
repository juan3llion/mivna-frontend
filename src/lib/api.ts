/**
 * Centralized API utilities with retry logic and error handling
 * Enterprise-grade resilience for all API operations
 */

// Retry configuration
interface RetryConfig {
    maxRetries: number
    baseDelayMs: number
    maxDelayMs: number
    retryOn: (error: Error, attempt: number) => boolean
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    retryOn: (error, attempt) => {
        // Retry on network errors and 5xx server errors
        if (error.message.includes('fetch') || error.message.includes('network')) {
            return true
        }
        // Don't retry on auth errors (401, 403)
        if (error.message.includes('401') || error.message.includes('403')) {
            return false
        }
        // Don't retry on client errors (400, 404)
        if (error.message.includes('400') || error.message.includes('404')) {
            return false
        }
        // Retry on server errors (500, 502, 503, 504)
        if (error.message.includes('500') || error.message.includes('502') ||
            error.message.includes('503') || error.message.includes('504')) {
            return true
        }
        // Retry on timeout
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            return true
        }
        return attempt < 2 // Allow 1 more retry for unknown errors
    }
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
    const exponentialDelay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt),
        config.maxDelayMs
    )
    // Add random jitter (±25%) to prevent thundering herd
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5)
    return Math.floor(exponentialDelay + jitter)
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
    let lastError: Error = new Error('Unknown error')

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            const isLastAttempt = attempt === finalConfig.maxRetries
            const shouldRetry = !isLastAttempt && finalConfig.retryOn(lastError, attempt)

            if (shouldRetry) {
                const delay = calculateBackoff(attempt, finalConfig)
                console.log(`⚠️ Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${delay}ms:`, lastError.message)
                await sleep(delay)
            } else {
                break
            }
        }
    }

    throw lastError
}

/**
 * Wrapper for fetch with automatic retry
 */
export async function fetchWithRetry(
    url: string,
    options?: RequestInit,
    retryConfig?: Partial<RetryConfig>
): Promise<Response> {
    return withRetry(async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            })
            clearTimeout(timeoutId)

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            return response
        } catch (error) {
            clearTimeout(timeoutId)
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timeout')
            }
            throw error
        }
    }, retryConfig)
}

// Error types for better categorization (using const object for erasableSyntaxOnly compatibility)
export const ApiErrorType = {
    NETWORK: 'NETWORK',
    AUTH: 'AUTH',
    RATE_LIMIT: 'RATE_LIMIT',
    SERVER: 'SERVER',
    CLIENT: 'CLIENT',
    TIMEOUT: 'TIMEOUT',
    UNKNOWN: 'UNKNOWN'
} as const

export type ApiErrorType = typeof ApiErrorType[keyof typeof ApiErrorType]

export class ApiError extends Error {
    type: ApiErrorType
    statusCode?: number
    isRetryable: boolean

    constructor(message: string, type: ApiErrorType, statusCode?: number) {
        super(message)
        this.name = 'ApiError'
        this.type = type
        this.statusCode = statusCode
        this.isRetryable =
            type === ApiErrorType.NETWORK ||
            type === ApiErrorType.SERVER ||
            type === ApiErrorType.TIMEOUT
    }

    static fromError(error: unknown): ApiError {
        if (error instanceof ApiError) {
            return error
        }

        const message = error instanceof Error ? error.message : String(error)

        // Categorize the error
        if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
            return new ApiError(message, ApiErrorType.NETWORK)
        }
        if (message.includes('401') || message.includes('Unauthorized')) {
            return new ApiError(message, ApiErrorType.AUTH, 401)
        }
        if (message.includes('403') || message.includes('Forbidden')) {
            return new ApiError(message, ApiErrorType.AUTH, 403)
        }
        if (message.includes('429') || message.includes('rate limit')) {
            return new ApiError(message, ApiErrorType.RATE_LIMIT, 429)
        }
        if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
            return new ApiError(message, ApiErrorType.SERVER, parseInt(message.match(/\d{3}/)?.[0] || '500'))
        }
        if (message.includes('400') || message.includes('404')) {
            return new ApiError(message, ApiErrorType.CLIENT, parseInt(message.match(/\d{3}/)?.[0] || '400'))
        }
        if (message.includes('timeout') || message.includes('TIMEOUT') || message.includes('AbortError')) {
            return new ApiError(message, ApiErrorType.TIMEOUT)
        }

        return new ApiError(message, ApiErrorType.UNKNOWN)
    }
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
    const apiError = ApiError.fromError(error)

    switch (apiError.type) {
        case ApiErrorType.NETWORK:
            return 'Unable to connect. Please check your internet connection and try again.'
        case ApiErrorType.AUTH:
            return 'Your session has expired. Please log in again.'
        case ApiErrorType.RATE_LIMIT:
            return 'Too many requests. Please wait a moment and try again.'
        case ApiErrorType.SERVER:
            return 'Server error. Our team has been notified. Please try again later.'
        case ApiErrorType.TIMEOUT:
            return 'Request timed out. Please try again.'
        case ApiErrorType.CLIENT:
            return 'Invalid request. Please refresh the page and try again.'
        default:
            return 'Something went wrong. Please try again.'
    }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    return ApiError.fromError(error).isRetryable
}
