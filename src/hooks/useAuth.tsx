import { useState, useEffect, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Profile } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

interface AuthContextType {
    user: User | null
    profile: Profile | null
    session: Session | null
    loading: boolean
    signInWithGitHub: () => Promise<void>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchProfile = async (userId: string, isMounted: boolean = true) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (!isMounted) return

            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
                const { data: userData } = await supabase.auth.getUser()
                if (!isMounted) return

                const newProfile = {
                    id: userId,
                    github_username: userData.user?.user_metadata?.user_name || null,
                    avatar_url: userData.user?.user_metadata?.avatar_url || null,
                    diagrams_generated: 0,
                    readmes_generated: 0,
                }

                const { data: createdProfile } = await supabase
                    .from('profiles')
                    .insert(newProfile)
                    .select()
                    .single()

                if (isMounted) {
                    setProfile(createdProfile)
                }
            } else if (data && isMounted) {
                setProfile(data)
            }
        } catch (error) {
            // Silently handle errors when component is unmounted
            if (!isMounted) return
            console.error('Error fetching profile:', error)
        }
    }

    useEffect(() => {
        let isMounted = true

        // Helper: Get cached session from localStorage immediately
        const getCachedSession = (): { session: Session | null; needsRefresh: boolean } => {
            try {
                // Check for Supabase token in localStorage (check both default and custom keys)
                const keys = Object.keys(localStorage).filter(k =>
                    k.includes('auth-token') || k.includes('supabase')
                )

                for (const key of keys) {
                    const stored = localStorage.getItem(key)
                    if (stored) {
                        try {
                            const parsed = JSON.parse(stored)
                            // Check if it has access_token (valid session structure)
                            if (parsed.access_token && parsed.user) {
                                // Check if token is expired
                                const expiresAt = parsed.expires_at
                                const isExpired = expiresAt ? (expiresAt * 1000) < Date.now() : false

                                return {
                                    session: {
                                        access_token: parsed.access_token,
                                        refresh_token: parsed.refresh_token,
                                        expires_at: parsed.expires_at,
                                        expires_in: parsed.expires_in,
                                        token_type: 'bearer',
                                        user: parsed.user,
                                        provider_token: parsed.provider_token,
                                        provider_refresh_token: parsed.provider_refresh_token,
                                    } as Session,
                                    needsRefresh: isExpired
                                }
                            }
                        } catch { /* ignore parse errors */ }
                    }
                }
            } catch (e) {
                console.warn('Failed to read cached session:', e)
            }
            return { session: null, needsRefresh: false }
        }

        // Initialize session from cache first (instant), then validate
        const initSession = async () => {
            // Step 1: Immediately use cached session for fast UI
            const { session: cachedSession, needsRefresh } = getCachedSession()

            if (cachedSession && !needsRefresh) {
                console.log('✅ Found cached session, using immediately')
                setSession(cachedSession)
                setUser(cachedSession.user as User | null)
                setLoading(false)

                // Fetch profile in background
                if (cachedSession.user) {
                    fetchProfile(cachedSession.user.id, isMounted).catch(console.error)
                }

                // Validate session in background (don't block UI)
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (!isMounted) return
                    if (session) {
                        // Update with fresh session
                        setSession(session)
                        setUser(session.user as User | null)
                    } else {
                        // Session was invalid, clear state
                        console.warn('Cached session was invalid, clearing')
                        setSession(null)
                        setUser(null)
                        setProfile(null)
                    }
                }).catch(() => {
                    // Ignore validation errors, keep cached session
                    console.warn('Background session validation failed, keeping cached session')
                })

                return
            }

            // Step 2: No cached session - try to get fresh session with timeout
            console.log('No cached session, checking with Supabase...')
            try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 5000)

                const { data: { session } } = await supabase.auth.getSession()
                clearTimeout(timeoutId)

                if (!isMounted) return

                setSession(session)
                setUser(session?.user as User | null)
                if (session?.user) {
                    await fetchProfile(session.user.id, isMounted)
                }
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return
                }
                console.error('Error getting session:', error)
                if (isMounted) {
                    setSession(null)
                    setUser(null)
                    setProfile(null)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        initSession()


        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange
            (
                async (_event, session) => {
                    if (!isMounted) return

                    setSession(session)
                    setUser(session?.user as User | null)
                    if (session?.user) {
                        await fetchProfile(session.user.id, isMounted)
                    } else {
                        setProfile(null)
                    }
                    setLoading(false)
                }
            )

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const signInWithGitHub = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                scopes: 'repo read:user',
                redirectTo: `${window.location.origin}/dashboard`,
            },
        })
        if (error) throw error
    }

    const signOut = async () => {
        try {
            // 1. Sign out from Supabase
            await supabase.auth.signOut()

            // 2. Clear all component state
            setUser(null)
            setProfile(null)
            setSession(null)

            // 3. Clear all localStorage (including any cached auth data)
            localStorage.clear()

            // 4. Clear all sessionStorage
            sessionStorage.clear()

            // 5. Log for debugging
            console.log('✅ Logged out successfully - all session data cleared')

            // Note: GitHub OAuth consent is still cached in the browser.
            // To fully logout from GitHub, user needs to go to:
            // https://github.com/settings/applications
            // and revoke Mivna's access
        } catch (error) {
            console.error('Error during logout:', error)
            // Still clear local state even if Supabase logout fails
            setUser(null)
            setProfile(null)
            setSession(null)
            localStorage.clear()
            sessionStorage.clear()
        }
    }

    return (
        <AuthContext.Provider value={{ user, profile, session, loading, signInWithGitHub, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
