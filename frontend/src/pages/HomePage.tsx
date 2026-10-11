import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import MarketingHeader from '../components/MarketingHeader'

export default function HomePage() {
  return (
    <div className="marketing-page landing-page">
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <img className="landing-hero-image" src="/solar-home-hero.png" alt="A home with rooftop solar panels in the evening" />
          <div className="landing-hero-shade" />
          <MarketingHeader overlay />
          <div className="landing-hero-content">
            <p className="hero-kicker"><span />HOME ENERGY PLANNING</p>
            <h1 id="landing-title">Make the most of the sunlight over your home.</h1>
            <p>Plan flexible appliance tasks around your solar forecast, household demand, and grid limits.</p>
            <div className="landing-hero-actions">
              <Link to="/signup" className="hero-primary">Set up your home <ArrowRight size={15} /></Link>
              <Link to="/how-it-works" className="hero-secondary">See how it works</Link>
            </div>
          </div>
          <span className="image-caption">SolarSync home energy planning</span>
        </section>
      </main>
    </div>
  )
}
