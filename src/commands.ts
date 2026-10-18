export type RealityCommand =
  | { type: 'create-black-hole'; planetName?: string }
  | { type: 'remove-black-hole' }
  | { type: 'disintegrate-selected' }
  | { type: 'destroy-planet'; planetName: string }
  | { type: 'gravity-direction'; direction: 'normal' | 'reverse' | 'zero' }
  | { type: 'gravity-strength'; value: number }
  | { type: 'pause'; paused: boolean }
  | { type: 'time-speed'; value: number }
  | { type: 'spawn-planet' }
  | { type: 'duplicate-selected' }
  | { type: 'planet-mass'; planetName: string; factor: number }
  | { type: 'chaos'; active: boolean }
  | { type: 'reset' }

export type CommandParseResult =
  | { success: true; command: RealityCommand }
  | { success: false; message: string }

const GRAVITY_MAX = 3
const TIME_SPEED_MAX = 5
const NUMBER_PATTERN = '([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?)'

function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/×/g, 'X')
    .replace(/(?<=[\p{L}])[-_]+(?=[\p{L}])/gu, ' ')
    .replace(/[!?,;:()[\]{}"'`]/g, ' ')
    .replace(/(?<!\d)\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function normalizePlanetName(name: string): string {
  return name
    .trim()
    .replace(/(?<=[\p{L}])[-_]+(?=[\p{L}])/gu, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function parseNonNegativeNumber(value: string, commandName: string): number | string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `Enter a finite number for ${commandName}.`
  if (parsed < 0) return `${commandName} cannot be negative.`
  return parsed
}

export function parseRealityCommand(input: string): CommandParseResult {
  const normalized = normalizeInput(input)
  if (!normalized) return { success: false, message: 'Enter a command to execute.' }

  const exactCommands: Record<string, RealityCommand> = {
    'CREATE A BLACK HOLE': { type: 'create-black-hole' },
    'REMOVE THE SELECTED BLACK HOLE': { type: 'remove-black-hole' },
    'DISINTEGRATE THE SELECTED PLANET': { type: 'disintegrate-selected' },
    'REVERSE GRAVITY': { type: 'gravity-direction', direction: 'reverse' },
    'RESTORE NORMAL GRAVITY': { type: 'gravity-direction', direction: 'normal' },
    'SET GRAVITY TO ZERO': { type: 'gravity-direction', direction: 'zero' },
    'FREEZE TIME': { type: 'pause', paused: true },
    'RESUME SIMULATION': { type: 'pause', paused: false },
    'SPAWN A NEW PLANET': { type: 'spawn-planet' },
    'DUPLICATE THE SELECTED PLANET': { type: 'duplicate-selected' },
    'ACTIVATE CHAOS MODE': { type: 'chaos', active: true },
    'STOP CHAOS MODE': { type: 'chaos', active: false },
    'RESTORE THE UNIVERSE': { type: 'reset' },
  }
  const exact = exactCommands[normalized]
  if (exact) return { success: true, command: exact }

  const blackHoleNear = normalized.match(/^CREATE A BLACK HOLE NEAR(?:\s+(.+))?$/)
  if (blackHoleNear) {
    const planetName = normalizePlanetName(blackHoleNear[1] ?? '')
    return planetName
      ? { success: true, command: { type: 'create-black-hole', planetName } }
      : { success: false, message: 'Name a planet after “CREATE A BLACK HOLE NEAR”.' }
  }

  const destroy = normalized.match(/^DESTROY(?:\s+(.+))?$/)
  if (destroy) {
    const planetName = normalizePlanetName(destroy[1] ?? '')
    return planetName
      ? { success: true, command: { type: 'destroy-planet', planetName } }
      : { success: false, message: 'Name a planet after “DESTROY”.' }
  }

  const gravity = normalized.match(new RegExp(`^INCREASE GRAVITY TO ${NUMBER_PATTERN}\\s*X$`))
  if (gravity) {
    const value = parseNonNegativeNumber(gravity[1], 'Gravity strength')
    if (typeof value === 'string') return { success: false, message: value }
    return {
      success: true,
      command: { type: 'gravity-strength', value: Math.min(value, GRAVITY_MAX) },
    }
  }

  const timeSpeed = normalized.match(new RegExp(`^SET TIME SPEED TO ${NUMBER_PATTERN}\\s*X$`))
  if (timeSpeed) {
    const value = parseNonNegativeNumber(timeSpeed[1], 'Time speed')
    if (typeof value === 'string') return { success: false, message: value }
    return {
      success: true,
      command: { type: 'time-speed', value: Math.min(value, TIME_SPEED_MAX) },
    }
  }

  const mass = normalized.match(new RegExp(`^MAKE(?:\\s+(.+))?\\s+${NUMBER_PATTERN}\\s+TIMES? MORE MASSIVE$`))
  if (mass) {
    const planetName = normalizePlanetName(mass[1] ?? '')
    if (!planetName) return { success: false, message: 'Name a planet whose mass should change.' }
    const factor = parseNonNegativeNumber(mass[2], 'Mass multiplier')
    if (typeof factor === 'string') return { success: false, message: factor }
    if (factor === 0) return { success: false, message: 'Mass multiplier must be greater than zero.' }
    return { success: true, command: { type: 'planet-mass', planetName, factor } }
  }

  if (/^(?:MAKE|DESTROY|CREATE A BLACK HOLE NEAR)(?:\s|$)/.test(normalized)) {
    return { success: false, message: 'This command is missing a required planet name or has invalid syntax.' }
  }
  if (/^(?:INCREASE GRAVITY TO|SET TIME SPEED TO)(?:\s|$)/.test(normalized)) {
    return { success: false, message: 'Enter a valid non-negative number followed by X.' }
  }
  return { success: false, message: 'Unknown command. Choose a suggestion or enter a supported command.' }
}
