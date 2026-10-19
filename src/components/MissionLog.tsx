import {useEffect, useRef} from 'react';
import {intro, log} from '../content';
import {clamp, pinProgress, range} from '../lib/math';
import {onFrame} from '../lib/scroll';

/**
 * The mission, as a reel of stills. The section pins and the reel slides
 * sideways with the scroll; the frame nearest the middle is in focus, the
 * rest dim back, and each picture drifts against its frame.
 */

const SECTION_VH = 390;

export function MissionLog() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const cardRefs = useRef<HTMLLIElement[]>([]);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const barRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let lastP = -1;
    return onFrame(() => {
      const root = rootRef.current;
      const track = trackRef.current;
      if (!root || !track) return;
      const {p, rect, vh} = pinProgress(root);
      if (rect.bottom < 0 || rect.top > vh) return;
      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;

      const vw = window.innerWidth;
      const k = range(p, 0.04, 0.96);
      // offsetLeft is the untransformed layout position, so this is stable
      // while the track itself is being translated.
      const travel = Math.max(0, track.offsetLeft + track.scrollWidth - vw * 0.94);
      track.style.transform = `translate3d(${-k * travel}px, 0, 0)`;

      let nearest = 0;
      let best = Infinity;
      cardRefs.current.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const off = (r.left + r.width / 2 - vw * 0.62) / vw; // focus line right of centre
        const a = clamp(Math.abs(off) * 1.6);
        card.style.opacity = String(1 - a * 0.55);
        card.style.transform = `scale(${1 - a * 0.07})`;
        if (imgRefs.current[i]) {
          imgRefs.current[i]!.style.transform = `translate3d(${off * -60}px, 0, 0) scale(1.15)`;
        }
        if (Math.abs(off) < best) {
          best = Math.abs(off);
          nearest = i;
        }
      });
      if (barRef.current) barRef.current.style.transform = `scaleX(${k})`;
      if (countRef.current) countRef.current.textContent = `0${nearest + 1}`;
    });
  }, []);

  return (
    <section ref={rootRef} id="capabilities" aria-labelledby="capabilities-title" className="relative bg-void" style={{height: `${SECTION_VH}svh`}}>
      {/* Anchor alias for backwards-compatible #log navigation */}
      <span id="log" className="sr-only" aria-hidden="true" />

      <div className="sticky top-0 flex h-screen-s flex-col justify-center overflow-hidden pt-16 md:flex-row md:items-center md:justify-start md:pt-0">
        {/* Left Side: Section Introduction */}
        <div className="relative z-20 shrink-0 px-4 sm:px-6 md:flex md:w-[32vw] md:self-stretch md:flex-col md:justify-center md:bg-void md:pl-[6vw] md:pr-10 md:after:pointer-events-none md:after:absolute md:after:inset-y-0 md:after:right-0 md:after:w-16 md:after:translate-x-full md:after:bg-gradient-to-r md:after:from-void md:after:to-transparent">
          <p className="font-mono text-label text-earth uppercase">{intro.eyebrow}</p>
          <h2 id="capabilities-title" className="mt-4 font-display text-display text-white">
            {intro.heading}
          </h2>
          <p className="mt-5 max-w-[26rem] text-body text-regolith/70 max-md:hidden">{intro.body}</p>
          <div className="mt-8 flex items-center gap-4 font-mono text-label text-regolith/60 uppercase max-md:hidden" aria-hidden="true">
            <span>
              <span ref={countRef} className="text-white">
                01
              </span>{' '}
              / 0{log.length}
            </span>
            <span className="relative h-px w-32 bg-white/15">
              <span ref={barRef} className="absolute inset-0 origin-left bg-earth" style={{transform: 'scaleX(0)'}} />
            </span>
          </div>
        </div>

        {/* Right Side: Horizontal Reel of 5 Capability Cards */}
        <ol ref={trackRef} className="mt-8 flex gap-5 pl-4 will-change-transform sm:pl-6 md:mt-0 md:gap-7 md:pl-0">
          {log.map((entry, i) => (
            <li
              key={entry.title}
              ref={(el) => {
                if (el) cardRefs.current[i] = el;
              }}
              className="w-[70vw] shrink-0 origin-bottom sm:w-[44vw] md:w-[clamp(16rem,24vw,23rem)]"
            >
              <figure>
                {/* Image Container: Preserves aspect ratio, rounded corners, dark background, empty for future user images */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-[6px] bg-void-2 border border-white/10 ring-1 ring-white/5 transition-colors">
                  {entry.image ? (
                    <img
                      ref={(el) => {
                        imgRefs.current[i] = el;
                      }}
                      src={entry.image}
                      alt={`${entry.title}: ${entry.body}`}
                      width={840}
                      height={1120}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover will-change-transform"
                    />
                  ) : (
                    <div className="size-full bg-void-2" />
                  )}
                  <span className="absolute top-3 left-3 rounded-[3px] bg-void/80 px-2 py-1 font-mono text-[0.625rem] tracking-[0.14em] text-white/90 uppercase backdrop-blur border border-white/10">
                    {entry.tag || `0${i + 1}`}
                  </span>
                </div>
                <figcaption className="mt-4 flex gap-4">
                  <span className="font-mono text-label text-earth">{entry.number || `0${i + 1}`}</span>
                  <span>
                    <span className="block font-display text-[0.9375rem] tracking-[0.08em] text-white uppercase">{entry.title}</span>
                    <span className="mt-1.5 block text-[0.875rem] leading-relaxed text-regolith/65">{entry.body}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export const Capabilities = MissionLog;
export default MissionLog;
