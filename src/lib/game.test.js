import { describe, it, expect } from 'vitest'
import {
  SHIFT_DURATION,
  AMBER_DURATION,
  BIAS_THRESHOLD,
  createGame,
  startSitting,
  startShift,
  flip,
  tick,
  addActor,
  peopleHaveWalk,
  carsHaveGreen,
  hasCommitted,
  quotasMet,
  quotasFor,
  applyWin,
  applyFail,
  recordBias,
  patienceLevel,
  isCommitted,
} from './game.js'

function fresh(opts = {}) {
  const game = createGame({ seed: 7, autoSpawn: false, sittingLength: 10, ...opts })
  startShift(game)
  return game
}

describe('flip toggles the one bit of state', () => {
  it('green-for-cars is red-for-people, and flip switches the bit after amber', () => {
    const game = fresh()
    expect(carsHaveGreen(game)).toBe(true)
    expect(peopleHaveWalk(game)).toBe(false)
    expect(game.signal).toBe('cars')

    flip(game)
    expect(game.phase).toBe('amber')
    expect(carsHaveGreen(game)).toBe(true)
    expect(peopleHaveWalk(game)).toBe(false)

    tick(game, AMBER_DURATION)
    expect(game.phase).toBe('steady')
    expect(game.signal).toBe('people')
    expect(carsHaveGreen(game)).toBe(false)
    expect(peopleHaveWalk(game)).toBe(true)

    flip(game)
    tick(game, AMBER_DURATION)
    expect(game.signal).toBe('cars')
    expect(carsHaveGreen(game)).toBe(true)
    expect(peopleHaveWalk(game)).toBe(false)
  })

  it('never allows both streams a green at once', () => {
    const game = fresh()
    expect(carsHaveGreen(game) === peopleHaveWalk(game)).toBe(false)
    flip(game)
    tick(game, AMBER_DURATION)
    expect(carsHaveGreen(game) === peopleHaveWalk(game)).toBe(false)
  })
})

describe('amber lasts 0.6s and committed bodies stay committed', () => {
  it('holds amber for 0.6s', () => {
    const game = fresh()
    flip(game)
    tick(game, 0.59)
    expect(game.phase).toBe('amber')
    expect(game.signal).toBe('cars')
    tick(game, 0.02)
    expect(game.phase).toBe('steady')
    expect(game.signal).toBe('people')
  })

  it('keeps already-crossing bodies committed through amber', () => {
    const game = fresh()
    flip(game)
    expect(game.phase).toBe('amber')
    const body = addActor(game, {
      kind: 'car',
      t: 0.45,
      stopT: 0.36,
      exitT: 0.64,
      committed: true,
      speed: 0.05,
    })
    expect(isCommitted(body)).toBe(true)
    tick(game, 0.3)
    expect(game.phase).toBe('amber')
    expect(body.committed).toBe(true)
    expect(isCommitted(body)).toBe(true)
    expect(body.t).toBeGreaterThan(0.45)
    expect(body.t).toBeLessThan(body.exitT)
  })
})

describe('crash if you flip a committed body', () => {
  it('is an instant lose when a body is mid-crossing', () => {
    const game = fresh()
    addActor(game, {
      kind: 'person',
      t: 0.5,
      stopT: 0.36,
      exitT: 0.64,
      committed: true,
    })
    expect(hasCommitted(game)).toBe(true)
    flip(game)
    expect(game.fail).toBe('crash')
    expect(game.won).toBe(false)
  })

  it('does not crash when the crossing is empty', () => {
    const game = fresh()
    addActor(game, { kind: 'car', t: 0.1, committed: false })
    flip(game)
    expect(game.fail).toBe(null)
    expect(game.phase).toBe('amber')
  })

  it('does not crash for a body that has already left the crossing', () => {
    const game = fresh()
    addActor(game, {
      kind: 'car',
      t: 0.7,
      exitT: 0.64,
      committed: false,
    })
    flip(game)
    expect(game.fail).toBe(null)
  })
})

