import toast from 'react-hot-toast'

// Toast configuration with custom styling
const toastOptions = {
    duration: 4000,
    style: {
        background: '#1a1d29',
        color: '#fff',
        border: '1px solid #2d3142',
        borderRadius: '8px',
        fontSize: '0.9rem',
    },
    success: {
        iconTheme: {
            primary: '#00cec9',
            secondary: '#fff',
        },
    },
    error: {
        iconTheme: {
            primary: '#ff7675',
            secondary: '#fff',
        },
    },
}

export const showToast = {
    success: (message: string) => toast.success(message, toastOptions),
    error: (message: string) => toast.error(message, toastOptions),
    loading: (message: string) => toast.loading(message, toastOptions),
    promise: <T,>(
        promise: Promise<T>,
        messages: {
            loading: string
            success: string
            error: string
        }
    ) => toast.promise(promise, messages, toastOptions),
}
