export type Vector3Tuple = [number, number, number]
export type GravityDirection = 'normal' | 'reverse' | 'zero'

export interface PlanetDefinition {
  name: string
  distance: number
  size: number
  mass: number
  color: string
  emissive: string
  phase: number
  tilt: number
  ringed?: boolean
}

export interface PhysicsBody extends PlanetDefinition {
  id: string
  isInitial: boolean
  initialMass: number
  initialPosition: Vector3Tuple
  initialVelocity: Vector3Tuple
  position: Vector3Tuple
  velocity: Vector3Tuple
  acceleration: Vector3Tuple
  previousAcceleration: Vector3Tuple
}

export interface BlackHole {
  id: string
  name: string
  position: Vector3Tuple
  mass: number
  horizonRadius: number
}

export interface PhysicsWorld {
  bodies: PhysicsBody[]
  initialBodies: PhysicsBody[]
  blackHoles: BlackHole[]
  capturedBodies: PhysicsBody[]
  simulatedTime: number
  resetVersion: number
  nextBodyId: number
  nextBlackHoleId: number
}

export interface GravitySettings {
  gravityMultiplier: number
  gravityDirection: GravityDirection
}

// Positions use stylized scene units, time is seconds, and mass is in simulation mass units.
export const GRAVITATIONAL_CONSTANT = 0.08
export const STAR_MASS = 120
export const SOFTENING_LENGTH = 0.18
export const MAX_POSITION = 200
export const MAX_SPEED = 25
export const MAX_ACCELERATION = 120
export const MAX_GRAVITY_MULTIPLIER = 3
export const MIN_BODY_MASS = 0.005
export const MAX_BODY_MASS = 2
export const MAX_BLACK_HOLES = 4

export const PLANETS: PlanetDefinition[] = [
  { name: 'Cinder', distance: 2.15, size: 0.16, mass: 0.01, color: '#b5a18c', emissive: '#4a291c', phase: 0.3, tilt: 0.08 },
  { name: 'Aurelia', distance: 3.25, size: 0.29, mass: 0.025, color: '#e5ae72', emissive: '#572514', phase: 1.2, tilt: 0.04 },
  { name: 'Vesper', distance: 4.65, size: 0.35, mass: 0.04, color: '#6389bb', emissive: '#102647', phase: 2.5, tilt: 0.12 },
  { name: 'Verdant', distance: 6.25, size: 0.26, mass: 0.03, color: '#8caa87', emissive: '#1a351c', phase: 3.7, tilt: 0.06 },
  { name: 'Orion', distance: 8.15, size: 0.58, mass: 0.18, color: '#c78955', emissive: '#532616', phase: 5.2, tilt: 0.28, ringed: true },
]

const SOFTENING_SQUARED = SOFTENING_LENGTH * SOFTENING_LENGTH

function copyVector(vector: Vector3Tuple): Vector3Tuple {
  return [vector[0], vector[1], vector[2]]
}

export function createPhysicsWorld(): PhysicsWorld {
  const bodies = PLANETS.map((planet): PhysicsBody => {
    const { distance, phase, tilt } = planet
    const cosine = Math.cos(phase)
    const sine = Math.sin(phase)
    const tiltSine = Math.sin(tilt)
    const tiltCosine = Math.cos(tilt)
    const speed = Math.sqrt((GRAVITATIONAL_CONSTANT * STAR_MASS) / distance)
    const initialPosition: Vector3Tuple = [
      distance * cosine,
      distance * sine * tiltSine,
      distance * sine * tiltCosine,
    ]
    const initialVelocity: Vector3Tuple = [
      -speed * sine,
      speed * cosine * tiltSine,
      speed * cosine * tiltCosine,
    ]

    return {
      ...planet,
      id: `planet-${planet.name.toLowerCase()}`,
      isInitial: true,
      initialMass: planet.mass,
      initialPosition,
      initialVelocity,
      position: copyVector(initialPosition),
      velocity: copyVector(initialVelocity),
      acceleration: [0, 0, 0],
      previousAcceleration: [0, 0, 0],
    }
  })

  const world = {
    bodies,
    initialBodies: bodies.map(cloneBody),
    blackHoles: [],
    capturedBodies: [],
    simulatedTime: 0,
    resetVersion: 0,
    nextBodyId: 1,
    nextBlackHoleId: 1,
  }
  calculateAccelerations(world, { gravityMultiplier: 1, gravityDirection: 'normal' })
  return world
}

function cloneBody(body: PhysicsBody): PhysicsBody {
  return {
    ...body,
    initialPosition: copyVector(body.initialPosition),
    initialVelocity: copyVector(body.initialVelocity),
    position: copyVector(body.initialPosition),
    velocity: copyVector(body.initialVelocity),
    acceleration: [0, 0, 0],
    previousAcceleration: [0, 0, 0],
  }
}

