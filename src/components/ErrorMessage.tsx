import { AlertCircle, X, RefreshCw } from 'lucide-react'
import './ErrorMessage.css'

interface ErrorMessageProps {
    title: string
    message: string
    onRetry?: () => void
    onDismiss?: () => void
    showRetry?: boolean
    showDismiss?: boolean
}

export function ErrorMessage({
    title,
    message,
    onRetry,
    onDismiss,
    showRetry = true,
    showDismiss = false,
}: ErrorMessageProps) {
    return (
        <div className="error-message">
            <div className="error-icon">
                <AlertCircle size={24} />
            </div>
            <div className="error-content">
                <h3 className="error-title">{title}</h3>
                <p className="error-text">{message}</p>
                {showRetry && onRetry && (
                    <button className="error-retry-btn" onClick={onRetry}>
                        <RefreshCw size={16} />
                        Try Again
                    </button>
                )}
            </div>
            {showDismiss && onDismiss && (
                <button className="error-dismiss-btn" onClick={onDismiss} aria-label="Dismiss">
                    <X size={20} />
                </button>
            )}
        </div>
    )
}
