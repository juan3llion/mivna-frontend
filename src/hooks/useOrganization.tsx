import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Organization {
    id: string
    name: string
    slug: string
    avatar_url: string | null
    owner_id: string
    created_at: string
}

export interface OrgMember {
    id: string
    org_id: string
    user_id: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    invited_at: string
    joined_at: string | null
    // Joined profile data
    profile?: {
        github_username: string
        avatar_url: string
    }
}

interface OrganizationContextType {
    // Current organization context (null = personal)
    currentOrg: Organization | null
    setCurrentOrg: (org: Organization | null) => void

    // User's organizations
    userOrgs: Organization[]
    loading: boolean

    // Actions
    createOrg: (name: string, slug: string) => Promise<Organization | null>
    updateOrg: (orgId: string, updates: Partial<Organization>) => Promise<boolean>
    deleteOrg: (orgId: string) => Promise<boolean>

    // Member management
    getMembers: (orgId: string) => Promise<OrgMember[]>
    inviteMember: (orgId: string, email: string, role: OrgMember['role']) => Promise<boolean>
    updateMemberRole: (memberId: string, role: OrgMember['role']) => Promise<boolean>
    removeMember: (memberId: string) => Promise<boolean>

    // Helpers
    userRole: (orgId: string) => OrgMember['role'] | null
    canManageMembers: boolean
    isPersonalContext: boolean

    // Refresh
    refresh: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | null>(null)

export function OrganizationProvider({ children }: { children: ReactNode }) {
    const { user, profile } = useAuth()
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
    const [userOrgs, setUserOrgs] = useState<Organization[]>([])
    const [memberships, setMemberships] = useState<OrgMember[]>([])
    const [loading, setLoading] = useState(true)

    const fetchUserOrgs = useCallback(async () => {
        if (!user) {
            setUserOrgs([])
            setMemberships([])
            setLoading(false)
            return
        }

        try {
            // Fetch organizations where user is a member
            const { data: memberData, error: memberError } = await supabase
                .from('org_members')
                .select('*, organizations(*)')
                .eq('user_id', user.id)

            if (memberError) throw memberError

            if (memberData) {
                const orgs = memberData
                    .filter(m => m.organizations)
                    .map(m => m.organizations as Organization)
                setUserOrgs(orgs)
                setMemberships(memberData.map(m => ({
                    id: m.id,
                    org_id: m.org_id,
                    user_id: m.user_id,
                    role: m.role,
                    invited_at: m.invited_at,
                    joined_at: m.joined_at
                })))
            }
        } catch (err) {
            console.error('Failed to fetch organizations:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchUserOrgs()
    }, [fetchUserOrgs])

    // Persist org selection in localStorage
    useEffect(() => {
        if (currentOrg) {
            localStorage.setItem('mivna_current_org', currentOrg.id)
        } else {
            localStorage.removeItem('mivna_current_org')
        }
    }, [currentOrg])

    // Restore org selection on load
    useEffect(() => {
        const savedOrgId = localStorage.getItem('mivna_current_org')
        if (savedOrgId && userOrgs.length > 0) {
            const org = userOrgs.find(o => o.id === savedOrgId)
            if (org) setCurrentOrg(org)
        }
    }, [userOrgs])

    const createOrg = async (name: string, slug: string): Promise<Organization | null> => {
        if (!user) return null

        // Check subscription limits
        // Need to access profile from useAuth, let's get it from the context directly
        // Note: We need to update the destructuring at the top of the component

        const tier = profile?.subscription_tier || 'free'
        const limit = tier === 'free' ? 1 : (tier === 'pro' ? 5 : Infinity)

        // Count owned organizations
        const ownedOrgs = userOrgs.filter(o => o.owner_id === user.id)

        if (ownedOrgs.length >= limit) {
            // We'll throw an error that can be caught by the UI
            throw new Error(`You've reached the limit of ${limit} organization${limit === 1 ? '' : 's'} for the ${tier} plan. Upgrade to Pro for more.`)
        }

        try {
            const { data, error } = await supabase
                .from('organizations')
                .insert({
                    name,
                    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    owner_id: user.id
                })
                .select()
                .single()

            if (error) throw error

            await fetchUserOrgs() // Refresh list
            return data
        } catch (err) {
            console.error('Failed to create organization:', err)
            return null
        }
    }

    const updateOrg = async (orgId: string, updates: Partial<Organization>): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('organizations')
                .update(updates)
                .eq('id', orgId)

            if (error) throw error
            await fetchUserOrgs()
            return true
        } catch (err) {
            console.error('Failed to update organization:', err)
            return false
        }
    }

    const deleteOrg = async (orgId: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('organizations')
                .delete()
                .eq('id', orgId)

            if (error) throw error

            if (currentOrg?.id === orgId) {
                setCurrentOrg(null)
            }
            await fetchUserOrgs()
            return true
        } catch (err) {
            console.error('Failed to delete organization:', err)
            return false
        }
    }

    const getMembers = async (orgId: string): Promise<OrgMember[]> => {
        try {
            const { data, error } = await supabase
                .from('org_members')
                .select('*, profiles(github_username, avatar_url)')
                .eq('org_id', orgId)

            if (error) throw error

            return (data || []).map(m => ({
                id: m.id,
                org_id: m.org_id,
                user_id: m.user_id,
                role: m.role,
                invited_at: m.invited_at,
                joined_at: m.joined_at,
                profile: m.profiles
            }))
        } catch (err) {
            console.error('Failed to fetch members:', err)
            return []
        }
    }

    const inviteMember = async (orgId: string, userId: string, role: OrgMember['role']): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('org_members')
                .insert({
                    org_id: orgId,
                    user_id: userId,
                    role,
                    invited_by: user?.id
                })

            if (error) throw error
            return true
        } catch (err) {
            console.error('Failed to invite member:', err)
            return false
        }
    }

    const updateMemberRole = async (memberId: string, role: OrgMember['role']): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('org_members')
                .update({ role })
                .eq('id', memberId)

            if (error) throw error
            return true
        } catch (err) {
            console.error('Failed to update member role:', err)
            return false
        }
    }

    const removeMember = async (memberId: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('org_members')
                .delete()
                .eq('id', memberId)

            if (error) throw error
            return true
        } catch (err) {
            console.error('Failed to remove member:', err)
            return false
        }
    }

    const userRole = (orgId: string): OrgMember['role'] | null => {
        const membership = memberships.find(m => m.org_id === orgId)
        return membership?.role || null
    }

    const canManageMembers = currentOrg
        ? ['owner', 'admin'].includes(userRole(currentOrg.id) || '')
        : false

    const value: OrganizationContextType = {
        currentOrg,
        setCurrentOrg,
        userOrgs,
        loading,
        createOrg,
        updateOrg,
        deleteOrg,
        getMembers,
        inviteMember,
        updateMemberRole,
        removeMember,
        userRole,
        canManageMembers,
        isPersonalContext: currentOrg === null,
        refresh: fetchUserOrgs
    }

    return (
        <OrganizationContext.Provider value={value}>
            {children}
        </OrganizationContext.Provider>
    )
}

export function useOrganization() {
    const context = useContext(OrganizationContext)
    if (!context) {
        throw new Error('useOrganization must be used within an OrganizationProvider')
    }
    return context
}
