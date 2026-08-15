/** DON'T WALK — testable intersection logic. One bit of signal. One tap. */

export const SHIFT_DURATION = 75
export const AMBER_DURATION = 0.6
export const SITTING_MIN = 8
export const SITTING_MAX = 12
export const BREATH_DURATION = 10
export const BIAS_THRESHOLD = 3
export const MAX_CARS = 8
export const MAX_PEOPLE = 6
export const BASE_PEOPLE_QUOTA = 6
export const BASE_CARS_QUOTA = 6
export const QUOTA_PER_DENSITY = 2
export const DEFAULT_STOP_T = 0.26
export const DEFAULT_EXIT_T = 0.74
export const CAR_GAP = 0.14
export const PERSON_GAP = 0.10

export const CAR_COLORS = [
  '#e85d4c',
  '#3d9b8f',
  '#f0e6d0',
  '#4a6fa5',
  '#c4a35a',
  '#2d2d32',
  '#8b5a7a',
  '#6b8f71',
]

export const PERSON_TONES = [
  '#1a1a1c',
  '#222228',
  '#2a2430',
  '#1c2420',
  '#26201c',
  '#201c24',
]

function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function quotasFor(density) {
  const d = Math.max(1, Math.floor(density))
  return {
    people: BASE_PEOPLE_QUOTA + (d - 1) * QUOTA_PER_DENSITY,
    cars: BASE_CARS_QUOTA + (d - 1) * QUOTA_PER_DENSITY,
  }
}

export function patienceLevel(patience) {
  if (patience > 0.5) return 'calm'
  if (patience > 0.2) return 'tight'
  return 'flashing'
}

export function oppositeSignal(signal) {
  return signal === 'cars' ? 'people' : 'cars'
}

export function peopleHaveWalk(game) {
  return game.signal === 'people'
}

export function carsHaveGreen(game) {
  return game.signal === 'cars'
}

export function isCommitted(actor) {
  return Boolean(actor.committed && actor.t > actor.stopT && actor.t < actor.exitT)
}

export function hasCommitted(game) {
  return game.actors.some(isCommitted)
}

export function quotasMet(game) {
  return game.peopleCleared >= game.peopleQuota && game.carsCleared >= game.carsQuota
}

export function biasDirection(game) {
  if (!game.lastFavor || game.favorStreak <= 0) return 'none'
  return game.lastFavor
}

export function spawnInterval(density, kind) {
  const base = kind === 'car' ? 2.3 : 2.7
  return Math.max(0.65, base / (0.6 + density * 0.4))
}

export function headingForLane(lane) {
  return lane === 0 ? 1 : -1
}

export function pathGap(kind) {
  return kind === 'car' ? CAR_GAP : PERSON_GAP
}

function pickLaneAndHeading(rng) {
  const lane = rng() < 0.5 ? 0 : 1
  return {
    lane,
    heading: headingForLane(lane),
  }
}

export function makeActor(game, spec = {}) {
  const kind = spec.kind === 'person' ? 'person' : 'car'
  const rng = game.rng
  const place = pickLaneAndHeading(rng)
  const lane = spec.lane ?? place.lane
  const heading = headingForLane(lane)
  const speed = kind === 'car' ? 0.32 + rng() * 0.06 : 0.2 + rng() * 0.05
  const maxWait = (kind === 'car' ? 16 : 18) * (0.85 + rng() * 0.3) / Math.sqrt(Math.max(1, game.density))
  const actor = {
    id: spec.id ?? game.nextId++,
    kind,
    lane,
    heading,
    t: spec.t ?? 0,
    stopT: spec.stopT ?? DEFAULT_STOP_T,
    exitT: spec.exitT ?? DEFAULT_EXIT_T,
    speed: spec.speed ?? speed,
    committed: spec.committed ?? false,
    waiting: spec.waiting ?? false,
    patience: spec.patience ?? 1,
    maxWait: spec.maxWait ?? maxWait,
    color: spec.color ?? (kind === 'car'
      ? CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]
      : PERSON_TONES[Math.floor(rng() * PERSON_TONES.length)]),
    variant: spec.variant ?? Math.floor(rng() * (kind === 'car' ? 8 : 6)),
  }
  return actor
}

export function addActor(game, spec = {}) {
  const actor = makeActor(game, spec)
  game.actors.push(actor)
  return actor
}

function countKind(game, kind) {
  return game.actors.filter((a) => a.kind === kind).length
}

function lastOnPath(game, kind, lane) {
  let best = null
  for (const a of game.actors) {
    if (a.kind !== kind || a.lane !== lane) continue
    if (!best || a.t < best.t) best = a
  }
  return best
}

function nearestAhead(game, actor) {
  let best = null
  for (const a of game.actors) {
    if (a === actor || a.id === actor.id) continue
    if (a.kind !== actor.kind || a.lane !== actor.lane) continue
    if (a.t <= actor.t) continue
    if (!best || a.t < best.t) best = a
  }
  return best
}

function limitByQueue(game, actor, desiredT) {
  const ahead = nearestAhead(game, actor)
  if (!ahead) return desiredT
  const cap = ahead.t - pathGap(actor.kind)
  if (desiredT <= cap) return desiredT
  return Math.max(actor.t, cap)
}