function signedGravityStrength(settings: GravitySettings): number {
  if (settings.gravityDirection === 'zero') return 0
  if (!Number.isFinite(settings.gravityMultiplier) || settings.gravityMultiplier < 0) return Number.NaN
  const direction = settings.gravityDirection === 'reverse' ? -1 : 1
  return direction * Math.min(settings.gravityMultiplier, MAX_GRAVITY_MULTIPLIER)
}

export function calculateAccelerations(world: PhysicsWorld, settings: GravitySettings): boolean {
  const strength = signedGravityStrength(settings)
  const { bodies } = world
  if (!Number.isFinite(strength)) return false
  for (const body of bodies) {
    const speed = Math.hypot(...body.velocity)
    if (
      !Number.isFinite(body.mass) ||
      body.mass < MIN_BODY_MASS ||
      body.mass > MAX_BODY_MASS ||
      !Number.isFinite(speed) ||
      speed > MAX_SPEED ||
      body.position.some((component) => !Number.isFinite(component) || Math.abs(component) > MAX_POSITION)
    ) {
      return false
    }
  }
  for (const blackHole of world.blackHoles) {
    if (
      !Number.isFinite(blackHole.mass) ||
      blackHole.mass <= 0 ||
      !Number.isFinite(blackHole.horizonRadius) ||
      blackHole.horizonRadius <= 0 ||
      blackHole.position.some((component) => !Number.isFinite(component) || Math.abs(component) > MAX_POSITION)
    ) {
      return false
    }
  }

  if (strength === 0) {
    for (const body of bodies) body.acceleration = [0, 0, 0]
    return true
  }

  for (const body of bodies) {
    const [x, y, z] = body.position
    const distanceSquared = x * x + y * y + z * z + SOFTENING_SQUARED
    const scale = (-GRAVITATIONAL_CONSTANT * STAR_MASS * strength) / (distanceSquared ** 1.5)
    body.acceleration[0] = x * scale
    body.acceleration[1] = y * scale
    body.acceleration[2] = z * scale
  }

  for (let i = 0; i < bodies.length; i += 1) {
    const bodyA = bodies[i]
    for (let j = i + 1; j < bodies.length; j += 1) {
      const bodyB = bodies[j]
      const dx = bodyB.position[0] - bodyA.position[0]
      const dy = bodyB.position[1] - bodyA.position[1]
      const dz = bodyB.position[2] - bodyA.position[2]
      const distanceSquared = dx * dx + dy * dy + dz * dz + SOFTENING_SQUARED
      const inverseDistanceCubed = 1 / (distanceSquared ** 1.5)
      const accelerationScaleA = GRAVITATIONAL_CONSTANT * strength * bodyB.mass * inverseDistanceCubed
      const accelerationScaleB = -GRAVITATIONAL_CONSTANT * strength * bodyA.mass * inverseDistanceCubed

      bodyA.acceleration[0] += dx * accelerationScaleA
      bodyA.acceleration[1] += dy * accelerationScaleA
      bodyA.acceleration[2] += dz * accelerationScaleA
      bodyB.acceleration[0] += dx * accelerationScaleB
      bodyB.acceleration[1] += dy * accelerationScaleB
      bodyB.acceleration[2] += dz * accelerationScaleB
    }
  }

  for (const body of bodies) {
    for (const blackHole of world.blackHoles) {
      const dx = blackHole.position[0] - body.position[0]
      const dy = blackHole.position[1] - body.position[1]
      const dz = blackHole.position[2] - body.position[2]
      const distanceSquared = dx * dx + dy * dy + dz * dz + SOFTENING_SQUARED
      const accelerationScale =
        (GRAVITATIONAL_CONSTANT * strength * blackHole.mass) /
        (distanceSquared ** 1.5)
      body.acceleration[0] += dx * accelerationScale
      body.acceleration[1] += dy * accelerationScale
      body.acceleration[2] += dz * accelerationScale
    }
  }

  return bodies.every((body) => {
    const acceleration = Math.hypot(...body.acceleration)
    return Number.isFinite(acceleration) && acceleration <= MAX_ACCELERATION
  })
}

