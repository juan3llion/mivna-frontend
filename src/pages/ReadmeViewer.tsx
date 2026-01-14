import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Repository } from '../lib/supabase'
import { ArrowLeft, RefreshCw, Copy, Check, FileText, Download } from 'lucide-react'
import { downloadTextFile } from '../lib/export'
import { showToast } from '../lib/toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'


export function ReadmeViewer() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { session, profile } = useAuth()
    const [repo, setRepo] = useState<Repository | null>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        fetchRepository()
    }, [id])

    const fetchRepository = async () => {
        if (!id) return

        const { data, error } = await supabase
            .from('repositories')
            .select('*')
            .eq('id', id)
            .single()

        if (!error && data) {
            setRepo(data)
        }
        setLoading(false)
    }

    const handleUpdateReadme = async () => {
        if (!session?.provider_token || !profile || !repo) return

        setUpdating(true)

        try {
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

            await supabase
                .from('repositories')
                .update({
                    readme_content: data.readmeContent,
                    last_scanned_at: new Date().toISOString(),
                })
                .eq('id', repo.id)

            fetchRepository()
        } catch (error) {
            console.error('Failed to update README:', error)
        } finally {
            setUpdating(false)
        }
    }

    const handleCopy = async () => {
        if (!repo?.readme_content) return

        await navigator.clipboard.writeText(repo.readme_content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        showToast.success('README copied to clipboard!')
    }

    const handleDownload = () => {
        if (!repo?.readme_content) return

        downloadTextFile(
            repo.readme_content,
            `${repo.repo_name}-README.md`,
            'text/markdown'
        )
        showToast.success('README downloaded!')
    }

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading README...</p>
            </div>
        )
    }

    if (!repo) {
        return (
            <div className="error-screen">
                <h2>Repository not found</h2>
                <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            </div>
        )
    }

    return (
        <div className="readme-viewer">
            <header className="viewer-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={20} />
                        Back
                    </button>
                    <div className="repo-info">
                        <FileText size={24} />
                        <div>
                            <h1>{repo.repo_name} - README</h1>
                            <span className="owner">@{repo.repo_owner}</span>
                        </div>
                    </div>
                </div>

                <div className="header-controls">
                    <button onClick={handleCopy} className="copy-btn">
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>

                    <button onClick={handleDownload} className="copy-btn">
                        <Download size={18} />
                        Download
                    </button>

                    <button
                        className="update-btn"
                        onClick={handleUpdateReadme}
                        disabled={updating}
                    >
                        <RefreshCw size={18} className={updating ? 'spinning' : ''} />
                        {updating ? 'Updating...' : 'Update README'}
                    </button>
                </div>
            </header>

            <main className="readme-content">
                {repo.readme_content ? (
                    <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {repo.readme_content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <div className="empty-state">
                        <FileText size={48} />
                        <h3>No README generated yet</h3>
                        <p>Click "Update README" to generate documentation for this repository</p>
                    </div>
                )}
            </main>

            {repo.last_scanned_at && (
                <footer className="viewer-footer">
                    Last updated: {new Date(repo.last_scanned_at).toLocaleString()}
                </footer>
            )}
        </div>
    )
}
