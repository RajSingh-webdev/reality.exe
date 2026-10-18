import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import type { FormEvent, RefObject } from 'react'
import type { ComponentRef } from 'react'
import type {
  BufferAttribute,
  Group,
  Line as ThreeLine,
  Mesh,
  Sprite,
  WebGLProgramParametersWithUniforms,
} from 'three'
import { LandingPage } from './LandingPage'
import { normalizePlanetName, parseRealityCommand } from './commands'
import type { RealityCommand } from './commands'
import {
  advancePhysics,
  createBlackHole,
  createPhysicsWorld,
  MAX_BLACK_HOLES,
  MAX_BODY_MASS,
  MAX_SPEED,
  MIN_BODY_MASS,
  resetPhysicsWorld,
  spawnPlanet,
} from './physics'
import type { BlackHole, GravityDirection, PhysicsBody, PhysicsWorld, Vector3Tuple } from './physics'

const INITIAL_SETTINGS: SimulationSettings = {
  gravityMultiplier: 1,
  gravityDirection: 'normal',
  paused: false,
  timeScale: 1,
}
const FIXED_TIMESTEP = 1 / 120
const MAX_FRAME_DELTA = 0.1
const MAX_ACCUMULATED_TIME = 0.25
const MAX_STEPS_PER_FRAME = 30
const TRAIL_CAPACITY = 180
const TRAIL_INTERVAL = 0.055

interface SimulationSettings {
  gravityMultiplier: number
  gravityDirection: GravityDirection
  paused: boolean
  timeScale: number
}

interface PlanetSnapshot {
  id: string
  kind: 'planet' | 'black-hole'
  name: string
  mass: number
  position: [number, number, number]
  velocity?: [number, number, number]
  speed?: number
  horizonRadius?: number
}

interface CameraRequest {
  version: number
  objectId: string | null
}

interface PlanetTrail {
  geometry: BufferGeometry
  line: ThreeLine<BufferGeometry, LineBasicMaterial>
  attribute: BufferAttribute
  storage: Float32Array
  count: number
  nextIndex: number
  lastSample: number
}

interface Particle {
  position: Vector3Tuple
  velocity: Vector3Tuple
  age: number
  lifetime: number
  color: Color
}

interface SimulationEffect {
  id: number
  position: Vector3Tuple
  particles: Particle[]
  age: number
  color: Color
}

interface EffectStore {
  effects: SimulationEffect[]
  nextId: number
}

const MAX_PARTICLES = 6000
const MAX_DYNAMIC_PLANETS = 20
const MAX_COMMAND_HISTORY = 7

interface CommandHistoryEntry {
  id: number
  command: string
  success: boolean
  warning?: boolean
  message: string
}

interface CommandResult {
  success: boolean
  message: string
  warning?: boolean
}

function addBurst(
  store: EffectStore,
  position: Vector3Tuple,
  count = 480,
  inheritedVelocity: Vector3Tuple = [0, 0, 0],
  sourceColor = '#9deaff',
) {
  const activeParticles = store.effects.reduce((total, effect) => total + effect.particles.length, 0)
  const particleCount = Math.min(count, Math.max(0, MAX_PARTICLES - activeParticles))
  if (particleCount === 0) return
  const color = new Color(sourceColor)
  const particles = Array.from({ length: particleCount }, () => {
    const z = Math.random() * 2 - 1
    const angle = Math.random() * Math.PI * 2
    const horizontal = Math.sqrt(1 - z * z)
    const speed = 0.55 + Math.random() * 2.7
    const fragmentRadius = 0.12 + Math.random() * 0.38
    const highlight = new Color(['#77dfff', '#e1a6ff', '#ffb66e', '#ffffff'][Math.floor(Math.random() * 4)])
    return {
      position: [
        position[0] + Math.cos(angle) * horizontal * fragmentRadius,
        position[1] + z * fragmentRadius,
        position[2] + Math.sin(angle) * horizontal * fragmentRadius,
      ] as Vector3Tuple,
      velocity: [
        Math.cos(angle) * horizontal * speed + inheritedVelocity[0] * 0.32,
        z * speed + inheritedVelocity[1] * 0.32,
        Math.sin(angle) * horizontal * speed + inheritedVelocity[2] * 0.32,
      ] as Vector3Tuple,
      age: 0,
      lifetime: 4.5 + Math.random() * 2.5,
      color: color.clone().lerp(highlight, Math.random() * 0.38),
    }
  })
  store.effects.push({
    id: store.nextId++,
    position: [...position],
    particles,
    age: 0,
    color: color.clone().lerp(new Color('#d9f7ff'), 0.55),
  })
  while (
    store.effects.reduce((total, effect) => total + effect.particles.length, 0) > MAX_PARTICLES
  ) {
    store.effects.shift()
  }
}

