import { useEffect, useRef } from 'react'

interface LandingPageProps {
  onEnter: () => void
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Lightweight 60fps celestial visual: orbital paths, glowing singularity/star, and drifting cosmic particles
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio)
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio
    }
    window.addEventListener('resize', handleResize)

    // Orbiting bodies
    const bodies = [
      { radius: 68, speed: 0.018, angle: 0.2, size: 3.2, color: '#f59e0b', glow: '#d97706' },
      { radius: 110, speed: 0.012, angle: 1.4, size: 4.5, color: '#38bdf8', glow: '#0284c7' },
      { radius: 155, speed: 0.008, angle: 2.8, size: 4.0, color: '#34d399', glow: '#059669' },
      { radius: 205, speed: 0.005, angle: 4.5, size: 6.2, color: '#fb923c', glow: '#ea580c' },
    ]

    // Cosmic dust particles
    const dustCount = 45
    const dust = Array.from({ length: dustCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
    }))

    let t = 0
    const render = () => {
      t += 0.01
      ctx.clearRect(0, 0, width, height)

      const centerX = width / 2
      const centerY = height / 2
      const scale = Math.min(width, height) / 520

      // Draw faint cosmic dust
      for (const p of dust) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        ctx.fillStyle = `rgba(180, 210, 255, ${p.alpha * 0.5})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * scale, 0, Math.PI * 2)
        ctx.fill()
      }

      // Orbital tilt perspective
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.scale(1, 0.45) // 3D orbital plane inclination

      // Draw orbital trajectory lines
      for (const body of bodies) {
        ctx.beginPath()
        ctx.arc(0, 0, body.radius * scale, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)'
        ctx.lineWidth = 1.2
        ctx.setLineDash([4, 6])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw Central Singularity / Star
      ctx.restore()

      // Accretion disk glow behind core
      const glowGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        4 * scale,
        centerX,
        centerY,
        75 * scale,
      )
      glowGrad.addColorStop(0, 'rgba(251, 146, 60, 0.45)')
      glowGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.25)')
      glowGrad.addColorStop(0.7, 'rgba(30, 41, 59, 0.15)')
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(centerX, centerY, 75 * scale, 0, Math.PI * 2)
      ctx.fill()

      // Central black hole / relativistic core
      ctx.beginPath()
      ctx.arc(centerX, centerY, 16 * scale, 0, Math.PI * 2)
      ctx.fillStyle = '#05070d'
      ctx.fill()
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.85)'
      ctx.lineWidth = 2 * scale
      ctx.stroke()

      // Photon ring shimmer
      ctx.beginPath()
      ctx.arc(centerX, centerY, 19 * scale, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + Math.sin(t * 2) * 0.15})`
      ctx.lineWidth = 1 * scale
      ctx.stroke()

      // Draw orbiting bodies along tilted plane
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.scale(1, 0.45)

      for (const body of bodies) {
        body.angle += body.speed
        const bx = Math.cos(body.angle) * body.radius * scale
        const by = Math.sin(body.angle) * body.radius * scale

        // Body glow
        ctx.shadowColor = body.glow
        ctx.shadowBlur = 12 * scale
        ctx.fillStyle = body.color
        ctx.beginPath()
        ctx.arc(bx, by, body.size * scale, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.restore()

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  // Keyboard shortcut: Press Enter to launch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault()
        onEnter()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEnter])

  const scrollToFeatures = () => {
    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="reality-landing-wrapper">
      {/* Subtle cosmic background atmosphere */}
      <div className="cosmic-bg-overlay" aria-hidden="true" />
      <div className="cosmic-grid-mesh" aria-hidden="true" />

      {/* A. HEADER */}
      <header className="landing-nav-header">
        <div className="landing-brand-group">
          <div className="landing-brand-mark" aria-hidden="true">
            <span className="landing-brand-core" />
          </div>
          <div className="landing-brand-text">
            <span className="landing-brand-name">REALITY<span className="accent-glow">.EXE</span></span>
            <span className="landing-brand-sub">N-BODY PHYSICS ENGINE</span>
          </div>
        </div>

        <nav className="landing-nav-links" aria-label="Landing Page Navigation">
          <button type="button" onClick={scrollToFeatures} className="landing-nav-link">
            Features
          </button>
          <a href="#differentiator" className="landing-nav-link">
            Architecture
          </a>
        </nav>

        <div className="landing-header-cta-group">
          <button
            type="button"
            onClick={onEnter}
            className="landing-primary-btn landing-header-btn"
            id="nav-enter-btn"
          >
            <span>ENTER THE UNIVERSE</span>
            <span className="btn-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="landing-main-content">
        {/* B. HERO SECTION */}
        <section className="landing-hero-section" aria-labelledby="hero-title">
          <div className="hero-text-col">
            <div className="hero-badge">
              <span className="badge-pulse" aria-hidden="true" />
              <span>INTERACTIVE PHYSICS SANDBOX</span>
            </div>

            <h1 id="hero-title" className="hero-title">
              REALITY<span className="accent-glow">.EXE</span>
            </h1>

            <p className="hero-tagline">
              A Universe You Can Reprogram.
            </p>

            <div className="hero-description">
              <p>
                Reality.exe is an interactive 3D universe simulator that lets you rewrite the rules of a simulated universe in real time. Instead of simply watching planets orbit or destroying them with weapons, you can manipulate gravity, create black holes, disintegrate planets, and control cosmic events using natural-language commands.
              </p>
              <p className="hero-desc-secondary">
                It combines real-time 3D visualization, a custom Newtonian physics simulation, and a command console to turn the universe into a programmable physics playground.
              </p>
            </div>

            {/* Compact feature summary & chips */}
            <div className="compact-features-wrapper">
              <p className="compact-feature-summary">
                Manipulate gravity and time. Create black holes. Disintegrate planets into particles. Spawn celestial bodies, trigger cosmic chaos, and control the simulation through natural-language commands.
              </p>

              <div className="feature-chips-row" role="list" aria-label="Key Capabilities">
                <span className="feature-chip" role="listitem">
                  <span className="chip-dot dot-cyan" aria-hidden="true" /> Gravity & Time Warp
                </span>
                <span className="feature-chip" role="listitem">
                  <span className="chip-dot dot-orange" aria-hidden="true" /> Black Hole Singularities
                </span>
                <span className="feature-chip" role="listitem">
                  <span className="chip-dot dot-purple" aria-hidden="true" /> Particle Disintegration
                </span>
                <span className="feature-chip" role="listitem">
                  <span className="chip-dot dot-green" aria-hidden="true" /> Celestial Spawner
                </span>
                <span className="feature-chip" role="listitem">
                  <span className="chip-dot dot-amber" aria-hidden="true" /> Natural-Language Commands
                </span>
              </div>
            </div>

            {/* Hero CTAs */}
            <div className="hero-cta-group">
              <button
                type="button"
                onClick={onEnter}
                className="landing-primary-btn hero-main-btn"
                id="hero-primary-cta"
              >
                <span>ENTER THE UNIVERSE</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                onClick={scrollToFeatures}
                className="landing-secondary-btn"
                id="hero-explore-features-btn"
              >
                <span>EXPLORE FEATURES</span>
                <span className="btn-icon" aria-hidden="true">↓</span>
              </button>
            </div>
          </div>

          {/* C. HERO VISUAL */}
          <div className="hero-visual-col" aria-hidden="true">
            <div className="celestial-canvas-container">
              <canvas ref={canvasRef} className="celestial-canvas" />

              {/* Technical telemetry overlay */}
              <div className="celestial-telemetry-panel">
                <div className="telemetry-row">
                  <span className="telemetry-label">SOLAR GRAVITY CONSTANT</span>
                  <span className="telemetry-value">G = 0.080 MU</span>
                </div>
                <div className="telemetry-row">
                  <span className="telemetry-label">INTEGRATOR</span>
                  <span className="telemetry-value">NEWTONIAN 120HZ</span>
                </div>
                <div className="telemetry-row">
                  <span className="telemetry-label">ORBITAL HARMONICS</span>
                  <span className="telemetry-value text-emerald-400">STABLE · ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* D. FEATURES SECTION */}
        <section id="features-section" className="landing-features-section" aria-labelledby="features-heading">
          <div className="section-header-block">
            <span className="section-eyebrow">CAPABILITIES</span>
            <h2 id="features-heading" className="section-title">
              Four Levers to Rewrite Reality
            </h2>
            <p className="section-subtitle">
              Every system parameter is dynamic, deterministic, and under your command.
            </p>
          </div>

          <div className="features-grid">
            {/* Feature 1 */}
            <article className="feature-card">
              <div className="feature-card-indicator" aria-hidden="true">
                <span className="feature-num">01</span>
                <div className="feature-icon-badge">⚙️</div>
              </div>
              <h3 className="feature-card-title">REWRITE PHYSICS</h3>
              <p className="feature-card-body">
                Change gravitational strength and direction, pause time, and alter the simulation's behavior.
              </p>
              <div className="feature-card-tags">
                <span className="tag-pill">0.1× – 3.0× Gravity</span>
                <span className="tag-pill">Inversion & Zero-G</span>
                <span className="tag-pill">Time Scale Warp</span>
              </div>
            </article>

            {/* Feature 2 */}
            <article className="feature-card">
              <div className="feature-card-indicator" aria-hidden="true">
                <span className="feature-num">02</span>
                <div className="feature-icon-badge">🕳️</div>
              </div>
              <h3 className="feature-card-title">CREATE COSMIC EVENTS</h3>
              <p className="feature-card-body">
                Generate black holes, attract celestial bodies, and manipulate planetary trajectories.
              </p>
              <div className="feature-card-tags">
                <span className="tag-pill">Schwarzschild Horizons</span>
                <span className="tag-pill">Mass Ingestion</span>
                <span className="tag-pill">Orbital Capture</span>
              </div>
            </article>

            {/* Feature 3 */}
            <article className="feature-card">
              <div className="feature-card-indicator" aria-hidden="true">
                <span className="feature-num">03</span>
                <div className="feature-icon-badge">💥</div>
              </div>
              <h3 className="feature-card-title">DISINTEGRATE MATTER</h3>
              <p className="feature-card-body">
                Break planets into glowing particles and create dramatic destruction effects.
              </p>
              <div className="feature-card-tags">
                <span className="tag-pill">6,000 Particle Budget</span>
                <span className="tag-pill">Velocity Inheritance</span>
                <span className="tag-pill">Fragment Dust</span>
              </div>
            </article>

            {/* Feature 4 */}
            <article className="feature-card">
              <div className="feature-card-indicator" aria-hidden="true">
                <span className="feature-num">04</span>
                <div className="feature-icon-badge">⌨️</div>
              </div>
              <h3 className="feature-card-title">CONTROL REALITY WITH COMMANDS</h3>
              <p className="feature-card-body">
                Enter natural-language commands to trigger actions in the same simulation.
              </p>
              <div className="feature-card-tags">
                <span className="tag-pill">Natural Parsing</span>
                <span className="tag-pill">Prompt History</span>
                <span className="tag-pill">6-Act Guided Demo</span>
              </div>
            </article>
          </div>
        </section>

        {/* E. TECHNICAL DIFFERENTIATION FOR JUDGES */}
        <section id="differentiator" className="landing-tech-section" aria-labelledby="tech-heading">
          <div className="tech-inner-card">
            <div className="tech-header">
              <span className="section-eyebrow">ENGINE ARCHITECTURE</span>
              <h2 id="tech-heading" className="tech-title">
                What Makes Reality.exe Unique
              </h2>
            </div>

            <div className="tech-columns">
              <div className="tech-item">
                <h3 className="tech-item-title">Custom N-Body Physics</h3>
                <p className="tech-item-desc">
                  Unlike pre-baked orbital animations, all planetary motion is computed in real time using numerical integration at 120Hz with Plummer gravitational softening to handle close-encounter singularities.
                </p>
              </div>

              <div className="tech-item">
                <h3 className="tech-item-title">Deterministic Command Interface</h3>
                <p className="tech-item-desc">
                  A high-throughput natural command interpreter translates freeform spatial instructions directly into physics state mutations without latency or reliance on external cloud APIs.
                </p>
              </div>

              <div className="tech-item">
                <h3 className="tech-item-title">Zero-Lag WebGL Rendering</h3>
                <p className="tech-item-desc">
                  Leveraging Three.js and custom GLSL vertex shaders, celestial bodies, dynamic circular ring-buffered trajectory trails, and thousands of post-disintegration particles render fluidly at 60+ FPS.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* F. FINAL CALL TO ACTION */}
        <section className="landing-final-cta-section" aria-labelledby="cta-heading">
          <div className="final-cta-container">
            <h2 id="cta-heading" className="final-cta-title">
              Ready to rewrite reality?
            </h2>
            <p className="final-cta-sub">
              Take direct control of the star system, alter gravitational constants, or initiate a guided tour.
            </p>

            <button
              type="button"
              onClick={onEnter}
              className="landing-primary-btn final-launch-btn"
              id="final-enter-btn"
            >
              <span>ENTER REALITY.EXE</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </button>

            <p className="final-cta-hint">
              [ Press <kbd className="landing-kbd">Enter</kbd> to launch immediately ]
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-left">
          <span className="footer-title">REALITY.EXE</span>
          <span className="footer-sub">Interactive 3D Universe Simulator</span>
        </div>
        <div className="footer-right">
          <span className="footer-status">
            <span className="footer-status-dot" aria-hidden="true" />
            ENGINE COMPILED &amp; READY
          </span>
        </div>
      </footer>
    </div>
  )
}
