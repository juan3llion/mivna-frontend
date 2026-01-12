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

        // Get initial session
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!isMounted) return

                setSession(session)
                setUser(session?.user as User | null)
                if (session?.user) {
                    await fetchProfile(session.user.id, isMounted)
                }
            } catch (error) {
                // Ignore AbortError as it's expected during navigation
                if (error instanceof Error && error.name === 'AbortError') {
                    return
                }
                console.error('Error getting session:', error)
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        initSession()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
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
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setSession(null)
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
