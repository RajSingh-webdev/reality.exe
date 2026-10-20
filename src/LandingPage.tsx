import {useEffect} from 'react';
import {Footer, Header} from './components/Chrome';
import {Earthrise} from './components/Earthrise';
import {MissionLog} from './components/MissionLog';
import {Feedback} from './components/Reserve';
import {Trajectory} from './components/Trajectory';
import {useReducedMotion} from './hooks/useReducedMotion';
import {startScroll} from './lib/scroll';

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({onEnter}: LandingPageProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    // Start Lenis smooth scroll runner
    return startScroll(reduced);
  }, [reduced]);

  // Keyboard shortcut: Press Enter outside of inputs to launch the universe
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'BUTTON' && tag !== 'SELECT') {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEnter]);

  return (
    <div className="relative min-h-screen bg-void text-regolith selection:bg-earth selection:text-void z-20">
      <Header onEnter={onEnter} />
      <main>
        <Earthrise onEnter={onEnter} />
        <MissionLog />
        <Trajectory />
        <Feedback onEnter={onEnter} />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
