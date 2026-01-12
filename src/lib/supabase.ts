import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)

export type User = {
    id: string
    email?: string
    user_metadata: {
        avatar_url?: string
        user_name?: string
        full_name?: string
    }
}

export type Profile = {
    id: string
    github_username: string | null
    avatar_url: string | null
    diagrams_generated: number
    readmes_generated: number
    created_at: string
}

export type Repository = {
    id: string
    user_id: string
    github_repo_id: number
    repo_name: string
    repo_url: string
    repo_owner: string
    diagram_code: string | null
    readme_content: string | null
    last_scanned_at: string | null
    status: 'pending' | 'processing' | 'ready' | 'error'
    created_at: string
    updated_at: string
}
