import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import SolarWordmark from './SolarWordmark'

type Props = { overlay?: boolean }

export default function MarketingHeader({ overlay = false }: Props) {
  return (
    <header className={`marketing-header${overlay ? ' over-image' : ''}`}>
      <Link className="marketing-brand" to="/" aria-label="SolarSync home">
        <SolarWordmark />
      </Link>
      <nav className="marketing-nav" aria-label="Main navigation">
        <Link to="/how-it-works">How it works</Link>
        <Link to="/login" className="nav-signin">Sign in</Link>
        <Link to="/signup" className="marketing-cta">Get started <ArrowRight size={15} /></Link>
      </nav>
    </header>
  )
}
