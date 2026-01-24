import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { ApiError, ApiErrorType, getUserFriendlyErrorMessage } from '../lib/api'
import { AlertTriangle, RefreshCw, Home, Bug, Wifi, Lock, Clock } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onReset?: () => void
}

interface State {
    hasError: boolean
    error: Error | null
    errorType: ApiErrorType | null
    errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorType: null,
            errorId: null
        }
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        const apiError = ApiError.fromError(error)
        return {
            hasError: true,
            error,
            errorType: apiError.type
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo)

        // Report to Sentry with context
        const eventId = Sentry.captureException(error, {
            extra: {
                componentStack: errorInfo.componentStack,
                errorType: ApiError.fromError(error).type,
            },
            tags: {
                errorBoundary: 'true',
            }
        })

        this.setState({ errorId: eventId })
    }

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorType: null,
            errorId: null
        })
        this.props.onReset?.()
    }

    handleRefreshPage = () => {
        window.location.reload()
    }

    handleGoHome = () => {
        window.location.href = '/dashboard'
    }

    handleReportIssue = () => {
        if (this.state.errorId) {
            Sentry.showReportDialog({ eventId: this.state.errorId })
        } else {
            // Fallback: open support email
            const subject = encodeURIComponent('Mivna Error Report')
            const body = encodeURIComponent(`Error: ${this.state.error?.message || 'Unknown error'}\n\nPlease describe what you were doing:\n`)
            window.open(`mailto:support@mivna.app?subject=${subject}&body=${body}`, '_blank')
        }
    }

    getErrorIcon = () => {
        switch (this.state.errorType) {
            case ApiErrorType.NETWORK:
                return <Wifi className="error-icon-svg" />
            case ApiErrorType.AUTH:
                return <Lock className="error-icon-svg" />
            case ApiErrorType.TIMEOUT:
                return <Clock className="error-icon-svg" />
            default:
                return <AlertTriangle className="error-icon-svg" />
        }
    }

    getErrorTitle = () => {
        switch (this.state.errorType) {
            case ApiErrorType.NETWORK:
                return 'Connection Lost'
            case ApiErrorType.AUTH:
                return 'Session Expired'
            case ApiErrorType.TIMEOUT:
                return 'Request Timed Out'
            case ApiErrorType.SERVER:
                return 'Server Error'
            case ApiErrorType.RATE_LIMIT:
                return 'Too Many Requests'
            default:
                return 'Something Went Wrong'
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            const isRetryable = this.state.errorType && (
                this.state.errorType === ApiErrorType.NETWORK ||
                this.state.errorType === ApiErrorType.SERVER ||
                this.state.errorType === ApiErrorType.TIMEOUT
            )

            const showLoginButton = this.state.errorType === ApiErrorType.AUTH

            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <div className="error-icon">
                            {this.getErrorIcon()}
                        </div>
                        <h2>{this.getErrorTitle()}</h2>
                        <p className="error-message">
                            {this.state.error
                                ? getUserFriendlyErrorMessage(this.state.error)
                                : 'An unexpected error occurred.'
                            }
                        </p>

                        {import.meta.env.DEV && this.state.error && (
                            <details className="error-details">
                                <summary>Technical Details</summary>
                                <pre>{this.state.error.message}</pre>
                                <pre>{this.state.error.stack}</pre>
                            </details>
                        )}

                        <div className="error-actions">
                            {isRetryable && (
                                <button onClick={this.handleRetry} className="primary-btn">
                                    <RefreshCw size={18} />
                                    Try Again
                                </button>
                            )}

                            {showLoginButton ? (
                                <button onClick={() => window.location.href = '/login'} className="primary-btn">
                                    <Lock size={18} />
                                    Log In Again
                                </button>
                            ) : (
                                <button onClick={this.handleRefreshPage} className="secondary-btn">
                                    <RefreshCw size={18} />
                                    Refresh Page
                                </button>
                            )}

                            <button onClick={this.handleGoHome} className="secondary-btn">
                                <Home size={18} />
                                Go to Dashboard
                            </button>

                            <button onClick={this.handleReportIssue} className="ghost-btn">
                                <Bug size={18} />
                                Report Issue
                            </button>
                        </div>

                        {this.state.errorId && (
                            <p className="error-id">
                                Error ID: <code>{this.state.errorId}</code>
                            </p>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
