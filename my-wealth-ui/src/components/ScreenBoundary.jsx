import { Component } from 'react';

// Without this, a throw inside any screen unmounts the whole tree and the app
// goes blank with nothing on screen to say what happened — which is how a
// single bad line in one tab looked like the entire app being broken.
export class ScreenBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.screenKey !== this.props.screenKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-bg-primary px-6 pt-24 pb-24">
        <h1 className="text-white text-xl font-bold mb-2">หน้านี้เปิดไม่ได้</h1>
        <p className="text-text-secondary text-sm mb-4">
          หน้าอื่นยังใช้งานได้ตามปกติ — แตะแท็บด้านล่างเพื่อไปหน้าอื่น
        </p>
        <pre className="text-coral text-xs whitespace-pre-wrap break-words bg-bg-card border border-border-soft rounded-lg p-3">
          {String(this.state.error?.message || this.state.error)}
        </pre>
      </div>
    );
  }
}
