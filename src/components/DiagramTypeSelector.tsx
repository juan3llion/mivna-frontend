import { Database, GitBranch, MessageSquare, Box } from 'lucide-react'
import './DiagramTypeSelector.css'

export type DiagramType = 'flowchart' | 'erd' | 'sequence' | 'component'

interface DiagramTypeSelectorProps {
    selected: DiagramType
    onChange: (type: DiagramType) => void
}

interface TypeOption {
    value: DiagramType
    label: string
    description: string
    icon: typeof GitBranch
}

const DIAGRAM_TYPES: TypeOption[] = [
    {
        value: 'flowchart',
        label: 'Flowchart',
        description: 'Code flow and logic paths',
        icon: GitBranch
    },
    {
        value: 'erd',
        label: 'ERD',
        description: 'Database schema and relationships',
        icon: Database
    },
    {
        value: 'sequence',
        label: 'Sequence',
        description: 'API flows and interactions',
        icon: MessageSquare
    },
    {
        value: 'component',
        label: 'Component',
        description: 'Architecture and components',
        icon: Box
    }
]

export function DiagramTypeSelector({ selected, onChange }: DiagramTypeSelectorProps) {
    return (
        <div className="diagram-type-selector">
            <label className="selector-label">Diagram Type</label>
            <div className="type-options">
                {DIAGRAM_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                        <button
                            key={type.value}
                            className={`type-option ${selected === type.value ? 'selected' : ''}`}
                            onClick={() => onChange(type.value)}
                            type="button"
                        >
                            <Icon size={20} />
                            <div className="type-info">
                                <span className="type-label">{type.label}</span>
                                <span className="type-description">{type.description}</span>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