describe('riot if any patience hits 0', () => {
  it('fails the shift the moment a waiting bar empties', () => {
    const game = fresh()
    addActor(game, {
      kind: 'person',
      t: 0.36,
      waiting: true,
      patience: 0.05,
      maxWait: 1,
    })
    tick(game, 0.06)
    expect(game.fail).toBe('riot')
  })

  it('maps patience to calm / tight / flashing', () => {
    expect(patienceLevel(1)).toBe('calm')
    expect(patienceLevel(0.51)).toBe('calm')
    expect(patienceLevel(0.5)).toBe('tight')
    expect(patienceLevel(0.21)).toBe('tight')
    expect(patienceLevel(0.2)).toBe('flashing')
    expect(patienceLevel(0)).toBe('flashing')
  })
})

describe('win requires BOTH quotas', () => {
  it('does not win on people alone', () => {
    const game = fresh()
    game.peopleCleared = game.peopleQuota
    game.carsCleared = game.carsQuota - 1
    tick(game, 0.016)
    expect(quotasMet(game)).toBe(false)
    expect(game.won).toBe(false)
    expect(game.fail).toBe(null)
  })

  it('does not win on cars alone', () => {
    const game = fresh()
    game.peopleCleared = game.peopleQuota - 1
    game.carsCleared = game.carsQuota
    tick(game, 0.016)
    expect(quotasMet(game)).toBe(false)
    expect(game.won).toBe(false)
  })

  it('wins only when both quotas are met before the clock', () => {
    const game = fresh()
    game.peopleCleared = game.peopleQuota
    game.carsCleared = game.carsQuota
    tick(game, 0.016)
    expect(quotasMet(game)).toBe(true)
    expect(game.won).toBe(true)
    expect(game.fail).toBe(null)
  })
})

describe('three car-favor shifts cause jaywalk', () => {
  it('turns on jaywalk after three car-favor results and not before', () => {
    const game = createGame({ seed: 3, autoSpawn: false, sittingLength: 10 })
    startSitting(game)
    expect(game.jaywalk).toBe(false)
    expect(game.rolling).toBe(false)

    for (let i = 0; i < BIAS_THRESHOLD - 1; i += 1) {
      game.carsGreenTime = 40
      game.peopleGreenTime = 10
      recordBias(game)
    }
    expect(game.jaywalk).toBe(false)

    game.carsGreenTime = 40
    game.peopleGreenTime = 10
    recordBias(game)
    expect(game.jaywalk).toBe(true)
    expect(game.rolling).toBe(false)
    expect(game.lastFavor).toBe('cars')
    expect(game.favorStreak).toBe(3)
  })
})

describe('three people-favor shifts cause rolling', () => {
  it('turns on rolling after three people-favor results', () => {
    const game = createGame({ seed: 3, autoSpawn: false, sittingLength: 10 })
    startSitting(game)

    for (let i = 0; i < 3; i += 1) {
      game.carsGreenTime = 8
      game.peopleGreenTime = 30
      recordBias(game)
    }
    expect(game.rolling).toBe(true)
    expect(game.jaywalk).toBe(false)
    expect(game.lastFavor).toBe('people')
    expect(game.favorStreak).toBe(3)
  })
})

describe('shift length is 75s', () => {
  it('starts every shift at 75 seconds and counts down', () => {
    expect(SHIFT_DURATION).toBe(75)
    const game = fresh()
    expect(game.timeLeft).toBe(75)
    tick(game, 10)
    expect(game.timeLeft).toBe(65)
  })

  it('times out as a fail if quotas are short', () => {
    const game = fresh()
    game.peopleCleared = 0
    game.carsCleared = 0
    tick(game, 75)
    expect(game.timeLeft).toBe(0)
    expect(game.fail).toBe('time')
    expect(game.won).toBe(false)
  })
})

