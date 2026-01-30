import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Repository } from '../lib/supabase'
import { downloadSVG, downloadSVGasPNG } from '../lib/export'
import { showToast } from '../lib/toast'
import { ErrorMessage } from '../components/ErrorMessage'
import mermaid from 'mermaid'

import {
    ArrowLeft,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Download,
    RefreshCw,
    X,
    Zap,
} from 'lucide-react'

export function DiagramViewer() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { session, profile } = useAuth()
    const [repo, setRepo] = useState<Repository | null>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [zoom, setZoom] = useState(1.2)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [selectedNode, setSelectedNode] = useState<string | null>(null)
    const [nodeExplanation, setNodeExplanation] = useState<string | null>(null)
    const [explaining, setExplaining] = useState(false)
    // Multi-diagram support
    const [activeDiagramType, setActiveDiagramType] = useState<'flowchart' | 'erd' | 'sequence' | 'component'>('flowchart')
    const [currentDiagramCode, setCurrentDiagramCode] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const diagramRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'JetBrains Mono, monospace',
        })
        fetchRepository()
    }, [id])

    useEffect(() => {
        if (currentDiagramCode) {
            renderDiagram()
        }
    }, [currentDiagramCode])

    // Update current diagram when type changes
    useEffect(() => {
        if (repo?.repository_diagrams) {
            const diagram = repo.repository_diagrams.find(d => d.diagram_type === activeDiagramType)
            setCurrentDiagramCode(diagram?.diagram_code || null)
        }
    }, [activeDiagramType, repo])

    const fetchRepository = async () => {
        if (!id) return

        setError(null)
        const { data, error } = await supabase
            .from('repositories')
            .select(`
                *,
                repository_diagrams(*)
            `)
            .eq('id', id)
            .single()

        if (error) {
            setError('Failed to load repository. Please try again.')
            showToast.error('Failed to load repository')
        } else if (data) {
            setRepo(data)
            // Set initial diagram type to first available
            if (data.repository_diagrams && data.repository_diagrams.length > 0) {
                setActiveDiagramType(data.repository_diagrams[0].diagram_type)
            }
        }
        setLoading(false)
    }

    const renderDiagram = async () => {
        if (!diagramRef.current || !currentDiagramCode) return

        try {
            const { svg } = await mermaid.render('mermaid-diagram', currentDiagramCode)
            diagramRef.current.innerHTML = svg

            // Add click handlers to nodes
            const nodes = diagramRef.current.querySelectorAll('.node, .cluster')
            nodes.forEach(node => {
                (node as HTMLElement).style.cursor = 'pointer'
                node.addEventListener('click', (e: Event) => {
                    e.stopPropagation()
                    const nodeText = (node as HTMLElement).textContent || ''
                    handleNodeClick(nodeText)
                })
            })
        } catch {
            showToast.error('Failed to render diagram')
            if (diagramRef.current) {
                diagramRef.current.innerHTML = `<div class="diagram-error">
        <p>Failed to render diagram. The Mermaid syntax may be invalid.</p>
        <pre>${currentDiagramCode}</pre>
      </div>`
            }
        }
    }

    const handleNodeClick = async (nodeText: string) => {
        if (!session) return

        setSelectedNode(nodeText)
        setExplaining(true)
        setNodeExplanation(null)

        // Auto-zoom to 2.5x and center when clicking a node for better visibility
        setZoom(2.5)
        setPan({ x: 0, y: 0 })

        try {
            const { data, error } = await supabase.functions.invoke('explain-node', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: {
                    nodeName: nodeText,
                    diagramCode: repo?.diagram_code,
                    repoName: repo?.repo_name,
                },
            })

            if (error) throw error
            setNodeExplanation(data.explanation)
        } catch {
            showToast.error('Failed to explain node')
            setNodeExplanation('Failed to generate explanation. Please try again.')
        } finally {
            setExplaining(false)
        }
    }

    const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 3))
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.3))
    const handleReset = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsDragging(true)
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
        }
    }

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (isDragging) {
                setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
            }
        },
        [isDragging, dragStart]
    )

    const handleMouseUp = () => setIsDragging(false)

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(z => Math.min(Math.max(z + delta, 0.3), 3))
    }

    const handleUpdateDiagram = async () => {
        if (!session?.provider_token || !profile || !repo) return

        setUpdating(true)

        try {
            console.log('Generating diagram:', {
                type: activeDiagramType,
                repo: `${repo.repo_owner}/${repo.repo_name}`
            })

            const { data, error } = await supabase.functions.invoke('generate-diagram', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: {
                    repoOwner: repo.repo_owner,
                    repoName: repo.repo_name,
                    githubToken: session.provider_token,
                    diagramType: activeDiagramType,
                },
            })

            if (error) {
                console.error('Edge Function error:', error)
                throw error
            }

            console.log('Diagram generated successfully:', data)

            // Edge Function already saves to repository_diagrams table
            // Just refresh to get the updated data
            await fetchRepository()
            showToast.success(`${activeDiagramType.toUpperCase()} diagram updated successfully!`)
        } catch (err: any) {
            console.error('Failed to update diagram:', err)
            showToast.error(`Failed to generate ${activeDiagramType} diagram: ${err.message || 'Unknown error'}`)
        } finally {
            setUpdating(false)
        }
    }

    const handleExport = async (format: 'svg' | 'png') => {
        if (!diagramRef.current || !repo) return

        const svgElement = diagramRef.current.querySelector('svg')
        if (!svgElement) {
            showToast.error('No diagram to export')
            return
        }

        try {
            const filename = `${repo.repo_name}-architecture.${format}`

            if (format === 'svg') {
                downloadSVG(svgElement as SVGElement, filename)
                showToast.success('Diagram exported as SVG!')
            } else {
                await downloadSVGasPNG(svgElement as SVGElement, filename)
                showToast.success('Diagram exported as PNG!')
            }
        } catch (error) {
            console.error('Export failed:', error)
            showToast.error('Failed to export diagram')
        }
    }

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading diagram...</p>
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
        <div className="diagram-viewer">
            <header className="viewer-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={20} />
                        Back
                    </button>
                    <div className="repo-info">
                        <h1>{repo.repo_name}</h1>
                        <span className="owner">@{repo.repo_owner}</span>
                    </div>
                </div>

                <div className="header-controls">
                    <div className="zoom-controls">
                        <button onClick={handleZoomOut} title="Zoom Out">
                            <ZoomOut size={18} />
                        </button>
                        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                        <button onClick={handleZoomIn} title="Zoom In">
                            <ZoomIn size={18} />
                        </button>
                        <button onClick={handleReset} title="Reset View">
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    <div className="export-controls">
                        <button onClick={() => handleExport('svg')} title="Export SVG">
                            <Download size={18} />
                            SVG
                        </button>
                        <button onClick={() => handleExport('png')} title="Export PNG">
                            <Download size={18} />
                            PNG
                        </button>
                    </div>

                    <button
                        className="update-btn"
                        onClick={handleUpdateDiagram}
                        disabled={updating}
                    >
                        <RefreshCw size={18} className={updating ? 'spinning' : ''} />
                        {updating ? 'Updating...' : 'Update Diagram'}
                    </button>
                </div>
            </header>

            {/* Diagram Type Tabs */}
            {repo.repository_diagrams && repo.repository_diagrams.length > 0 && (
                <div className="diagram-type-tabs">
                    {(['flowchart', 'erd', 'sequence', 'component'] as const).map(type => {
                        const diagram = repo.repository_diagrams?.find(d => d.diagram_type === type)
                        const typeLabels = {
                            flowchart: '📊 Flowchart',
                            erd: '🗄️ ERD',
                            sequence: '💬 Sequence',
                            component: '📦 Component'
                        }

                        return (
                            <button
                                key={type}
                                className={`diagram-tab ${activeDiagramType === type ? 'active' : ''} ${!diagram ? 'disabled' : ''}`}
                                onClick={() => diagram && setActiveDiagramType(type)}
                                disabled={!diagram}
                                title={diagram ? `View ${type} diagram` : `No ${type} diagram yet`}
                            >
                                {typeLabels[type]}
                                {diagram && <span className="check">✓</span>}
                            </button>
                        )
                    })}
                </div>
            )}

            {error && (
                <ErrorMessage
                    title="Failed to Load Repository"
                    message={error}
                    onRetry={fetchRepository}
                    showRetry={true}
                />
            )}

            <div className="viewer-content">
                <div
                    ref={containerRef}
                    className="diagram-container"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                >
                    <div
                        ref={diagramRef}
                        className="diagram-canvas"
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                    />
                </div>

                {selectedNode && (
                    <div className="insights-panel">
                        <div className="insights-header">
                            <h3>
                                <Zap size={18} />
                                AI Insights
                            </h3>
                            <button onClick={() => setSelectedNode(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="insights-content">
                            <h4>{selectedNode}</h4>
                            {explaining ? (
                                <div className="explaining">
                                    <div className="loading-spinner small"></div>
                                    <p>Analyzing component...</p>
                                </div>
                            ) : (
                                <p>{nodeExplanation}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {repo.last_scanned_at && (
                <footer className="viewer-footer">
                    Last updated: {new Date(repo.last_scanned_at).toLocaleString()}
                </footer>
            )}
        </div>
    )
}