export function advancePhysics(
  world: PhysicsWorld,
  settings: GravitySettings,
  delta: number,
): boolean {
  if (!Number.isFinite(delta) || delta <= 0 || delta > 0.05) return false
  if (!calculateAccelerations(world, settings)) return false

  const halfDeltaSquared = 0.5 * delta * delta
  for (const body of world.bodies) {
    body.previousAcceleration[0] = body.acceleration[0]
    body.previousAcceleration[1] = body.acceleration[1]
    body.previousAcceleration[2] = body.acceleration[2]

    for (let axis = 0; axis < 3; axis += 1) {
      const position =
        body.position[axis] +
        body.velocity[axis] * delta +
        body.previousAcceleration[axis] * halfDeltaSquared
      if (!Number.isFinite(position) || Math.abs(position) > MAX_POSITION) return false
      body.position[axis] = position
    }
  }

  for (let i = world.bodies.length - 1; i >= 0; i -= 1) {
    const body = world.bodies[i]
    const captured = world.blackHoles.some((blackHole) => {
      const dx = body.position[0] - blackHole.position[0]
      const dy = body.position[1] - blackHole.position[1]
      const dz = body.position[2] - blackHole.position[2]
      return dx * dx + dy * dy + dz * dz <= blackHole.horizonRadius ** 2
    })
    if (captured) {
      world.capturedBodies.push(body)
      world.bodies.splice(i, 1)
    }
  }

  if (!calculateAccelerations(world, settings)) return false

  const halfDelta = 0.5 * delta
  for (const body of world.bodies) {
    let speedSquared = 0
    for (let axis = 0; axis < 3; axis += 1) {
      const velocity =
        body.velocity[axis] +
        (body.previousAcceleration[axis] + body.acceleration[axis]) * halfDelta
      if (!Number.isFinite(velocity)) return false
      body.velocity[axis] = velocity
      speedSquared += velocity * velocity
    }

    if (!Number.isFinite(speedSquared) || speedSquared > MAX_SPEED * MAX_SPEED) return false
  }

  world.simulatedTime += delta
  return Number.isFinite(world.simulatedTime)
}

export function resetPhysicsWorld(world: PhysicsWorld): void {
  world.bodies.splice(0, world.bodies.length, ...world.initialBodies.map(cloneBody))
  world.blackHoles.length = 0
  world.capturedBodies.length = 0
  for (const body of world.bodies) {
    body.position[0] = body.initialPosition[0]
    body.position[1] = body.initialPosition[1]
    body.position[2] = body.initialPosition[2]
    body.velocity[0] = body.initialVelocity[0]
    body.velocity[1] = body.initialVelocity[1]
    body.velocity[2] = body.initialVelocity[2]
    body.mass = body.initialMass
    body.previousAcceleration[0] = 0
    body.previousAcceleration[1] = 0
    body.previousAcceleration[2] = 0
  }
  world.simulatedTime = 0
  world.resetVersion += 1
  calculateAccelerations(world, { gravityMultiplier: 1, gravityDirection: 'normal' })
}

const SPAWN_COLORS = [
  { color: '#d38cff', emissive: '#482266' },
  { color: '#77dfd1', emissive: '#164a49' },
  { color: '#f08b91', emissive: '#5b2028' },
  { color: '#e8d477', emissive: '#514617' },
]

export function spawnPlanet(
  world: PhysicsWorld,
  position: Vector3Tuple = [0, 0, 10],
  velocity?: Vector3Tuple,
  source?: PhysicsBody,
): PhysicsBody {
  const id = `planet-created-${world.nextBodyId++}`
  const definition = SPAWN_COLORS[(world.nextBodyId - 2) % SPAWN_COLORS.length]
  const newPosition: Vector3Tuple = source
    ? [position[0] + 0.48, position[1] + 0.22, position[2] - 0.36]
    : copyVector(position)
  const distance = Math.max(Math.hypot(...newPosition), 0.5)
  const orbitalSpeed = Math.sqrt((GRAVITATIONAL_CONSTANT * STAR_MASS) / distance)
  const newVelocity: Vector3Tuple = velocity
    ? copyVector(velocity)
    : source
      ? copyVector(source.velocity)
      : [-newPosition[2] * orbitalSpeed / distance, 0, newPosition[0] * orbitalSpeed / distance]
  const body: PhysicsBody = {
    id,
    isInitial: false,
    initialMass: source ? source.mass : 0.04,
    name: `Nova ${world.nextBodyId - 1}`,
    distance,
    size: source ? source.size : 0.24,
    mass: source ? source.mass : 0.04,
    color: definition.color,
    emissive: definition.emissive,
    phase: 0,
    tilt: 0.04,
    ...(source?.ringed ? { ringed: true } : {}),
    initialPosition: copyVector(newPosition),
    initialVelocity: copyVector(newVelocity),
    position: copyVector(newPosition),
    velocity: copyVector(newVelocity),
    acceleration: [0, 0, 0],
    previousAcceleration: [0, 0, 0],
  }
  world.bodies.push(body)
  return body
}

export function createBlackHole(
  world: PhysicsWorld,
  position: Vector3Tuple,
  horizonRadius = 0.48,
): BlackHole | null {
  if (world.blackHoles.length >= MAX_BLACK_HOLES) return null
  const serial = world.nextBlackHoleId++
  const blackHole: BlackHole = {
    id: `black-hole-${serial}`,
    name: `Singularity ${serial}`,
    position: copyVector(position),
    mass: 72,
    horizonRadius,
  }
  world.blackHoles.push(blackHole)
  return blackHole
}
