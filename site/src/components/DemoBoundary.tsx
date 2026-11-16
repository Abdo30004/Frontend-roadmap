import { Component, type ReactNode } from 'react';

interface State { error: Error | null; key: number }

/** Keeps one crashing demo from taking down the whole page. */
export class DemoBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, key: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="dk-panel" data-tone="bad" role="alert">
          <strong>The component tree crashed.</strong>
          <p className="dk-note" style={{ margin: '6px 0 10px' }}>
            Uncaught error: <code>{this.state.error.message}</code>. In a real app without an error boundary, this is a blank white screen.
          </p>
          <button className="dk-btn" type="button" onClick={() => this.setState((s) => ({ error: null, key: s.key + 1 }))}>
            Reset demo
          </button>
        </div>
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}
