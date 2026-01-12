import './Skeleton.css'

interface SkeletonProps {
    width?: string
    height?: string
    borderRadius?: string
    className?: string
    style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '4px', className = '', style }: SkeletonProps) {
    return (
        <div
            className={`skeleton ${className}`}
            style={{ width, height, borderRadius, ...style }}
        />
    )
}

export function RepoCardSkeleton() {
    return (
        <div className="repo-card skeleton-card">
            <div className="repo-card-header">
                <Skeleton width="24px" height="24px" borderRadius="50%" />
                <div style={{ flex: 1, marginLeft: '12px' }}>
                    <Skeleton width="60%" height="24px" />
                    <Skeleton width="30%" height="16px" style={{ marginTop: '8px' }} />
                </div>
                <Skeleton width="80px" height="24px" borderRadius="12px" />
            </div>
            <div className="repo-card-actions" style={{ marginTop: '16px' }}>
                <Skeleton width="120px" height="40px" borderRadius="8px" />
                <Skeleton width="120px" height="40px" borderRadius="8px" />
            </div>
        </div>
    )
}

export function DiagramSkeleton() {
    return (
        <div className="skeleton-diagram">
            <Skeleton width="100%" height="400px" borderRadius="12px" />
        </div>
    )
}

export function ReadmeSkeleton() {
    return (
        <div className="skeleton-readme">
            <Skeleton width="80%" height="32px" style={{ marginBottom: '16px' }} />
            <Skeleton width="100%" height="20px" style={{ marginBottom: '12px' }} />
            <Skeleton width="95%" height="20px" style={{ marginBottom: '12px' }} />
            <Skeleton width="90%" height="20px" style={{ marginBottom: '24px' }} />
            <Skeleton width="70%" height="28px" style={{ marginBottom: '16px' }} />
            <Skeleton width="100%" height="20px" style={{ marginBottom: '12px' }} />
            <Skeleton width="85%" height="20px" style={{ marginBottom: '12px' }} />
        </div>
    )
}