describe('density increases on win and stays on fail', () => {
  it('ticks density up after a won shift and holds it after a fail', () => {
    const game = createGame({ seed: 1, autoSpawn: false, sittingLength: 10 })
    startSitting(game)
    expect(game.density).toBe(1)
    expect(quotasFor(1)).toEqual({ people: 6, cars: 6 })

    game.peopleCleared = game.peopleQuota
    game.carsCleared = game.carsQuota
    game.carsGreenTime = 20
    game.peopleGreenTime = 20
    game.won = true
    applyWin(game)
    expect(game.density).toBe(2)
    expect(quotasFor(2)).toEqual({ people: 8, cars: 8 })

    startShift(game)
    expect(game.peopleQuota).toBe(8)
    expect(game.carsQuota).toBe(8)
    game.fail = 'crash'
    game.carsGreenTime = 10
    game.peopleGreenTime = 5
    applyFail(game)
    expect(game.density).toBe(2)
    expect(game.peopleQuota).toBe(8)
    expect(game.carsQuota).toBe(8)
    expect(game.screen).toBe('play')
  })
})

describe('opening stays empty and flip only crashes mid-crossing', () => {
  it('seeds approaches well behind the stop line, not in the box', () => {
    const game = createGame({ seed: 7, autoSpawn: true, sittingLength: 10 })
    startShift(game)
    expect(game.actors.length).toBeGreaterThan(0)
    for (const a of game.actors) {
      expect(a.t).toBeLessThan(a.stopT)
      expect(a.committed).toBe(false)
      expect(isCommitted(a)).toBe(false)
    }
    flip(game)
    expect(game.fail).toBe(null)
    expect(game.phase).toBe('amber')
  })

  it('keeps the crossing empty for a couple of seconds at shift start', () => {
    const game = createGame({ seed: 11, autoSpawn: true, sittingLength: 10 })
    startShift(game)
    tick(game, 2)
    expect(game.fail).toBe(null)
    expect(hasCommitted(game)).toBe(false)
    for (const a of game.actors) {
      expect(a.t).toBeLessThanOrEqual(a.stopT)
    }
  })

  it('does not crash-on-flip for a committed body still at the stop line', () => {
    const game = fresh()
    addActor(game, {
      kind: 'car',
      t: 0.36,
      stopT: 0.36,
      exitT: 0.64,
      committed: true,
    })
    expect(hasCommitted(game)).toBe(false)
    flip(game)
    expect(game.fail).toBe(null)
    expect(game.phase).toBe('amber')
  })
})

describe('actors finish a crossing and increment quota', () => {
  it('increments car quota when a car rolls off the far side', () => {
    const game = fresh()
    addActor(game, {
      kind: 'car',
      t: 0.5,
      stopT: 0.36,
      exitT: 0.64,
      committed: true,
      speed: 0.4,
    })
    tick(game, 2)
    expect(game.carsCleared).toBe(1)
    expect(game.actors.some((a) => a.kind === 'car')).toBe(false)
  })

  it('increments people quota when a person finishes the crossing', () => {
    const game = fresh()
    game.signal = 'people'
    addActor(game, {
      kind: 'person',
      t: 0.5,
      stopT: 0.36,
      exitT: 0.64,
      committed: true,
      speed: 0.4,
    })
    tick(game, 2)
    expect(game.peopleCleared).toBe(1)
  })

  it('keeps rolling after leaving the box instead of snapping back', () => {
    const game = fresh()
    const car = addActor(game, {
      kind: 'car',
      t: 0.62,
      stopT: 0.36,
      exitT: 0.64,
      committed: true,
      speed: 0.2,
    })
    tick(game, 0.2)
    expect(car.t).toBeGreaterThan(0.64)
    expect(car.committed).toBe(false)
    tick(game, 2)
    expect(game.carsCleared).toBe(1)
  })
})