function trySpawn(game, kind) {
  const max = kind === 'car' ? MAX_CARS : MAX_PEOPLE
  if (countKind(game, kind) >= max) return null
  const place = pickLaneAndHeading(game.rng)
  const rear = lastOnPath(game, kind, place.lane)
  const gap = pathGap(kind)
  if (rear && rear.t < gap + 0.02) return null
  return addActor(game, { kind, ...place, t: 0 })
}

function seedApproach(game) {
  const cars = Math.min(3, MAX_CARS)
  const people = Math.min(3, MAX_PEOPLE)
  for (let i = 0; i < cars; i += 1) {
    addActor(game, {
      kind: 'car',
      t: -0.88 + i * 0.16,
      lane: i % 2,
    })
  }
  for (let i = 0; i < people; i += 1) {
    addActor(game, {
      kind: 'person',
      t: -0.76 + i * 0.16,
      lane: i % 2,
    })
  }
}

function actorHasGreen(game, actor) {
  return actor.kind === 'car' ? game.signal === 'cars' : game.signal === 'people'
}

function defyRate(game, actor) {
  if (actor.kind === 'person' && game.jaywalk) return 0.28
  if (actor.kind === 'car' && game.rolling) return 0.28
  return 0
}

function wantsDefy(game, actor, dt) {
  const rate = defyRate(game, actor)
  if (rate <= 0) return false
  return game.rng() < 1 - Math.exp(-rate * dt)
}

function opposingCommitted(game, actor) {
  const other = actor.kind === 'car' ? 'person' : 'car'
  return game.actors.some((a) => a.kind === other && isCommitted(a))
}

function resetShiftPlay(game) {
  const q = quotasFor(game.density)
  game.timeLeft = SHIFT_DURATION
  game.signal = 'cars'
  game.phase = 'steady'
  game.amberLeft = 0
  game.peopleQuota = q.people
  game.carsQuota = q.cars
  game.peopleCleared = 0
  game.carsCleared = 0
  game.carsGreenTime = 0
  game.peopleGreenTime = 0
  game.fail = null
  game.won = false
  game.actors = []
  game.spawnTimer = { car: 2.4, person: 2.8 }
  if (game.autoSpawn) seedApproach(game)
}

export function createGame(opts = {}) {
  const seed = opts.seed ?? 1
  const rng = typeof opts.rng === 'function' ? opts.rng : mulberry32(seed)
  const sittingLength = opts.sittingLength
    ?? (SITTING_MIN + Math.floor(rng() * (SITTING_MAX - SITTING_MIN + 1)))
  const game = {
    screen: 'title',
    density: opts.density ?? 1,
    shiftNumber: 1,
    sittingLength: Math.min(SITTING_MAX, Math.max(SITTING_MIN, sittingLength)),
    lastFavor: null,
    favorStreak: 0,
    jaywalk: false,
    rolling: false,
    autoSpawn: opts.autoSpawn !== false,
    rng,
    nextId: 1,
    breathLeft: 0,
    timeLeft: SHIFT_DURATION,
    signal: 'cars',
    phase: 'steady',
    amberLeft: 0,
    peopleQuota: BASE_PEOPLE_QUOTA,
    carsQuota: BASE_CARS_QUOTA,
    peopleCleared: 0,
    carsCleared: 0,
    carsGreenTime: 0,
    peopleGreenTime: 0,
    fail: null,
    won: false,
    actors: [],
    spawnTimer: { car: 0, person: 0 },
  }
  return game
}

export function startSitting(game) {
  game.density = 1
  game.shiftNumber = 1
  game.lastFavor = null
  game.favorStreak = 0
  game.jaywalk = false
  game.rolling = false
  game.nextId = 1
  resetShiftPlay(game)
  game.screen = 'play'
  return game
}

export function startShift(game) {
  resetShiftPlay(game)
  game.screen = 'play'
  return game
}

export function flip(game) {
  if (game.fail || game.won) return game
  if (game.phase === 'amber') return game
  if (hasCommitted(game)) {
    game.fail = 'crash'
    return game
  }
  game.phase = 'amber'
  game.amberLeft = AMBER_DURATION
  return game
}

function clearActor(game, actor) {
  if (actor.kind === 'car') game.carsCleared += 1
  else game.peopleCleared += 1
}

