// Environment variable validation
// This file validates that all required environment variables are set

const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
] as const

function cleanEnvValue(value: string | undefined): string {
    if (!value) return ''
    // Remove all whitespace, newlines, and tabs
    return value.trim().replace(/[\n\r\t]/g, '')
}

function validateEnv(): void {
    // Debug: Log all env vars in production
    if (import.meta.env.PROD) {
        console.log('🔍 Environment check:', {
            hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
            hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
            mode: import.meta.env.MODE,
            prod: import.meta.env.PROD,
            dev: import.meta.env.DEV,
        })
    }

    const missing: string[] = []

    for (const envVar of requiredEnvVars) {
        const value = cleanEnvValue(import.meta.env[envVar])
        if (!value) {
            missing.push(envVar)
        }
    }

    if (missing.length > 0) {
        const errorMsg = `Missing required environment variables: ${missing.join(', ')}`
        console.error('❌', errorMsg)
        console.error('Available env keys:', Object.keys(import.meta.env))
        throw new Error(
            `${errorMsg}\n\nPlease set these variables in Vercel environment settings.`
        )
    }

    // Validate URL format
    const supabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL)
    try {
        new URL(supabaseUrl)
        console.log('✅ Supabase URL is valid:', supabaseUrl.substring(0, 30) + '...')
    } catch (e) {
        console.error('❌ Invalid Supabase URL:', supabaseUrl)
        throw new Error(`VITE_SUPABASE_URL is not a valid URL: ${supabaseUrl}`)
    }
}

// Run validation immediately on import
validateEnv()

// Export validated environment variables with proper types (cleaned and trimmed)
export const env = {
    SUPABASE_URL: cleanEnvValue(import.meta.env.VITE_SUPABASE_URL),
    SUPABASE_ANON_KEY: cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY),
    IS_DEV: import.meta.env.DEV,
    IS_PROD: import.meta.env.PROD,
} as const
