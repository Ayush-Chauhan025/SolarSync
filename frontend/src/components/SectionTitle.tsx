import type { ReactNode } from 'react'

type Props = { eyebrow?: string; title: string; description?: string; action?: ReactNode }

export default function SectionTitle({ eyebrow, title, description, action }: Props) {
  return (
    <div className="section-title-row">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  )
}
