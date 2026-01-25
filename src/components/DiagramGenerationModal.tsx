import { useState } from 'react'
import { DiagramTypeSelector, type DiagramType } from './DiagramTypeSelector'
import './DiagramGenerationModal.css'

interface DiagramGenerationModalProps {
    isOpen: boolean
    onClose: () => void
    onGenerate: (diagramType: DiagramType) => void
    repoName: string
}

export function DiagramGenerationModal({ isOpen, onClose, onGenerate, repoName }: DiagramGenerationModalProps) {
    const [selectedType, setSelectedType] = useState<DiagramType>('flowchart')

    if (!isOpen) return null

    const handleGenerate = () => {
        onGenerate(selectedType)
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content diagram-generation-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Generate Diagram</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <p className="repo-name">for <strong>{repoName}</strong></p>

                    <DiagramTypeSelector
                        selected={selectedType}
                        onChange={setSelectedType}
                    />
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleGenerate}>
                        Generate Diagram
                    </button>
                </div>
            </div>
        </div>
    )
}
