import { Component, type ReactNode } from 'react';
import { Trans } from 'react-i18next';
import i18n from '../i18n';

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
          <strong>{i18n.t('demo.crashed')}</strong>
          <p className="dk-note" style={{ margin: '6px 0 10px' }}>
            <Trans i18nKey="demo.uncaught" values={{ message: this.state.error.message }} components={{ code: <code /> }} />
          </p>
          <button className="dk-btn" type="button" onClick={() => this.setState((s) => ({ error: null, key: s.key + 1 }))}>
            {i18n.t('demo.reset')}
          </button>
        </div>
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}