function stepActor(game, actor, dt) {
  if (actor.t >= 1) return

  // Past the box, or still committed through it: keep rolling off and count a clear.
  // Never snap back to the stop line (that froze both quotas at 0).
  if (actor.committed || actor.t >= actor.exitT) {
    actor.waiting = false
    actor.t = limitByQueue(game, actor, actor.t + actor.speed * dt)
    if (actor.t >= actor.exitT) {
      actor.committed = false
    }
    if (actor.t >= 1) {
      actor.t = 1
      clearActor(game, actor)
    }
    return
  }

  if (actor.waiting) {
    actor.patience -= dt / actor.maxWait
    if (actor.patience <= 0) {
      actor.patience = 0
      game.fail = 'riot'
      return
    }
    const green = actorHasGreen(game, actor) && game.phase === 'steady'
    const defy = !actorHasGreen(game, actor) && wantsDefy(game, actor, dt)
    if (green || defy) {
      if (defy && opposingCommitted(game, actor)) {
        actor.committed = true
        actor.waiting = false
        game.fail = 'crash'
        return
      }
      actor.committed = true
      actor.waiting = false
      actor.t = limitByQueue(game, actor, actor.t + actor.speed * dt * 0.25)
    }
    return
  }

  const next = limitByQueue(game, actor, actor.t + actor.speed * dt)
  if (next < actor.stopT) {
    actor.t = next
    return
  }

  actor.t = Math.min(actor.stopT, next)
  if (actor.t < actor.stopT) return

  const green = actorHasGreen(game, actor) && game.phase === 'steady'
  const defy = !actorHasGreen(game, actor) && wantsDefy(game, actor, dt)
  if (green || defy) {
    if (defy && opposingCommitted(game, actor)) {
      actor.committed = true
      game.fail = 'crash'
      return
    }
    actor.committed = true
    actor.t = limitByQueue(game, actor, actor.t + actor.speed * dt * 0.25)
  } else {
    actor.waiting = true
  }
}

function stepSpawns(game, dt) {
  if (!game.autoSpawn) return
  for (const kind of ['car', 'person']) {
    game.spawnTimer[kind] -= dt
    if (game.spawnTimer[kind] <= 0) {
      trySpawn(game, kind)
      game.spawnTimer[kind] = spawnInterval(game.density, kind)
    }
  }
}

export function tick(game, dt) {
  if (dt < 0) dt = 0
  if (game.fail || game.won) return game
  if (game.screen === 'breath') {
    game.breathLeft = Math.max(0, game.breathLeft - dt)
    return game
  }
  if (game.screen !== 'play') return game

  if (game.phase === 'amber') {
    game.amberLeft -= dt
    if (game.amberLeft <= 0) {
      game.amberLeft = 0
      game.signal = oppositeSignal(game.signal)
      game.phase = 'steady'
    }
  }

  if (game.signal === 'cars') game.carsGreenTime += dt
  else game.peopleGreenTime += dt

  const order = game.actors.slice().sort((a, b) => b.t - a.t)
  for (const actor of order) {
    if (game.fail) break
    stepActor(game, actor, dt)
  }

  game.actors = game.actors.filter((a) => a.t < 1)

  if (game.fail) return game

  const carIn = game.actors.some((a) => a.kind === 'car' && isCommitted(a))
  const personIn = game.actors.some((a) => a.kind === 'person' && isCommitted(a))
  if (carIn && personIn) {
    game.fail = 'crash'
    return game
  }

  stepSpawns(game, dt)

  game.timeLeft -= dt
  if (game.timeLeft <= 0) {
    game.timeLeft = 0
    if (quotasMet(game)) game.won = true
    else game.fail = 'time'
    return game
  }

  if (quotasMet(game)) {
    game.won = true
  }

  return game
}

export function recordBias(game) {
  const favor = game.carsGreenTime >= game.peopleGreenTime ? 'cars' : 'people'
  if (game.lastFavor === favor) {
    game.favorStreak += 1
  } else {
    game.lastFavor = favor
    game.favorStreak = 1
  }
  game.jaywalk = game.lastFavor === 'cars' && game.favorStreak >= BIAS_THRESHOLD
  game.rolling = game.lastFavor === 'people' && game.favorStreak >= BIAS_THRESHOLD
  return favor
}

export function applyWin(game) {
  recordBias(game)
  game.density += 1
  if (game.shiftNumber >= game.sittingLength) {
    game.screen = 'sitting-win'
    return game
  }
  game.shiftNumber += 1
  game.screen = 'breath'
  game.breathLeft = BREATH_DURATION
  return game
}

export function applyFail(game) {
  recordBias(game)
  resetShiftPlay(game)
  game.screen = 'play'
  return game
}

export function finishBreath(game) {
  resetShiftPlay(game)
  game.screen = 'play'
  game.breathLeft = 0
  return game
}

export function beginFromTitle(game) {
  return startSitting(game)
}

export function restartSitting(game) {
  return startSitting(game)
}

export function actorPos(actor) {
  if (actor.kind === 'car') {
    const y = actor.lane === 0 ? 43 : 55
    const x = actor.heading === 1 ? actor.t * 100 : 100 - actor.t * 100
    return { x, y }
  }
  const x = actor.lane === 0 ? 43 : 55
  const y = actor.heading === 1 ? actor.t * 100 : 100 - actor.t * 100
  return { x, y }
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function signalFace(game) {
  if (game.phase === 'amber') return 'amber'
  return game.signal === 'people' ? 'walk' : 'dont-walk'
}

export function biasMeter(game) {
  const dir = biasDirection(game)
  const n = dir === 'none' ? 0 : Math.min(BIAS_THRESHOLD, game.favorStreak)
  return {
    direction: dir,
    streak: n,
    jaywalk: game.jaywalk,
    rolling: game.rolling,
    value: dir === 'cars' ? n : dir === 'people' ? -n : 0,
  }
}