function addPlanetSurface(shader: WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vLocalPosition;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPosition = position;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vLocalPosition;')
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 surfaceDirection = normalize(vLocalPosition);
      float latitude = surfaceDirection.y;
      float longitude = atan(surfaceDirection.z, surfaceDirection.x);
      float bands = sin(latitude * 25.0 + sin(longitude * 5.0) * 1.2);
      float marbling = sin(longitude * 8.0 + sin(latitude * 17.0) * 1.6);
      diffuseColor.rgb *= 0.91 + bands * 0.055 + marbling * 0.06;`,
    )
}

function Starfield() {
  const geometries = useMemo(() => {
    const positions = new Float32Array(1800 * 3)
    const colors = new Float32Array(1800 * 3)
    const nearPositions = new Float32Array(520 * 3)
    const nearColors = new Float32Array(520 * 3)
    let seed = 24301
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }

    for (let i = 0; i < 1800; i += 1) {
      const radius = 22 + random() * 42
      const theta = random() * Math.PI * 2
      const vertical = random() * 2 - 1
      const horizontal = Math.sqrt(1 - vertical * vertical)
      positions[i * 3] = Math.cos(theta) * horizontal * radius
      positions[i * 3 + 1] = vertical * radius
      positions[i * 3 + 2] = Math.sin(theta) * horizontal * radius

      const tint = random() > 0.84 ? new Color('#9fcaff') : new Color('#e5edff')
      const brightness = 0.36 + random() * 0.64
      colors[i * 3] = tint.r * brightness
      colors[i * 3 + 1] = tint.g * brightness
      colors[i * 3 + 2] = tint.b * brightness
    }

    const stars = new BufferGeometry()
    stars.setAttribute('position', new Float32BufferAttribute(positions, 3))
    stars.setAttribute('color', new Float32BufferAttribute(colors, 3))
    for (let i = 0; i < 520; i += 1) {
      const radius = 14 + random() * 23
      const theta = random() * Math.PI * 2
      const vertical = random() * 2 - 1
      const horizontal = Math.sqrt(1 - vertical * vertical)
      nearPositions[i * 3] = Math.cos(theta) * horizontal * radius
      nearPositions[i * 3 + 1] = vertical * radius
      nearPositions[i * 3 + 2] = Math.sin(theta) * horizontal * radius
      const tint = random() > 0.76 ? new Color('#ffcfaa') : new Color('#b9dfff')
      const brightness = 0.16 + random() * 0.42
      nearColors[i * 3] = tint.r * brightness
      nearColors[i * 3 + 1] = tint.g * brightness
      nearColors[i * 3 + 2] = tint.b * brightness
    }
    const nearStars = new BufferGeometry()
    nearStars.setAttribute('position', new Float32BufferAttribute(nearPositions, 3))
    nearStars.setAttribute('color', new Float32BufferAttribute(nearColors, 3))
    return [stars, nearStars]
  }, [])

  const nebulaTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to create the nebula texture.')
    const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(130, 105, 255, 0.18)')
    gradient.addColorStop(0.45, 'rgba(54, 130, 221, 0.08)')
    gradient.addColorStop(1, 'rgba(28, 54, 110, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    return new CanvasTexture(canvas)
  }, [])

  useEffect(() => () => {
    geometries.forEach((geometry) => geometry.dispose())
    nebulaTexture.dispose()
  }, [geometries, nebulaTexture])

  return (
    <>
      <points geometry={geometries[0]} frustumCulled={false}>
        <pointsMaterial size={0.09} sizeAttenuation vertexColors transparent opacity={0.9} depthWrite={false} />
      </points>
      <points geometry={geometries[1]} frustumCulled={false}>
        <pointsMaterial size={0.055} sizeAttenuation vertexColors transparent opacity={0.8} depthWrite={false} />
      </points>
      <sprite position={[-15, 8, -28]} scale={[27, 13, 1]}>
        <spriteMaterial map={nebulaTexture} color="#7598ff" transparent opacity={0.65} depthWrite={false} />
      </sprite>
      <sprite position={[18, -9, -35]} scale={[31, 15, 1]}>
        <spriteMaterial map={nebulaTexture} color="#54c7d7" transparent opacity={0.44} depthWrite={false} />
      </sprite>
    </>
  )
}

function Star() {
  const corona = useRef<Sprite>(null)
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to create the star glow texture.')

    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255, 244, 181, 0.8)')
    gradient.addColorStop(0.18, 'rgba(255, 184, 78, 0.7)')
    gradient.addColorStop(0.48, 'rgba(255, 111, 32, 0.28)')
    gradient.addColorStop(0.78, 'rgba(255, 74, 20, 0.07)')
    gradient.addColorStop(1, 'rgba(255, 74, 20, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    return new CanvasTexture(canvas)
  }, [])

  useEffect(() => () => glowTexture.dispose(), [glowTexture])

  useFrame(({ clock }) => {
    if (corona.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.7) * 0.025
      corona.current.scale.set(5.4 * pulse, 5.4 * pulse, 1)
    }
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.92, 48, 48]} />
        <meshStandardMaterial
          color="#ffce75"
          emissive="#ff7a21"
          emissiveIntensity={3.2}
          roughness={0.28}
          toneMapped={false}
        />
      </mesh>
      <sprite ref={corona} scale={[5.4, 5.4, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
      <pointLight color="#ffb553" intensity={115} distance={42} decay={2} />
    </group>
  )
}

function createTrail(body: PhysicsBody): PlanetTrail {
  const geometry = new BufferGeometry()
  const attribute = new Float32BufferAttribute(new Float32Array(TRAIL_CAPACITY * 3), 3)
  attribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', attribute)
  geometry.setDrawRange(0, 0)
  const line = new Line(
    geometry,
    new LineBasicMaterial({
      color: body.color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  )

  return {
    geometry,
    line,
    attribute,
    storage: new Float32Array(TRAIL_CAPACITY * 3),
    count: 0,
    nextIndex: 0,
    lastSample: -Infinity,
  }
}

function clearTrail(trail: PlanetTrail, body: PhysicsBody, simulatedTime: number) {
  trail.count = 0
  trail.nextIndex = 0
  trail.lastSample = -Infinity
  trail.geometry.setDrawRange(0, 0)
  appendTrailPoint(trail, body, simulatedTime)
}

function appendTrailPoint(trail: PlanetTrail, body: PhysicsBody, simulatedTime: number) {
  const offset = trail.nextIndex * 3
  trail.storage[offset] = body.position[0]
  trail.storage[offset + 1] = body.position[1]
  trail.storage[offset + 2] = body.position[2]
  trail.nextIndex = (trail.nextIndex + 1) % TRAIL_CAPACITY
  trail.count = Math.min(trail.count + 1, TRAIL_CAPACITY)
  trail.lastSample = simulatedTime

  const oldestIndex = (trail.nextIndex - trail.count + TRAIL_CAPACITY) % TRAIL_CAPACITY
  const positions = trail.attribute.array as Float32Array
  for (let i = 0; i < trail.count; i += 1) {
    const source = ((oldestIndex + i) % TRAIL_CAPACITY) * 3
    positions[i * 3] = trail.storage[source]
    positions[i * 3 + 1] = trail.storage[source + 1]
    positions[i * 3 + 2] = trail.storage[source + 2]
  }
  trail.attribute.needsUpdate = true
  trail.geometry.setDrawRange(0, trail.count)
}

function getSnapshot(body: PhysicsBody): PlanetSnapshot {
  const [vx, vy, vz] = body.velocity
  return {
    id: body.id,
    kind: 'planet',
    name: body.name,
    mass: body.mass,
    position: [...body.position],
    velocity: [...body.velocity],
    speed: Math.sqrt(vx * vx + vy * vy + vz * vz),
  }
}

function getBlackHoleSnapshot(blackHole: BlackHole): PlanetSnapshot {
  return {
    id: blackHole.id,
    kind: 'black-hole',
    name: blackHole.name,
    mass: blackHole.mass,
    position: [...blackHole.position],
    horizonRadius: blackHole.horizonRadius,
  }
}

function Shockwave({ effect }: { effect: SimulationEffect }) {
  const ring = useRef<Mesh>(null)

  useFrame(() => {
    if (!ring.current) return
    const progress = Math.min(effect.age / 2.8, 1)
    ring.current.scale.setScalar(0.65 + progress * 4.2)
    ;(ring.current.material as MeshBasicMaterial).opacity = (1 - progress) * 0.68
  })

  return (
    <mesh ref={ring} position={effect.position} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.72, 1, 96]} />
      <meshBasicMaterial
        color={effect.color}
        transparent
        opacity={0.68}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function ParticleRenderer({
  effects,
  settingsRef,
  onEffectsChanged,
}: {
  effects: EffectStore
  settingsRef: RefObject<SimulationSettings>
  onEffectsChanged: () => void
}) {
  const points = useRef<import('three').Points>(null)
  const geometry = useMemo(() => {
    const buffer = new BufferGeometry()
    buffer.setAttribute('position', new Float32BufferAttribute(MAX_PARTICLES * 3, 3))
    buffer.setAttribute('color', new Float32BufferAttribute(MAX_PARTICLES * 3, 3))
    return buffer
  }, [])
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to create the particle glow texture.')
    const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.32, 'rgba(255, 255, 255, 0.72)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 32, 32)
    return new CanvasTexture(canvas)
  }, [])

  useEffect(() => () => {
    geometry.dispose()
    particleTexture.dispose()
  }, [geometry, particleTexture])

  useFrame((_, frameDelta) => {
    const step = settingsRef.current.paused
      ? 0
      : Math.min(Math.max(frameDelta, 0), MAX_FRAME_DELTA) * settingsRef.current.timeScale
    const positions = geometry.getAttribute('position') as BufferAttribute
    const colors = geometry.getAttribute('color') as BufferAttribute
    let index = 0

    for (const effect of effects.effects) {
      effect.age += step
      for (const particle of effect.particles) {
        particle.age += step
        if (particle.age >= particle.lifetime) continue
        for (let axis = 0; axis < 3; axis += 1) {
          particle.position[axis] += particle.velocity[axis] * step
          particle.velocity[axis] *= Math.max(0, 1 - step * 0.32)
        }
        const fade = 1 - particle.age / particle.lifetime
        positions.setXYZ(index, ...particle.position)
        colors.setXYZ(index, particle.color.r * fade, particle.color.g * fade, particle.color.b * fade)
        index += 1
      }
    }
    positions.needsUpdate = true
    colors.needsUpdate = true
    geometry.setDrawRange(0, index)

    let expired = false
    for (let i = effects.effects.length - 1; i >= 0; i -= 1) {
      if (effects.effects[i].age > 7.05) {
        effects.effects.splice(i, 1)
        expired = true
      }
    }
    if (expired) onEffectsChanged()
  })

  return (
    <>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          map={particleTexture}
          size={0.16}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      {effects.effects.map((effect) => <Shockwave key={effect.id} effect={effect} />)}
    </>
  )
}

function BlackHoleVisual({
  blackHole,
  selected,
  onSelect,
}: {
  blackHole: BlackHole
  selected: boolean
  onSelect: (id: string) => void
}) {
  const disk = useRef<Group>(null)

  useFrame((_, delta) => {
    if (disk.current) disk.current.rotation.z += delta * 0.22
  })

  return (
    <group position={blackHole.position} onClick={(event) => {
      event.stopPropagation()
      onSelect(blackHole.id)
    }}>
      <mesh>
        <sphereGeometry args={[blackHole.horizonRadius, 40, 40]} />
        <meshBasicMaterial color="#010207" />
      </mesh>
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[blackHole.horizonRadius * 0.94, blackHole.horizonRadius, 72]} />
          <meshBasicMaterial
            color="#8de8ff"
            transparent
            opacity={0.34}
            side={DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      <group ref={disk}>
        <mesh rotation={[Math.PI / 2.4, 0.12, 0]}>
          <torusGeometry args={[blackHole.horizonRadius * 1.8, 0.055, 10, 96]} />
          <meshBasicMaterial color="#ff9b55" transparent opacity={0.8} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0.12, 0]}>
          <torusGeometry args={[blackHole.horizonRadius * 2.25, 0.026, 8, 96]} />
          <meshBasicMaterial color="#81ddff" transparent opacity={0.58} toneMapped={false} />
        </mesh>
      </group>
      <pointLight color="#ff813b" intensity={8} distance={5} decay={2} />
    </group>
  )
}

function SolarSystem({
  world,
  settingsRef,
  selectedId,
  cameraRequest,
  bodyVersion,
  effects,
  worldVersion,
  chaosActive,
  placementMode,
  onSelect,
  onSnapshot,
  onPhysicsFault,
  onBodiesChanged,
  onCaptured,
  onChaosGravityChange,
  onPlaceBlackHole,
  onEffectsChanged,
}: {
  world: PhysicsWorld
  settingsRef: RefObject<SimulationSettings>
  selectedId: string | null
  cameraRequest: CameraRequest
  bodyVersion: number
  effects: EffectStore
  worldVersion: number
  chaosActive: boolean
  placementMode: boolean
  onSelect: (id: string) => void
  onSnapshot: (snapshot: PlanetSnapshot) => void
  onPhysicsFault: () => void
  onBodiesChanged: () => void
  onCaptured: (bodies: PhysicsBody[]) => void
  onChaosGravityChange: (multiplier: number) => void
  onPlaceBlackHole: (position: Vector3Tuple) => void
  onEffectsChanged: () => void
}) {
  const groups = useRef(new Map<string, Group>())
  const meshes = useRef(new Map<string, Mesh>())
  const accumulator = useRef(0)
  const snapshotElapsed = useRef(0)
  const chaosElapsed = useRef(0)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const focusTarget = useRef(new Vector3())
  const focusFrames = useRef(0)
  const lastCameraRequest = useRef(cameraRequest.version)
  const lastResetVersion = useRef(world.resetVersion)
  void worldVersion
  const trails = useMemo(
    () => new Map(world.bodies.map((body) => [body.id, createTrail(body)])),
    [world, bodyVersion],
  )

  useEffect(() => () => {
    for (const trail of trails.values()) {
      trail.geometry.dispose()
      trail.line.material.dispose()
    }
  }, [trails])

  useFrame((_, frameDelta) => {
    if (lastCameraRequest.current !== cameraRequest.version) {
      lastCameraRequest.current = cameraRequest.version
      const body = world.bodies.find((candidate) => candidate.id === cameraRequest.objectId)
      const blackHole = world.blackHoles.find((candidate) => candidate.id === cameraRequest.objectId)
      const target = body?.position ?? blackHole?.position ?? [0, 0, 0]
      focusTarget.current.set(target[0], target[1], target[2])
      focusFrames.current = 1.1
    }
    if (focusFrames.current > 0 && controls.current) {
      const focusDelta = Math.min(Math.max(frameDelta, 0), MAX_FRAME_DELTA)
      controls.current.target.lerp(focusTarget.current, 1 - Math.exp(-focusDelta * 3.2))
      controls.current.update()
      focusFrames.current = Math.max(0, focusFrames.current - focusDelta)
    }

    const resetOccurred = lastResetVersion.current !== world.resetVersion
    if (resetOccurred) {
      lastResetVersion.current = world.resetVersion
      accumulator.current = 0
      snapshotElapsed.current = 0
      for (const body of world.bodies) {
        const trail = trails.get(body.id)
        if (trail) clearTrail(trail, body, world.simulatedTime)
      }
    }

    const settings = settingsRef.current
    const safeFrameDelta = Math.min(Math.max(frameDelta, 0), MAX_FRAME_DELTA)
    if (!settings.paused) {
      accumulator.current = Math.min(
        accumulator.current + safeFrameDelta * settings.timeScale,
        MAX_ACCUMULATED_TIME,
      )

      let steps = 0
      while (accumulator.current >= FIXED_TIMESTEP && steps < MAX_STEPS_PER_FRAME) {
        if (!advancePhysics(world, settings, FIXED_TIMESTEP)) {
          resetPhysicsWorld(world)
          accumulator.current = 0
          onPhysicsFault()
          break
        }
        accumulator.current -= FIXED_TIMESTEP
        steps += 1
      }

      if (world.capturedBodies.length > 0) onCaptured(world.capturedBodies.splice(0))

      for (const body of world.bodies) {
        const group = groups.current.get(body.id)
        const mesh = meshes.current.get(body.id)
        if (group) group.position.set(body.position[0], body.position[1], body.position[2])
        if (mesh) mesh.rotation.y += safeFrameDelta * settings.timeScale * 0.35
      }

      for (const body of world.bodies) {
        const trail = trails.get(body.id)
        if (!trail) continue
        trail.line.material.opacity = selectedId === body.id ? 0.6 : 0.34
        if (world.simulatedTime - trail.lastSample >= TRAIL_INTERVAL) {
          appendTrailPoint(trail, body, world.simulatedTime)
        }
      }
    } else {
      accumulator.current = 0
    }

    if (chaosActive && !settings.paused) {
      chaosElapsed.current += safeFrameDelta
      if (chaosElapsed.current >= 5.5) {
        chaosElapsed.current = 0
        const body =
          world.bodies.find((candidate) => candidate.id === selectedId) ??
          world.bodies[Math.floor(Math.random() * world.bodies.length)]
        if (body) {
          body.velocity[0] += Math.random() * 0.7 - 0.35
          body.velocity[1] += Math.random() * 0.55 - 0.275
          body.velocity[2] += Math.random() * 0.7 - 0.35
          const velocityLength = Math.hypot(...body.velocity)
          if (velocityLength > MAX_SPEED) {
            body.velocity = body.velocity.map((component) => component * MAX_SPEED / velocityLength) as Vector3Tuple
          }
          if (Math.random() > 0.42) addBurst(effects, body.position, 220)
          if (Math.random() > 0.68 && world.blackHoles.length < Math.min(MAX_BLACK_HOLES, 2)) {
            createBlackHole(world, [
              body.position[0] + (Math.random() - 0.5) * 2,
              body.position[1],
              body.position[2] + (Math.random() - 0.5) * 2,
            ], 0.38)
            onBodiesChanged()
          }
        }
        onChaosGravityChange(Math.min(2.6, Math.max(0.25, settings.gravityMultiplier + (Math.random() * 0.36 - 0.18))))
      }
    } else {
      chaosElapsed.current = 0
    }

    if (selectedId) {
      snapshotElapsed.current += frameDelta
      if (snapshotElapsed.current >= 0.12) {
        snapshotElapsed.current = 0
        const selectedBody = world.bodies.find((body) => body.id === selectedId)
        const selectedBlackHole = world.blackHoles.find((blackHole) => blackHole.id === selectedId)
        if (selectedBody) onSnapshot(getSnapshot(selectedBody))
        else if (selectedBlackHole) onSnapshot(getBlackHoleSnapshot(selectedBlackHole))
      }
    }
  })

  return (
    <>
      <Starfield />
      <Star />
      {world.bodies.map((body) => (
        <group key={body.id}>
          <group
            ref={(group) => {
              if (group) groups.current.set(body.id, group)
              else groups.current.delete(body.id)
            }}
          >
            <mesh
              ref={(mesh) => {
                if (mesh) meshes.current.set(body.id, mesh)
                else meshes.current.delete(body.id)
              }}
              onClick={(event) => {
                event.stopPropagation()
                onSelect(body.id)
              }}
              onPointerOver={() => {
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = ''
              }}
            >
              <sphereGeometry args={[body.size, 32, 32]} />
              <meshStandardMaterial
                color={body.color}
                emissive={body.emissive}
                emissiveIntensity={0.22}
                roughness={0.76}
                metalness={0.05}
                onBeforeCompile={addPlanetSurface}
              />
            </mesh>
            <mesh scale={1.045}>
              <sphereGeometry args={[body.size, 24, 24]} />
              <meshBasicMaterial
                color={body.color}
                side={DoubleSide}
                transparent
                opacity={selectedId === body.id ? 0.16 : 0.07}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            {body.ringed && (
              <mesh rotation={[Math.PI / 2.15, 0, 0]}>
                <ringGeometry args={[body.size * 1.35, body.size * 2.05, 64]} />
                <meshStandardMaterial
                  color="#d8bd94"
                  emissive="#624931"
                  emissiveIntensity={0.25}
                  side={DoubleSide}
                  transparent
                  opacity={0.72}
                  roughness={0.85}
                />
              </mesh>
            )}
          </group>
          {trails.has(body.id) && <primitive object={trails.get(body.id)!.line} renderOrder={1} />}
        </group>
      ))}
      {world.blackHoles.map((blackHole) => (
        <BlackHoleVisual
          key={blackHole.id}
          blackHole={blackHole}
          selected={selectedId === blackHole.id}
          onSelect={onSelect}
        />
      ))}
      <ParticleRenderer effects={effects} settingsRef={settingsRef} onEffectsChanged={onEffectsChanged} />
      {placementMode && (
        <mesh
          position={[0, -12, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(event) => {
            event.stopPropagation()
            onPlaceBlackHole([event.point.x, 0, event.point.z])
          }}
        >
          <planeGeometry args={[60, 60]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.06}
        enablePan
        screenSpacePanning
        minDistance={7}
        maxDistance={34}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  )
}

function PhysicsPanel({
  settings,
  blackHoleCount,
  placementMode,
  chaosActive,
  demoActive,
  onChange,
  onReset,
  onSpawn,
  onCreateBlackHole,
  onPlacementToggle,
  onChaosToggle,
  onDemoToggle,
  onOverview,
}: {
  settings: SimulationSettings
  blackHoleCount: number
  placementMode: boolean
  chaosActive: boolean
  demoActive: boolean
  onChange: (settings: SimulationSettings) => void
  onReset: () => void
  onSpawn: () => void
  onCreateBlackHole: () => void
  onPlacementToggle: () => void
  onChaosToggle: () => void
  onDemoToggle: () => void
  onOverview: () => void
}) {
  const setSetting = <K extends keyof SimulationSettings>(
    key: K,
    value: SimulationSettings[K],
  ) => onChange({ ...settings, [key]: value })

  return (
    <section className="physics-panel sci-fi-panel" aria-label="Simulation controls">
      <div className="panel-heading">
        <div>
          <span className="panel-eyebrow">SYSTEM CONTROL</span>
          <h2>Physics</h2>
        </div>
        <span className="panel-indicator" aria-hidden="true" />
      </div>
      <div className="camera-actions">
        <button type="button" onClick={onOverview}>RETURN TO OVERVIEW</button>
        <button type="button" className={demoActive ? 'is-active' : ''} onClick={onDemoToggle}>
          {demoActive ? '■ STOP DEMO' : '▶ DEMO MODE · 66 SEC'}
        </button>
      </div>

      <div className="control-group">
        <div className="control-label-row">
          <label htmlFor="gravity-strength">Gravity strength</label>
          <output htmlFor="gravity-strength">{settings.gravityMultiplier.toFixed(2)}×</output>
        </div>
        <input
          id="gravity-strength"
          className="gravity-slider"
          type="range"
          min="0"
          max="3"
          step="0.05"
          value={settings.gravityMultiplier}
          onChange={(event) => setSetting('gravityMultiplier', Number(event.currentTarget.value))}
        />
        <div className="slider-scale">
          <span>0</span>
          <span>MAX 3×</span>
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Gravity direction</span>
        <div className="segmented-control" role="group" aria-label="Gravity direction">
          {([
            ['normal', 'ATTRACT'],
            ['reverse', 'REPEL'],
            ['zero', 'ZERO'],
          ] as const).map(([direction, label]) => (
            <button
              key={direction}
              type="button"
              className={settings.gravityDirection === direction ? 'is-active' : ''}
              aria-pressed={settings.gravityDirection === direction}
              onClick={() => setSetting('gravityDirection', direction)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Simulation time</span>
        <div className="time-controls">
          <button
            type="button"
            className={`pause-button ${settings.paused ? 'is-active' : ''}`}
            aria-pressed={settings.paused}
            onClick={() => setSetting('paused', !settings.paused)}
          >
            {settings.paused ? '▶ RESUME' : 'Ⅱ PAUSE'}
          </button>
          <div className="speed-control" role="group" aria-label="Simulation speed">
            {[
              { value: 0.25, label: '¼×' },
              { value: 1, label: '1×' },
              { value: 2, label: '2×' },
              { value: 5, label: '5×' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={settings.timeScale === value ? 'is-active' : ''}
                aria-pressed={settings.timeScale === value}
                onClick={() => setSetting('timeScale', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="control-group matter-controls">
        <span className="control-label">Matter &amp; anomalies</span>
        <div className="action-grid">
          <button type="button" onClick={onSpawn}>SPAWN PLANET</button>
          <button type="button" onClick={onCreateBlackHole} disabled={blackHoleCount >= MAX_BLACK_HOLES}>
            CREATE BLACK HOLE
          </button>
        </div>
        <button
          type="button"
          className={placementMode ? 'action-button is-active' : 'action-button'}
          onClick={onPlacementToggle}
          disabled={blackHoleCount >= MAX_BLACK_HOLES}
        >
          {placementMode ? 'CLICK UNIVERSE TO PLACE · ESC TO CANCEL' : 'PLACE BLACK HOLE'}
        </button>
        <button
          type="button"
          className={chaosActive ? 'chaos-button is-active' : 'chaos-button'}
          aria-pressed={chaosActive}
          onClick={onChaosToggle}
        >
          {chaosActive ? '■ STOP CHAOS MODE' : '⚡ CHAOS MODE'}
        </button>
        <span className="control-hint">{blackHoleCount}/{MAX_BLACK_HOLES} singularities</span>
      </div>

      <button type="button" className="reset-button" onClick={onReset}>
        RESET UNIVERSE
      </button>
    </section>
  )
}

function ObjectPanel({
  snapshot,
  onImpulse,
  onFocus,
  onDisintegrate,
  onDuplicate,
  onMassChange,
  onRemoveBlackHole,
  onHorizonChange,
  onDismiss,
}: {
  snapshot: PlanetSnapshot | null
  onImpulse: () => void
  onFocus: () => void
  onDisintegrate: () => void
  onDuplicate: () => void
  onMassChange: (direction: -1 | 1) => void
  onRemoveBlackHole: () => void
  onHorizonChange: (radius: number) => void
  onDismiss: () => void
}) {
  if (!snapshot) return null

  const formatVector = (vector: number[]) =>
    `[${vector.map((component) => component.toFixed(2)).join(', ')}]`

  return (
    <section className="object-panel sci-fi-panel" aria-label={`${snapshot.name} telemetry`}>
      <div className="panel-heading object-heading">
        <div>
          <span className="panel-eyebrow">OBJECT TELEMETRY</span>
          <h2>{snapshot.name}</h2>
        </div>
        <button type="button" className="dismiss-button" aria-label="Close telemetry" onClick={onDismiss}>
          ×
        </button>
      </div>
      <dl className="telemetry-grid">
        <dt>Mass</dt>
        <dd>{snapshot.mass.toFixed(2)} MU</dd>
        <dt>Position</dt>
        <dd>{formatVector(snapshot.position)} SU</dd>
        {snapshot.velocity && (
          <>
            <dt>Velocity</dt>
            <dd>{formatVector(snapshot.velocity)} SU/s</dd>
            <dt>Speed</dt>
            <dd>{snapshot.speed?.toFixed(2)} SU/s</dd>
          </>
        )}
        {snapshot.horizonRadius !== undefined && (
          <>
            <dt>Horizon</dt>
            <dd>{snapshot.horizonRadius.toFixed(2)} SU</dd>
          </>
        )}
      </dl>
      <button type="button" className="focus-button" onClick={onFocus}>FOCUS CAMERA ON OBJECT</button>
      {snapshot.kind === 'planet' ? (
        <>
          <div className="object-actions">
            <button type="button" onClick={() => onMassChange(-1)}>− MASS</button>
            <button type="button" onClick={() => onMassChange(1)}>+ MASS</button>
            <button type="button" onClick={onDuplicate}>DUPLICATE</button>
          </div>
          <button type="button" className="impulse-button" onClick={onImpulse}>
            APPLY +TANGENT IMPULSE
          </button>
          <button type="button" className="danger-button" onClick={onDisintegrate}>
            ✦ DISINTEGRATE
          </button>
        </>
      ) : (
        <>
          <label className="horizon-control">
            Event horizon <output>{snapshot.horizonRadius?.toFixed(2)} SU</output>
            <input
              type="range"
              min="0.2"
              max="1.4"
              step="0.05"
              value={snapshot.horizonRadius}
              onChange={(event) => onHorizonChange(Number(event.currentTarget.value))}
            />
          </label>
          <button type="button" className="danger-button" onClick={onRemoveBlackHole}>
            REMOVE BLACK HOLE
          </button>
        </>
      )}
    </section>
  )
}

function CommandConsole({
  onExecute,
}: {
  onExecute: (text: string) => CommandResult
}) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<CommandHistoryEntry[]>([])
  const [nextId, setNextId] = useState(1)
  const lastResult = history[0]
  const suggestions = [
    'REVERSE GRAVITY',
    'CREATE A BLACK HOLE NEAR CINDER',
    'FREEZE TIME',
    'ACTIVATE CHAOS MODE',
    'RESTORE THE UNIVERSE',
  ]

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const commandText = input.trim()
    const result = onExecute(commandText)
    setHistory((entries) => [
      {
        id: nextId,
        command: commandText || '(empty command)',
        ...result,
      },
      ...entries,
    ].slice(0, MAX_COMMAND_HISTORY))
    setNextId((id) => id + 1)
    setInput('')
  }

  return (
    <section className="command-console sci-fi-panel" aria-label="Reality command console">
      <div className="console-heading">
        <div>
          <span className="panel-eyebrow">REALITY.EXE / INPUT</span>
          <h2>Command Console</h2>
        </div>
        <span
          className={`console-status ${lastResult
            ? lastResult.warning
              ? 'is-warning'
              : lastResult.success
                ? 'is-success'
                : 'is-error'
            : ''}`}
        >
          <span aria-hidden="true" />
          {lastResult ? (lastResult.warning ? 'WARNING' : lastResult.success ? 'EXECUTED' : 'ERROR') : 'READY'}
        </span>
      </div>
      <form className="console-form" onSubmit={submit}>
        <input
          aria-label="Command"
          autoComplete="off"
          placeholder="Enter a reality command…"
          value={input}
          onChange={(event) => setInput(event.currentTarget.value)}
        />
        <button type="submit">EXECUTE</button>
      </form>
      <div className="command-suggestions" aria-label="Suggested commands">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => setInput(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <div className="history-toolbar">
        <span>EVENT LOG · {history.length}/{MAX_COMMAND_HISTORY}</span>
        <button type="button" onClick={() => setHistory([])} disabled={history.length === 0}>
          CLEAR
        </button>
      </div>
      <div className="command-history" aria-label="Command history" aria-live="polite">
        {history.length === 0 ? (
          <p className="console-empty">Awaiting command input…</p>
        ) : (
          history.map((entry) => (
            <article
              key={entry.id}
              className={`command-entry ${entry.warning ? 'is-warning' : entry.success ? 'is-success' : 'is-error'}`}
            >
              <p className="command-entry-input"><span>&gt;</span> {entry.command}</p>
              <p className="command-entry-result">{entry.message}</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function App() {
  const [showLanding, setShowLanding] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash !== '#universe' && !window.location.search.includes('play=1')
    }
    return true
  })

  useEffect(() => {
    const handleHashChange = () => {
      setShowLanding(window.location.hash !== '#universe' && !window.location.search.includes('play=1'))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const enterUniverse = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = 'universe'
    }
    setShowLanding(false)
  }

  const exitToLanding = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = ''
    }
    setShowLanding(true)
  }

  const [world] = useState(createPhysicsWorld)
  const [settings, setSettings] = useState(INITIAL_SETTINGS)
  const settingsRef = useRef(settings)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [snapshot, setSnapshot] = useState<PlanetSnapshot | null>(null)
  const [physicsFault, setPhysicsFault] = useState(false)
  const [worldVersion, setWorldVersion] = useState(0)
  const [bodyVersion, setBodyVersion] = useState(0)
  const [effectsVersion, setEffectsVersion] = useState(0)
  const [chaosActive, setChaosActive] = useState(false)
  const [demoActive, setDemoActive] = useState(false)
  const [demoCaption, setDemoCaption] = useState('')
  const [placementMode, setPlacementMode] = useState(false)
  const [message, setMessage] = useState('')
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>({ version: 0, objectId: null })
  const demoCommandRef = useRef<(text: string) => CommandResult>(() => ({
    success: false,
    message: 'Demo command system is not ready.',
  }))
  const effects = useRef<EffectStore>({ effects: [], nextId: 1 })

  const changeSettings = (next: SimulationSettings) => {
    settingsRef.current = next
    setSettings(next)
  }

  const refreshWorld = () => setWorldVersion((version) => version + 1)
  const changeSelection = (id: string | null) => {
    selectedIdRef.current = id
    setSelectedId(id)
  }
  const refreshBodies = () => {
    setBodyVersion((version) => version + 1)
    refreshWorld()
  }
  const addEffect = (
    position: Vector3Tuple,
    count?: number,
    velocity?: Vector3Tuple,
    color?: string,
  ) => {
    addBurst(effects.current, position, count, velocity, color)
    setEffectsVersion((version) => version + 1)
  }

  const selectObject = (id: string) => {
    changeSelection(id)
    const body = world.bodies.find((candidate) => candidate.id === id)
    const blackHole = world.blackHoles.find((candidate) => candidate.id === id)
    if (body) setSnapshot(getSnapshot(body))
    else if (blackHole) setSnapshot(getBlackHoleSnapshot(blackHole))
  }

  const applyImpulse = () => {
    if (!selectedId) return
    const body = world.bodies.find((planet) => planet.id === selectedId)
    if (!body) return

    const tangentX = -body.position[2]
    const tangentZ = body.position[0]
    const tangentLength = Math.hypot(tangentX, tangentZ)
    if (tangentLength > 0) {
      body.velocity[0] += (tangentX / tangentLength) * 0.8
      body.velocity[2] += (tangentZ / tangentLength) * 0.8
    } else {
      body.velocity[0] += 0.8
    }

    const speed = Math.hypot(...body.velocity)
    if (speed > MAX_SPEED) body.velocity = body.velocity.map((value) => value * MAX_SPEED / speed) as Vector3Tuple
    setSnapshot(getSnapshot(body))
  }

  const spawnNewPlanet = (): PhysicsBody | null => {
    if (world.bodies.filter((body) => !body.isInitial).length >= MAX_DYNAMIC_PLANETS) {
      setMessage('Dynamic planet limit reached.')
      return null
    }
    const body = spawnPlanet(world)
    changeSelection(body.id)
    setSnapshot(getSnapshot(body))
    setMessage('')
    refreshBodies()
    return body
  }

  const duplicateSelectedPlanet = (targetId = selectedIdRef.current): PhysicsBody | null => {
    const source = world.bodies.find((body) => body.id === targetId)
    if (!source) return null
    if (world.bodies.filter((body) => !body.isInitial).length >= MAX_DYNAMIC_PLANETS) {
      setMessage('Dynamic planet limit reached.')
      return null
    }
    const duplicate = spawnPlanet(world, source.position, source.velocity, source)
    changeSelection(duplicate.id)
    setSnapshot(getSnapshot(duplicate))
    setMessage('')
    refreshBodies()
    return duplicate
  }

  const changeSelectedMass = (direction: -1 | 1, targetId = selectedIdRef.current) => {
    const body = world.bodies.find((candidate) => candidate.id === targetId)
    if (!body) return null
    body.mass = Math.min(MAX_BODY_MASS, Math.max(MIN_BODY_MASS, body.mass * (direction > 0 ? 1.25 : 0.8)))
    if (body.id === selectedIdRef.current) setSnapshot(getSnapshot(body))
    return body
  }

  const disintegrateSelectedPlanet = (targetId = selectedIdRef.current): PhysicsBody | null => {
    const index = world.bodies.findIndex((body) => body.id === targetId)
    if (index < 0) return null
    const [body] = world.bodies.splice(index, 1)
    addEffect(body.position, 720, body.velocity, body.color)
    if (body.id === selectedIdRef.current) {
      changeSelection(null)
      setSnapshot(null)
    }
    refreshBodies()
    return body
  }

  const enterBlackHolePlacement = () => {
    if (world.blackHoles.length >= MAX_BLACK_HOLES) {
      setMessage(`Maximum of ${MAX_BLACK_HOLES} black holes reached.`)
      return
    }
    const selectedBody = world.bodies.find((body) => body.id === selectedId)
    if (selectedBody) {
      const blackHole = createBlackHole(world, selectedBody.position)
      if (blackHole) {
        changeSelection(blackHole.id)
        setSnapshot(getBlackHoleSnapshot(blackHole))
        setPlacementMode(false)
        setMessage('')
        refreshWorld()
      }
    } else {
      setPlacementMode(true)
      setMessage('Click an open point in the universe to place the black hole.')
    }
  }

  const placeBlackHole = (position: Vector3Tuple) => {
    const blackHole = createBlackHole(world, position)
    if (!blackHole) {
      setMessage(`Maximum of ${MAX_BLACK_HOLES} black holes reached.`)
      setPlacementMode(false)
      return
    }
    setPlacementMode(false)
    setMessage('')
    changeSelection(blackHole.id)
    setSnapshot(getBlackHoleSnapshot(blackHole))
    refreshWorld()
  }

  const removeSelectedBlackHole = (targetId = selectedIdRef.current): BlackHole | null => {
    const index = world.blackHoles.findIndex((blackHole) => blackHole.id === targetId)
    if (index < 0) return null
    const [removed] = world.blackHoles.splice(index, 1)
    changeSelection(null)
    setSnapshot(null)
    refreshWorld()
    return removed
  }

  const setSelectedHorizon = (radius: number) => {
    const blackHole = world.blackHoles.find((candidate) => candidate.id === selectedId)
    if (!blackHole) return
    blackHole.horizonRadius = radius
    setSnapshot(getBlackHoleSnapshot(blackHole))
  }

  const handleCapturedBodies = (captured: PhysicsBody[]) => {
    for (const body of captured) addEffect(body.position, 360, body.velocity, body.color)
    if (captured.some((body) => body.id === selectedIdRef.current)) {
      changeSelection(null)
      setSnapshot(null)
    }
    refreshBodies()
  }

  const resetUniverse = () => {
    resetPhysicsWorld(world)
    changeSettings({ ...INITIAL_SETTINGS })
    changeSelection(null)
    setSnapshot(null)
    setPhysicsFault(false)
    setChaosActive(false)
    setDemoActive(false)
    setDemoCaption('')
    setPlacementMode(false)
    setMessage('')
    effects.current.effects.length = 0
    setEffectsVersion((version) => version + 1)
    refreshBodies()
  }

  const reportPhysicsFault = () => {
    resetPhysicsWorld(world)
    effects.current.effects.length = 0
    changeSelection(null)
    setSnapshot(null)
    setChaosActive(false)
    setDemoActive(false)
    setDemoCaption('')
    setPlacementMode(false)
    refreshBodies()
    setPhysicsFault(true)
    changeSettings({ ...settingsRef.current, paused: true })
  }

  useEffect(() => {
    if (!placementMode) return
    const cancelPlacement = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlacementMode(false)
        setMessage('')
      }
    }
    window.addEventListener('keydown', cancelPlacement)
    return () => window.removeEventListener('keydown', cancelPlacement)
  }, [placementMode])

  const setChaosGravity = (gravityMultiplier: number) => {
    changeSettings({ ...settingsRef.current, gravityMultiplier })
  }

  const executeCommand = (input: string): CommandResult => {
    const parsed = parseRealityCommand(input)
    if (!parsed.success) return { success: false, message: parsed.message }

    const command: RealityCommand = parsed.command
    const findPlanet = (name: string) =>
      world.bodies.find((body) => normalizePlanetName(body.name) === normalizePlanetName(name))
    const createHole = (position: Vector3Tuple) => {
      const blackHole = createBlackHole(world, position)
      if (!blackHole) {
        return { success: false, message: `The universe already contains ${MAX_BLACK_HOLES} black holes.` }
      }
      changeSelection(blackHole.id)
      setSnapshot(getBlackHoleSnapshot(blackHole))
      refreshWorld()
      return { success: true, message: `${blackHole.name} created. Its gravity is active.` }
    }

    switch (command.type) {
      case 'create-black-hole': {
        if (command.planetName) {
          const body = findPlanet(command.planetName)
          if (!body) return { success: false, message: `No active planet named “${command.planetName}”.` }
          const position: Vector3Tuple = [body.position[0] + 1, body.position[1], body.position[2]]
          return createHole(position)
        }
        const selectedBody = world.bodies.find((body) => body.id === selectedIdRef.current)
        if (selectedBody) return createHole([...selectedBody.position])
        if (world.blackHoles.length >= MAX_BLACK_HOLES) {
          return { success: false, message: `The universe already contains ${MAX_BLACK_HOLES} black holes.` }
        }
        setPlacementMode(true)
        setMessage('Click an open point in the universe to place the black hole.')
        return {
          success: true,
          warning: true,
          message: 'Placement armed. Click an open point in the universe.',
        }
      }
      case 'remove-black-hole': {
        if (!world.blackHoles.some((blackHole) => blackHole.id === selectedIdRef.current)) {
          return { success: false, message: 'Select a black hole before removing it.' }
        }
        const removed = removeSelectedBlackHole()
        return removed
          ? { success: true, message: `${removed.name} removed from the universe.` }
          : { success: false, message: 'The selected black hole is no longer active.' }
      }
      case 'disintegrate-selected': {
        const selected = world.bodies.find((body) => body.id === selectedIdRef.current)
        if (!selected) return { success: false, message: 'Select a planet before disintegrating it.' }
        disintegrateSelectedPlanet(selected.id)
        return { success: true, message: `${selected.name} disintegrated into particles.` }
      }
      case 'destroy-planet': {
        const body = findPlanet(command.planetName)
        if (!body) return { success: false, message: `No active planet named “${command.planetName}”.` }
        disintegrateSelectedPlanet(body.id)
        return { success: true, message: `${body.name} destroyed; particle burst generated.` }
      }
      case 'gravity-direction': {
        const gravityMultiplier = command.direction === 'zero' ? 0 : command.direction === 'normal' ? 1 : settingsRef.current.gravityMultiplier || 1
        changeSettings({ ...settingsRef.current, gravityMultiplier, gravityDirection: command.direction })
        const labels = { normal: 'Normal gravity restored at 1×.', reverse: 'Gravity is now repulsive.', zero: 'Gravity set to zero.' }
        return { success: true, message: labels[command.direction] }
      }
      case 'gravity-strength':
        changeSettings({
          ...settingsRef.current,
          gravityMultiplier: command.value,
          gravityDirection: 'normal',
        })
        return {
          success: true,
          message: `Gravity strength set to ${command.value}×${command.value === 3 ? ' (maximum)' : ''}.`,
        }
      case 'pause':
        changeSettings({ ...settingsRef.current, paused: command.paused })
        return {
          success: true,
          message: command.paused ? 'Simulation frozen. Camera controls remain active.' : 'Simulation resumed.',
        }
      case 'time-speed':
        changeSettings({ ...settingsRef.current, timeScale: command.value })
        return {
          success: true,
          message: `Simulation speed set to ${command.value}×${command.value === 5 ? ' (maximum)' : ''}.`,
        }
      case 'spawn-planet': {
        const body = spawnNewPlanet()
        return body
          ? { success: true, message: `${body.name} spawned and added to the physics simulation.` }
          : { success: false, message: 'Planet limit reached; no planet was spawned.' }
      }
      case 'duplicate-selected': {
        if (!world.bodies.some((body) => body.id === selectedIdRef.current)) {
          return { success: false, message: 'Select a planet before duplicating it.' }
        }
        const body = duplicateSelectedPlanet()
        return body
          ? { success: true, message: `${body.name} duplicated with an offset and active gravity.` }
          : { success: false, message: 'Planet limit reached; the selected planet was not duplicated.' }
      }
      case 'planet-mass': {
        const body = findPlanet(command.planetName)
        if (!body) return { success: false, message: `No active planet named “${command.planetName}”.` }
        const requestedMass = body.mass * command.factor
        body.mass = Math.min(MAX_BODY_MASS, Math.max(MIN_BODY_MASS, requestedMass))
        if (body.id === selectedIdRef.current) setSnapshot(getSnapshot(body))
        const limitNote = body.mass !== requestedMass ? ' (clamped to the supported mass range)' : ''
        return {
          success: true,
          warning: body.mass !== requestedMass,
          message: `${body.name} mass is now ${body.mass.toFixed(3)} MU${limitNote}.`,
        }
      }
      case 'chaos':
        setChaosActive(command.active)
        if (command.active) setPlacementMode(false)
        return {
          success: true,
          message: command.active ? 'Chaos Mode activated; bounded events begin on the next interval.' : 'Chaos Mode stopped.',
        }
      case 'reset':
        resetUniverse()
        return { success: true, message: 'Universe restored. Temporary objects and effects cleared.' }
    }
  }

  demoCommandRef.current = executeCommand

  useEffect(() => {
    if (!demoActive) return
    const runStep = (command: string, caption: string) => {
      const result = demoCommandRef.current(command)
      setDemoCaption(
        result.success
          ? `${caption} — ${result.message}`
          : `${caption} — ACTION FAILED: ${result.message}`,
      )
    }
    const timers = [
      window.setTimeout(() => setDemoCaption('ACT 1 · THE UNIVERSE — baseline orbital motion established.'), 0),
      window.setTimeout(() => runStep('REVERSE GRAVITY', 'ACT 2 · PHYSICS BREAKDOWN'), 8000),
      window.setTimeout(() => runStep('RESTORE NORMAL GRAVITY', 'ACT 3 · GRAVITY RE-ENGAGED'), 16000),
      window.setTimeout(() => runStep('CREATE A BLACK HOLE NEAR AURELIA', 'ACT 3 · SINGULARITY'), 19000),
      window.setTimeout(() => runStep('DESTROY VESPER', 'ACT 4 · DESTRUCTION'), 32000),
      window.setTimeout(() => runStep('ACTIVATE CHAOS MODE', 'ACT 5 · CHAOS'), 45000),
      window.setTimeout(() => runStep('STOP CHAOS MODE', 'ACT 5 · CHAOS CONTAINED'), 57000),
      window.setTimeout(() => {
        const result = demoCommandRef.current('RESTORE THE UNIVERSE')
        setDemoCaption(result.success ? 'ACT 6 · RESTORATION — the original universe is restored.' : result.message)
        setDemoActive(false)
      }, 66000),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [demoActive])

  const startDemo = () => {
    resetUniverse()
    setDemoCaption('DEMO INITIALIZING…')
    setDemoActive(true)
  }

  const stopDemo = () => {
    resetUniverse()
    setDemoCaption('DEMO STOPPED — the original universe is restored.')
  }

  const requestCameraFocus = (objectId: string | null) => {
    setCameraRequest((request) => ({ version: request.version + 1, objectId }))
  }

  return (
    <main
      className="universe min-h-svh overflow-hidden bg-[#05070d] text-white"
      data-world-version={worldVersion}
      data-effects-version={effectsVersion}
    >
      <div className="universe-glow" aria-hidden="true" />
      <Canvas
        className="planet-canvas"
        camera={{ position: [0, 13, 24], fov: 42 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.14} />
        <Suspense fallback={null}>
          <SolarSystem
            world={world}
            settingsRef={settingsRef}
            selectedId={selectedId}
            cameraRequest={cameraRequest}
            bodyVersion={bodyVersion}
            effects={effects.current}
            worldVersion={worldVersion}
            chaosActive={chaosActive}
            placementMode={placementMode}
            onSelect={selectObject}
            onSnapshot={setSnapshot}
            onPhysicsFault={reportPhysicsFault}
            onBodiesChanged={refreshWorld}
            onCaptured={handleCapturedBodies}
            onChaosGravityChange={setChaosGravity}
            onPlaceBlackHole={placeBlackHole}
            onEffectsChanged={() => setEffectsVersion((version) => version + 1)}
          />
        </Suspense>
      </Canvas>

      <header className="interface-header absolute inset-x-0 top-0 z-10 flex items-center justify-between">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <h1 className="font-mono text-sm font-semibold tracking-[0.28em] sm:text-base">
            REALITY<span className="text-cyan-300">.EXE</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exitToLanding}
            className="landing-overview-btn"
            title="Return to Landing Page & Briefing"
          >
            <span>←</span> BRIEFING / OVERVIEW
          </button>
          <div className="status font-mono text-[9px] tracking-[0.18em] sm:text-[10px]">
            <span className="status-light" aria-hidden="true" />
            UNIVERSE ONLINE
          </div>
        </div>
      </header>

      <div className="coordinate font-mono" aria-hidden="true">
        <span>SECTOR 01</span>
        <span>LOCAL UNIVERSE</span>
      </div>
      <div className="horizon-label font-mono" aria-hidden="true">
        A SIMULATION IN PROGRESS
      </div>

      <PhysicsPanel
        settings={settings}
        blackHoleCount={world.blackHoles.length}
        placementMode={placementMode}
        chaosActive={chaosActive}
        demoActive={demoActive}
        onChange={changeSettings}
        onReset={resetUniverse}
        onSpawn={spawnNewPlanet}
        onCreateBlackHole={enterBlackHolePlacement}
        onPlacementToggle={() => setPlacementMode((active) => !active)}
        onChaosToggle={() => {
          setChaosActive((active) => !active)
          setPlacementMode(false)
          setMessage('')
        }}
        onDemoToggle={demoActive ? stopDemo : startDemo}
        onOverview={() => requestCameraFocus(null)}
      />
      <CommandConsole onExecute={executeCommand} />
      <ObjectPanel
        snapshot={snapshot}
        onImpulse={applyImpulse}
        onFocus={() => requestCameraFocus(snapshot?.id ?? null)}
        onDisintegrate={disintegrateSelectedPlanet}
        onDuplicate={duplicateSelectedPlanet}
        onMassChange={changeSelectedMass}
        onRemoveBlackHole={removeSelectedBlackHole}
        onHorizonChange={setSelectedHorizon}
        onDismiss={() => {
          changeSelection(null)
          setSnapshot(null)
        }}
      />
      {demoCaption && (
        <div className="demo-banner" role="status" aria-live="polite">
          <span className="demo-banner-label">{demoActive ? 'DEMO SEQUENCE' : 'DEMO STATUS'}</span>
          <span>{demoCaption}</span>
          {demoActive && <button type="button" onClick={stopDemo}>EXIT DEMO</button>}
        </div>
      )}
      {message && <div className="physics-warning" role="status">{message}</div>}
      {physicsFault && (
        <div className="physics-warning" role="alert">
          Numerical instability detected. The universe was restored to initial conditions and paused; review gravity and speed settings before resuming.
        </div>
      )}
      {showLanding && <LandingPage onEnter={enterUniverse} />}
    </main>
  )
}

export default App
