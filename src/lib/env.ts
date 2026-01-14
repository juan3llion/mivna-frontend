// Environment variable validation
// This file validates that all required environment variables are set

const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
] as const

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
        if (!import.meta.env[envVar]) {
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
}

// Run validation immediately on import
validateEnv()

// Export validated environment variables with proper types
export const env = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    IS_DEV: import.meta.env.DEV,
    IS_PROD: import.meta.env.PROD,
} as const
