import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Repository } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { getUserFriendlyErrorMessage, withRetry } from '../lib/api'
import { trackEvent, AnalyticsEvents } from '../lib/analytics'
import { RepoCardSkeleton } from '../components/Skeleton'
import { ConfirmModal } from '../components/ConfirmModal'
import { DiagramGenerationModal } from '../components/DiagramGenerationModal'
import type { DiagramType } from '../components/DiagramTypeSelector'
import { SearchBar } from '../components/SearchBar'
import { ErrorMessage } from '../components/ErrorMessage'
import { OrgSwitcher } from '../components/OrgSwitcher'
import { GitBranch, FileText, RefreshCw, Plus, LogOut, Zap, Check, Trash2 } from 'lucide-react'


interface GitHubRepo {
    id: number
    name: string
    full_name: string
    html_url: string
    owner: {
        login: string
    }
    private: boolean
    description: string | null
}

// Limit constants (must match backend)
const DIAGRAM_LIMIT = 10
const README_LIMIT = 10

export function Dashboard() {
    const { user, profile, signOut, session, refreshProfile } = useAuth()
    const navigate = useNavigate()
    const [connectedRepos, setConnectedRepos] = useState<Repository[]>([])
    const [availableRepos, setAvailableRepos] = useState<GitHubRepo[]>([])
    const [showRepoSelector, setShowRepoSelector] = useState(false)
    const [selectedRepos, setSelectedRepos] = useState<number[]>([])
    const [initializing, setInitializing] = useState(true)
    const [fetchingRepos, setFetchingRepos] = useState(false)
    const [processingRepos, setProcessingRepos] = useState<Set<string>>(new Set())
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; repo: Repository | null }>({
        show: false,
        repo: null,
    })
    const [diagramModal, setDiagramModal] = useState<{ show: boolean; repo: Repository | null }>({
        show: false,
        repo: null,
    })

    // Search, filter, and sort states
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'processing' | 'error'>('all')
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'updated'>('date')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (user) {
            fetchConnectedRepos()
        } else {
            setInitializing(false)
        }
    }, [user])

    const fetchConnectedRepos = async () => {
        if (!user) return

        setFetchingRepos(true)
        setError(null)

        try {
            const { data, error: supabaseError } = await supabase
                .from('repositories')
                .select(`
                    *,
                    repository_diagrams(*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (supabaseError) throw supabaseError
            if (data) setConnectedRepos(data)
        } catch (err) {
            const message = getUserFriendlyErrorMessage(err)
            setError(message)
            showToast.error(message)
            console.error('Failed to load repositories:', err)
        } finally {
            setFetchingRepos(false)
            setInitializing(false)
        }
    }

    const fetchGitHubRepos = async () => {
        if (!session?.provider_token) {
            showToast.error('GitHub token not available. Please log in again.')
            return
        }

        try {
            const response = await withRetry(
                async () => {
                    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
                        headers: {
                            Authorization: `Bearer ${session.provider_token}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                    })
                    if (!res.ok) {
                        throw new Error(`GitHub API error: ${res.status}`)
                    }
                    return res
                },
                { maxRetries: 2 }
            )

            const repos: GitHubRepo[] = await response.json()
            // Filter out already connected repos
            const connectedIds = connectedRepos.map(r => r.github_repo_id)
            const available = repos.filter(r => !connectedIds.includes(r.id))
            setAvailableRepos(available)
            setShowRepoSelector(true)
        } catch (err) {
            const message = getUserFriendlyErrorMessage(err)
            showToast.error(message)
            console.error('Failed to fetch GitHub repos:', err)
        }
    }

    const connectSelectedRepos = async () => {
        if (!user || selectedRepos.length === 0) return

        const reposToConnect = availableRepos.filter(r => selectedRepos.includes(r.id))

        for (const repo of reposToConnect) {
            await supabase.from('repositories').insert({
                user_id: user.id,
                github_repo_id: repo.id,
                repo_name: repo.name,
                repo_url: repo.html_url,
                repo_owner: repo.owner.login,
                status: 'pending',
            })
        }

        setSelectedRepos([])
        setShowRepoSelector(false)
        fetchConnectedRepos()
    }

    const generateDiagram = async (repo: Repository, diagramType: DiagramType = 'flowchart') => {
        if (!session?.provider_token || !profile) return

        // Check beta limit (DISABLED FOR TESTING)
        // if (profile.diagrams_generated >= 3) {
        //     alert('Beta limit reached: Maximum 3 diagrams per account')
        //     return
        // }

        setProcessingRepos(prev => new Set(prev).add(repo.id))

        try {
            // Update status to processing
            await supabase
                .from('repositories')
                .update({ status: 'processing' })
                .eq('id', repo.id)

            // Call Edge Function to generate diagram
            const { error } = await supabase.functions.invoke('generate-diagram', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: {
                    repoOwner: repo.repo_owner,
                    repoName: repo.repo_name,
                    githubToken: session.provider_token,
                    diagramType,
                },
            })

            if (error) throw error

            // Backend already saved to repository_diagrams table
            // Just refresh to get the updated data
            await fetchConnectedRepos()
            await refreshProfile() // Update UI counter
            showToast.success('Diagram generated successfully!')

            // Track analytics event
            trackEvent(AnalyticsEvents.GENERATE_DIAGRAM, {
                repo: repo.repo_name,
                success: 1
            })
        } catch (err) {
            console.error('Failed to generate diagram:', err)
            const message = getUserFriendlyErrorMessage(err)
            showToast.error(message)
            await supabase
                .from('repositories')
                .update({ status: 'error' })
                .eq('id', repo.id)
        } finally {
            setProcessingRepos(prev => {
                const next = new Set(prev)
                next.delete(repo.id)
                return next
            })
        }
    }

    const generateReadme = async (repo: Repository) => {
        if (!session?.provider_token || !profile) return

        // Check beta limit (DISABLED FOR TESTING)
        // if (profile.readmes_generated >= 3) {
        //     alert('Beta limit reached: Maximum 3 READMEs per account')
        //     return
        // }

        setProcessingRepos(prev => new Set(prev).add(repo.id))

        try {
            // Call Edge Function to generate README
            const { data, error } = await supabase.functions.invoke('generate-readme', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: {
                    repoOwner: repo.repo_owner,
                    repoName: repo.repo_name,
                    githubToken: session.provider_token,
                },
            })

            if (error) throw error

            // Update repository with README
            await supabase
                .from('repositories')
                .update({
                    readme_content: data.readmeContent,
                    last_scanned_at: new Date().toISOString(),
                })
                .eq('id', repo.id)

            // Increment README count
            await supabase
                .from('profiles')
                .update({ readmes_generated: profile.readmes_generated + 1 })
                .eq('id', user!.id)

            fetchConnectedRepos()
            await refreshProfile() // Update UI counter
            showToast.success('README generated successfully!')

            // Track analytics event
            trackEvent(AnalyticsEvents.GENERATE_README, {
                repo: repo.repo_name,
                success: 1
            })
        } catch (err) {
            console.error('Failed to generate README:', err)
            const message = getUserFriendlyErrorMessage(err)
            showToast.error(message)
        } finally {
            setProcessingRepos(prev => {
                const next = new Set(prev)
                next.delete(repo.id)
                return next
            })
        }
    }

    const toggleRepoSelection = (repoId: number) => {
        setSelectedRepos(prev =>
            prev.includes(repoId)
                ? prev.filter(id => id !== repoId)
                : [...prev, repoId]
        )
    }

    const handleDeleteRepo = async () => {
        if (!deleteConfirm.repo) return

        try {
            await supabase
                .from('repositories')
                .delete()
                .eq('id', deleteConfirm.repo.id)

            showToast.success('Repository disconnected successfully!')
            fetchConnectedRepos()
        } catch (error) {
            console.error('Failed to delete repository:', error)
            showToast.error('Failed to disconnect repository')
        } finally {
            setDeleteConfirm({ show: false, repo: null })
        }
    }

    const handleSignOut = async () => {
        // Clear session and navigate to login
        await signOut()
        showToast.success('Logged out successfully!')
        navigate('/login')
    }

    // Filter and sort repositories
    const filteredAndSortedRepos = useMemo(() => {
        let filtered = connectedRepos

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(
                repo =>
                    repo.repo_name.toLowerCase().includes(query) ||
                    repo.repo_owner.toLowerCase().includes(query)
            )
        }

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(repo => repo.status === statusFilter)
        }

        // Apply sorting
        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'name') {
                return a.repo_name.localeCompare(b.repo_name)
            }
            if (sortBy === 'updated') {
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            }
            // Default: sort by created date (newest first)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        return sorted
    }, [connectedRepos, searchQuery, statusFilter, sortBy])

    if (initializing) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Initializing...</p>
            </div>
        )
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="header-left">
                    <Zap className="logo-icon" />
                    <h1>Mivna</h1>
                </div>
                <div className="header-right">
                    <div className="beta-badge" title="Beta: 10 total per type, 5 per hour rate limit">
                        <span>BETA</span>
                        <span className="limits">
                            <span className="usage-item" title="Diagram generation limit (5/hour, 10 total)">
                                <span
                                    className={`usage-count ${(profile?.diagrams_generated || 0) >= DIAGRAM_LIMIT ? 'danger' :
                                        (profile?.diagrams_generated || 0) >= DIAGRAM_LIMIT - 2 ? 'warning' : ''
                                        }`}
                                >
                                    {profile?.diagrams_generated || 0}/{DIAGRAM_LIMIT}
                                </span>
                                diagrams
                            </span>
                            •
                            <span className="usage-item" title="README generation limit (5/hour, 10 total)">
                                <span
                                    className={`usage-count ${(profile?.readmes_generated || 0) >= README_LIMIT ? 'danger' :
                                        (profile?.readmes_generated || 0) >= README_LIMIT - 2 ? 'warning' : ''
                                        }`}
                                >
                                    {profile?.readmes_generated || 0}/{README_LIMIT}
                                </span>
                                READMEs
                            </span>
                        </span>
                    </div>
                    <OrgSwitcher />
                    <div className="user-info">
                        <img
                            src={user?.user_metadata?.avatar_url || '/avatar.png'}
                            alt="Avatar"
                            className="avatar"
                        />
                        <span>{user?.user_metadata?.user_name || 'User'}</span>
                    </div>
                    <button className="icon-btn" onClick={handleSignOut} title="Sign Out">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="dashboard-main">
                <div className="dashboard-actions">
                    <h2>My Repositories</h2>
                    <div className="dashboard-controls">
                        <SearchBar
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search repositories..."
                        />
                        <div className="filter-controls">
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                                className="filter-select"
                            >
                                <option value="all">All Status</option>
                                <option value="ready">Ready</option>
                                <option value="processing">Processing</option>
                                <option value="error">Error</option>
                            </select>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                                className="filter-select"
                            >
                                <option value="date">Sort by Date Added</option>
                                <option value="updated">Sort by Last Updated</option>
                                <option value="name">Sort by Name</option>
                            </select>
                        </div>
                        <button className="primary-btn" onClick={fetchGitHubRepos}>
                            <Plus size={20} />
                            Connect Repository
                        </button>
                    </div>
                </div>

                {error && (
                    <ErrorMessage
                        title="Failed to Load Repositories"
                        message={error}
                        onRetry={fetchConnectedRepos}
                        showRetry={true}
                    />
                )}

                {showRepoSelector && (
                    <div className="modal-overlay">
                        <div className="repo-selector-modal">
                            <h3>Select Repositories to Connect</h3>
                            <p className="modal-subtitle">Choose which repositories you want to visualize</p>

                            <div className="repo-list">
                                {availableRepos.map(repo => (
                                    <div
                                        key={repo.id}
                                        className={`repo-option ${selectedRepos.includes(repo.id) ? 'selected' : ''}`}
                                        onClick={() => toggleRepoSelection(repo.id)}
                                    >
                                        <div className="repo-option-info">
                                            <GitBranch size={18} />
                                            <div>
                                                <span className="repo-name">{repo.full_name}</span>
                                                {repo.description && (
                                                    <span className="repo-description">{repo.description}</span>
                                                )}
                                            </div>
                                        </div>
                                        {selectedRepos.includes(repo.id) && <Check size={20} className="check-icon" />}
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions">
                                <button className="secondary-btn" onClick={() => setShowRepoSelector(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="primary-btn"
                                    onClick={connectSelectedRepos}
                                    disabled={selectedRepos.length === 0}
                                >
                                    Connect {selectedRepos.length} Repository{selectedRepos.length !== 1 ? 'ies' : 'y'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="repo-grid">
                    {fetchingRepos ? (
                        <>
                            <RepoCardSkeleton />
                            <RepoCardSkeleton />
                            <RepoCardSkeleton />
                        </>
                    ) : connectedRepos.length === 0 ? (
                        <div className="empty-state">
                            <GitBranch size={48} />
                            <h3>No repositories connected</h3>
                            <p>Connect your GitHub repositories to generate architecture diagrams</p>
                            <button className="primary-btn" onClick={fetchGitHubRepos}>
                                <Plus size={20} />
                                Connect Your First Repository
                            </button>
                        </div>
                    ) : filteredAndSortedRepos.length === 0 ? (
                        <div className="empty-state">
                            <GitBranch size={48} />
                            <h3>No repositories found</h3>
                            <p>No repositories match your current filters. Try adjusting your search or filters.</p>
                        </div>
                    ) : (
                        filteredAndSortedRepos.map(repo => (
                            <div key={repo.id} className="repo-card">
                                <div className="repo-card-header">
                                    <GitBranch size={24} />
                                    <div>
                                        <h3>{repo.repo_name}</h3>
                                        <span className="repo-owner">@{repo.repo_owner}</span>
                                    </div>
                                    <span
                                        className={`status-badge ${repo.status}`}
                                        title={repo.status === 'error' ? 'Scan failed - click Update Diagram to retry' : `Status: ${repo.status}`}
                                    >
                                        {repo.status}
                                    </span>
                                </div>

                                {repo.last_scanned_at && (
                                    <p className="last-scanned">
                                        Last scanned: {new Date(repo.last_scanned_at).toLocaleDateString()}
                                    </p>
                                )}

                                <div className="repo-card-actions">
                                    {/* Diagram Actions - Show count or generate button */}
                                    {repo.repository_diagrams && repo.repository_diagrams.length > 0 ? (
                                        <button
                                            className="view-btn"
                                            onClick={() => navigate(`/repository/${repo.id}`)}
                                            aria-label={`View diagrams for ${repo.repo_name}`}
                                        >
                                            <FileText size={18} />
                                            {repo.repository_diagrams.length}/4 Diagrams
                                        </button>
                                    ) : null}

                                    {/* Always show Generate/Add button */}
                                    <button
                                        className={repo.repository_diagrams?.length ? "generate-btn secondary" : "generate-btn"}
                                        onClick={() => setDiagramModal({ show: true, repo })}
                                        disabled={processingRepos.has(repo.id)}
                                        aria-label={repo.repository_diagrams?.length ? `Add more diagrams for ${repo.repo_name}` : `Generate diagram for ${repo.repo_name}`}
                                    >
                                        {processingRepos.has(repo.id) ? (
                                            <>
                                                <RefreshCw size={18} className="spinning" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Zap size={18} />
                                                {repo.repository_diagrams?.length ? 'Add Diagram' : 'Generate Diagram'}
                                            </>
                                        )}
                                    </button>

                                    {repo.readme_content ? (
                                        <button
                                            className="view-btn secondary"
                                            onClick={() => navigate(`/repository/${repo.id}/readme`)}
                                        >
                                            <FileText size={18} />
                                            View README
                                        </button>
                                    ) : (
                                        <button
                                            className="generate-btn secondary"
                                            onClick={() => generateReadme(repo)}
                                            disabled={processingRepos.has(repo.id)}
                                        >
                                            {processingRepos.has(repo.id) ? (
                                                <>
                                                    <RefreshCw size={18} className="spinning" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <FileText size={18} />
                                                    Generate README
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {repo.diagram_code && (
                                    <>
                                        <button
                                            className="update-btn"
                                            onClick={() => generateDiagram(repo)}
                                            disabled={processingRepos.has(repo.id)}
                                        >
                                            <RefreshCw size={16} />
                                            Update Diagram
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() => setDeleteConfirm({ show: true, repo })}
                                        >
                                            <Trash2 size={16} />
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </main>

            <ConfirmModal
                isOpen={deleteConfirm.show}
                title="Delete Repository"
                message={`Are you sure you want to disconnect "${deleteConfirm.repo?.repo_name}"? This will delete all generated diagrams and READMEs for this repository.`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteRepo}
                onCancel={() => setDeleteConfirm({ show: false, repo: null })}
                dangerous
            />

            <DiagramGenerationModal
                isOpen={diagramModal.show}
                repoName={diagramModal.repo?.repo_name || ''}
                onGenerate={(diagramType) => {
                    if (diagramModal.repo) {
                        generateDiagram(diagramModal.repo, diagramType)
                    }
                }}
                onClose={() => setDiagramModal({ show: false, repo: null })}
            />
        </div>
    )
}
