import { Component } from 'react';

/** Shows a friendly reload screen instead of a blank page if a screen crashes. */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Fitoor crashed:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-screen">
        <div className="stack-center">
          <h2>Something broke on this screen 😵</h2>
          <p className="muted small">{String(this.state.error?.message || this.state.error)}</p>
          <button className="btn btn-primary" onClick={() => location.reload()}>Reload the app</button>
        </div>
      </div>
    );
  }
}
