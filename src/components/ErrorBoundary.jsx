import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="view-error-panel">
        <strong>Cette vue a rencontré une erreur.</strong>
        <span>Les données sont conservées. Revenez à l’overview puis réessayez.</span>
        <pre>{this.state.error.message}</pre>
        <button className="primary-action" type="button" onClick={this.props.onReset}>
          Retour Overview
        </button>
      </div>
    );
  }
}
