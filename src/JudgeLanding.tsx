import { useEffect } from 'react'

interface JudgeLandingProps {
  onEnter: () => void
}

export function JudgeLanding({ onEnter }: JudgeLandingProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onEnter()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEnter])

  return (
    <div className="judge-dossier-overlay">
      {/* Background warm ambient glows - strictly NO blue, NO white, NO black */}
      <div className="warm-ambient-glow warm-glow-1" aria-hidden="true" />
      <div className="warm-ambient-glow warm-glow-2" aria-hidden="true" />
      <div className="warm-grid-pattern" aria-hidden="true" />

      <div className="judge-dossier-container">
        {/* Top Header Badge */}
        <header className="judge-header">
          <div className="judge-badge-row">
            <span className="judge-badge">JUDGE & EVALUATOR BRIEFING</span>
            <span className="judge-version-tag">VER 1.0.4 · STABLE BUILD</span>
          </div>

          <h1 className="judge-title">
            REALITY<span className="judge-title-highlight">.EXE</span>
          </h1>

          <p className="judge-summary">
            A real-time 3D N-body orbital physics sandbox simulating gravitational mechanics,
            relativistic singularities, and orbital perturbations under your direct command.
          </p>
        </header>

        {/* 4 Quick Operation Modules */}
        <div className="judge-grid">
          {/* Module 1 */}
          <div className="judge-card">
            <div className="judge-card-header">
              <span className="judge-icon">🔭</span>
              <h2 className="judge-card-title">Camera & Observation</h2>
            </div>
            <ul className="judge-list">
              <li>
                <strong className="judge-key">Left-Click + Drag</strong>: Orbit 3D viewport freely around the system.
              </li>
              <li>
                <strong className="judge-key">Scroll Wheel</strong>: Smooth zoom into planetary atmospheres or system scale.
              </li>
              <li>
                <strong className="judge-key">Right-Click + Drag</strong>: Pan focus across space.
              </li>
              <li>
                <strong className="judge-key">Click Any Body</strong>: Lock camera tracking & open live telemetry (mass, velocity, radius).
              </li>
            </ul>
          </div>

          {/* Module 2 */}
          <div className="judge-card">
            <div className="judge-card-header">
              <span className="judge-icon">⚙️</span>
              <h2 className="judge-card-title">Physics & Space-Time</h2>
            </div>
            <ul className="judge-list">
              <li>
                <strong className="judge-key">Gravity Multiplier</strong>: Scale universal attraction from 0.1× to 3.0×.
              </li>
              <li>
                <strong className="judge-key">Gravity Inversion</strong>: Switch between Normal, Inverted (repulsive expansion), or Zero-G.
              </li>
              <li>
                <strong className="judge-key">Time Warp</strong>: Slow time down or accelerate up to 5.0× speed.
              </li>
              <li>
                <strong className="judge-key">Freeze Simulation</strong>: Halt time instantly to inspect orbital momentum vectors.
              </li>
            </ul>
          </div>

          {/* Module 3 */}
          <div className="judge-card">
            <div className="judge-card-header">
              <span className="judge-icon">🪐</span>
              <h2 className="judge-card-title">Creation & Singularities</h2>
            </div>
            <ul className="judge-list">
              <li>
                <strong className="judge-key">+ Spawn Planet</strong>: Seed new celestial bodies into dynamic multi-body orbits.
              </li>
              <li>
                <strong className="judge-key">+ Black Hole</strong>: Click anywhere to instantiate a singularity that devours nearby matter.
              </li>
              <li>
                <strong className="judge-key">Mass & Impulse</strong>: Alter mass on the fly or fire directional velocity boosters.
              </li>
              <li>
                <strong className="judge-key">Disintegrate</strong>: Obliterate any selected world into expanding cosmic dust.
              </li>
            </ul>
          </div>

          {/* Module 4 */}
          <div className="judge-card">
            <div className="judge-card-header">
              <span className="judge-icon">💻</span>
              <h2 className="judge-card-title">Console & Guided Demo</h2>
            </div>
            <ul className="judge-list">
              <li>
                <strong className="judge-key">Natural Terminal</strong>: Type commands like <span className="judge-code">REVERSE GRAVITY</span>, <span className="judge-code">DESTROY VESPER</span>, or <span className="judge-code">ACTIVATE CHAOS</span>.
              </li>
              <li>
                <strong className="judge-key">6-Act Guided Demo</strong>: Hit <span className="judge-highlight">START DEMO</span> for an automated cinematic walkthrough with narration.
              </li>
              <li>
                <strong className="judge-key">Chaos Mode</strong>: Triggers unpredictable astronomical gravitational disturbances.
              </li>
              <li>
                <strong className="judge-key">Reset Universe</strong>: 1-click restore to restore pristine baseline conditions.
              </li>
            </ul>
          </div>
        </div>

        {/* Quick Recommendation Strip for Judges */}
        <div className="judge-recommendation">
          <span className="judge-rec-label">⚡ 30-SECOND JUDGE TOUR:</span>
          <span className="judge-rec-item">1. Click any planet to view orbital telemetry</span>
          <span className="judge-rec-item">2. Invert Gravity or spawn a Black Hole</span>
          <span className="judge-rec-item">3. Click "START DEMO" for automated scoring evaluation</span>
        </div>

        {/* Action Button & Note */}
        <footer className="judge-footer">
          <button
            type="button"
            onClick={onEnter}
            className="judge-continue-btn"
            autoFocus
          >
            <span>CONTINUE TO PLAYFIELD</span>
            <span className="judge-arrow" aria-hidden="true">→</span>
          </button>

          <p className="judge-footnote">
            [ Press <kbd className="judge-kbd">Enter</kbd> to launch ] · You can reopen this briefing anytime via <span className="judge-subtle-hint">[? JUDGE GUIDE]</span> in the top header.
          </p>
        </footer>
      </div>
    </div>
  )
}
