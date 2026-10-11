import { ArrowRight, Check, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import MarketingHeader from '../components/MarketingHeader'

const steps = [
  { number: '01', title: 'Set up your home', text: 'Add your location, solar system, typical household demand, and grid settings. SolarSync uses these details to estimate the energy available through the day.' },
  { number: '02', title: 'Choose the tasks to run', text: 'Add appliances with their power draw, run time, time window, and priority. Keep regular tasks as presets so you can add them to a day quickly.' },
  { number: '03', title: 'Review the day plan', text: 'Preview proposed task times against expected solar generation and demand. Review the energy summary, then save the plan when it suits your household.' },
]

export default function HowItWorksPage() {
  return (
    <div className="marketing-page how-page">
      <MarketingHeader />
      <main className="how-page-content">
        <section className="how-intro">
          <p className="marketing-kicker"><span />A CLEARER WAY TO PLAN</p>
          <h1>Three steps to a more considered energy day.</h1>
          <p>SolarSync helps you decide when flexible household tasks should run, using your home setup and the solar forecast as planning inputs.</p>
        </section>
        <section className="how-page-steps" aria-label="How SolarSync works">
          {steps.map((step) => (
            <article key={step.number}>
              <span className="step-number">{step.number}</span>
              <div className="how-step-icon"><Sun size={19} /></div>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
              <Check className="how-step-check" size={17} aria-hidden="true" />
            </article>
          ))}
        </section>
        <section className="how-cta">
          <div><span>START WITH YOUR HOME</span><h2>Build a plan around the energy you have.</h2></div>
          <Link to="/signup" className="marketing-cta">Get started <ArrowRight size={15} /></Link>
        </section>
      </main>
    </div>
  )
}
