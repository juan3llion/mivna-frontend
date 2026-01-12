// Environment variable validation
// This file validates that all required environment variables are set

const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
] as const

function validateEnv(): void {
    const missing: string[] = []

    for (const envVar of requiredEnvVars) {
        if (!import.meta.env[envVar]) {
            missing.push(envVar)
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n${missing.join('\n')}\n\n` +
            `Please create a .env file based on .env.example`
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
