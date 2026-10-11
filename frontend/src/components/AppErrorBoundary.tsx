import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SolarSync render error', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return <main className="configuration-page"><section><h1>SolarSync hit a problem</h1><p>Your account data is safe. Reload the page to try again.</p><button className="secondary-button" onClick={() => window.location.reload()}><RefreshCw size={14} />Reload</button></section></main>
    }
    return this.props.children
  }
}
