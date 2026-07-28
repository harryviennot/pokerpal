// React 19 only flushes updates inside act() when this flag is set. Without it
// the renderer leaks state between tests as timer-driven updates land outside
// any act scope — which the chunked equity simulation produces constantly.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
