/**
 * Content configuration for REALITY.EXE.
 * Incorporates SELENE's cinematic narrative adapted for the Reality.exe programmable universe.
 */

export const brand = {
  name: 'Reality.exe',
  wordmark: 'REALITY.EXE',
  email: 'command@reality.exe',
};

export const nav = [
  {label: 'Capabilities', href: '#capabilities'},
  {label: 'Trajectory', href: '#trajectory'},
  {label: 'Systems', href: '#missions'},
  {label: 'Feedback', href: '#feedback'},
];

export const hero = {
  title: 'REALITY.EXE',
  kicker: 'An interactive universe you can reprogram',
  site: 'N-Body Observatory · Sector 01 · G = 0.080',
};

export const intro = {
  eyebrow: 'ENGINE CAPABILITIES',
  heading: 'Reality is yours to program.',
  body: 'Control matter, rewrite physical laws, and create entire worlds. Explore the capabilities that let you reshape reality, frame by frame.',
};

export interface CapabilityItem {
  tag?: string;
  number: string;
  title: string;
  body: string;
  image?: string;
}

export const log: CapabilityItem[] = [
  {
    tag: '01',
    number: '01',
    title: 'REALITY MANIPULATION',
    body: 'Move, transform, duplicate, freeze, and erase objects. Take control of the matter inside your universe.',
  },
  {
    tag: '02',
    number: '02',
    title: 'PHYSICS CONTROL',
    body: 'Adjust gravity, mass, velocity, and simulation time to experiment with the laws governing your universe.',
  },
  {
    tag: '03',
    number: '03',
    title: 'UNIVERSE CREATOR',
    body: 'Spawn celestial bodies, customize planetary systems, and build your own evolving universe.',
  },
  {
    tag: '04',
    number: '04',
    title: 'COSMIC EVENTS',
    body: 'Explore black holes, gravitational interactions, collisions, and spectacular destruction effects.',
  },
  {
    tag: '05',
    number: '05',
    title: 'REALITY POWERS',
    body: 'Freeze the cosmic clock, trigger time dilation, unleash chaos mode perturbations, and dissolve planetary matter into radiant particle fields.',
  },
];

export const capabilities = {
  intro,
  items: log,
};

/** Legs of the Earth → Moon trajectory, in drawing order. */
export const trajectory = {
  eyebrow: 'Trajectory',
  heading: '384,400 km of orbital mechanics, drawn as you scroll.',
  legs: [
    {day: 'Phase 0', title: 'Parking orbit', body: 'Two laps of the Earth while physical vectors and simulation constants are verified.'},
    {day: 'Phase 1', title: 'Trans-lunar injection', body: 'A six-minute burn and the craft enters transfer trajectory. No turning back for three days.'},
    {day: 'Phase 2', title: 'Lunar orbit insertion', body: 'The engine fires behind the Moon, entering the gravitational capture horizon.'},
    {day: 'Phase 3', title: 'Descent', body: 'Twelve minutes from orbit to touchdown in the dust of Tranquillity.'},
  ],
};

export const missions = {
  eyebrow: 'Simulation Modes',
  heading: 'Three ways to command reality.',
  note: 'Deterministic physics sandbox — zero external API latency.',
  items: [
    {name: 'Observer', days: 6, lines: ['Passive N-body orbit telemetry', 'Real-time velocity vectors', 'Dynamic camera tracking'], cta: 'Initialize Observer'},
    {name: 'Architect', days: 10, lines: ['Natural-language command console', 'Planet spawner & mass changer', 'Tangential orbital boosters'], cta: 'Initialize Architect', featured: true},
    {name: 'Singularity', days: 28, lines: ['Relativistic black hole placement', 'Matter disintegration particle engine', 'Chaos mode perturbation'], cta: 'Initialize Singularity'},
  ],
};

export const reserve = {
  eyebrow: 'Feedback Channel',
  heading: 'Help us shape reality.',
  body: 'Found a bug, have an idea, or want to improve the simulation? Send your feedback and help make Reality.exe better.',
};

export const feedback = reserve;
