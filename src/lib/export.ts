/**
 * Export utilities for diagrams and README files
 */

/**
 * Download a text file
 */
export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/**
 * Convert SVG to PNG and download
 */
export async function downloadSVGasPNG(svgElement: SVGElement, filename: string, scale = 2) {
    return new Promise<void>((resolve, reject) => {
        try {
            const svgData = new XMLSerializer().serializeToString(svgElement)
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            if (!ctx) {
                reject(new Error('Could not get canvas context'))
                return
            }

            const img = new Image()
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
            const url = URL.createObjectURL(svgBlob)

            img.onload = () => {
                canvas.width = img.width * scale
                canvas.height = img.height * scale
                ctx.scale(scale, scale)
                ctx.drawImage(img, 0, 0)

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create PNG blob'))
                        return
                    }

                    const pngUrl = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = pngUrl
                    link.download = filename
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(pngUrl)
                    URL.revokeObjectURL(url)
                    resolve()
                }, 'image/png')
            }

            img.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new Error('Failed to load SVG image'))
            }

            img.src = url
        } catch (error) {
            reject(error)
        }
    })
}

/**
 * Download SVG file
 */
export function downloadSVG(svgElement: SVGElement, filename: string) {
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
