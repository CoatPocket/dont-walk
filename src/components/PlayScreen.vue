<script setup>
import { computed } from 'vue'
import {
  actorPos,
  biasMeter,
  formatClock,
  patienceLevel,
  signalFace,
} from '../lib/game.js'

const props = defineProps({
  game: { type: Object, required: true },
  flash: { type: Number, default: 0 },
})

const emit = defineEmits(['flip'])

const face = computed(() => signalFace(props.game))
const clock = computed(() => formatClock(props.game.timeLeft))
const bias = computed(() => biasMeter(props.game))
const biasFill = computed(() => {
  const v = bias.value.value
  return ((v + 3) / 6) * 100
})

function onFlip(ev) {
  ev.preventDefault()
  emit('flip')
}

function spriteStyle(actor) {
  const { x, y } = actorPos(actor)
  return {
    left: `${x}%`,
    top: `${y}%`,
    background: actor.kind === 'car' ? actor.color : 'transparent',
    transform: actor.kind === 'car'
      ? `translate(-50%, -50%) rotate(${actor.heading === 1 ? 0 : 180}deg)`
      : 'translate(-50%, -50%)',
  }
}
</script>

<template>
  <div class="play">
    <header class="hud">
      <div class="brand">
        <span class="shift">SHIFT {{ game.shiftNumber }}/{{ game.sittingLength }}</span>
        <span class="clock" :class="{ late: game.timeLeft <= 15 }">{{ clock }}</span>
      </div>
      <div class="quotas">
        <div class="quota people">
          <span class="q-label">PEOPLE</span>
          <span class="q-val">{{ game.peopleCleared }}/{{ game.peopleQuota }}</span>
        </div>
        <div class="quota cars">
          <span class="q-label">CARS</span>
          <span class="q-val">{{ game.carsCleared }}/{{ game.carsQuota }}</span>
        </div>
      </div>
      <div class="bias" :class="bias.direction">
        <span class="bias-end">WALK</span>
        <div class="bias-track">
          <div class="bias-needle" :style="{ left: biasFill + '%' }" />
        </div>
        <span class="bias-end">CARS</span>
        <span v-if="bias.jaywalk" class="bias-tag jay">JAYWALK</span>
        <span v-else-if="bias.rolling" class="bias-tag roll">ROLLING</span>
      </div>
    </header>

    <div class="stage">
      <div class="signal" :class="face">
        <div class="signal-glow" />
        <div class="pole" />
        <div class="signal-box">
          <div class="led dont">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="10" r="5.2" />
              <path d="M14 18.5h20c1 0 1.8.8 1.8 1.8V28h-5.2v12h-5.2V32h-4.4v8h-5.2V28H12.2v-7.7c0-1 .8-1.8 1.8-1.8z" />
            </svg>
          </div>
          <div class="led walk">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="28" cy="9" r="4.6" />
              <path d="M20 16.5l7.2 3.2 4.6 8.4-4.2 1.8-3.2-5.6-3.2 14.2-5.2-1.2 2.4-10.4-5.6-2.2 2.2-5.4 5 2.2z" />
            </svg>
          </div>
        </div>
        <div class="signal-caption">
          <template v-if="face === 'amber'">AMBER</template>
          <template v-else-if="face === 'walk'">WALK</template>
          <template v-else>DON'T WALK</template>
        </div>
      </div>

      <div class="intersection" aria-hidden="true">
        <div class="sidewalk top" />
        <div class="sidewalk bottom" />
        <div class="road" />
        <div class="crosswalk">
          <span v-for="n in 7" :key="n" />
        </div>
        <div class="stop-line left" />
        <div class="stop-line right" />

        <div
          v-for="actor in game.actors"
          :key="actor.id"
          class="actor"
          :class="[actor.kind, patienceLevel(actor.patience), { waiting: actor.waiting, committed: actor.committed }]"
          :style="spriteStyle(actor)"
        >
          <div v-if="actor.kind === 'person'" class="silhouette" :style="{ color: actor.color }">
            <i class="head" />
            <i class="body" />
          </div>
          <div v-else class="car-body">
            <i class="cab" />
            <i class="light" />
          </div>
          <div v-if="actor.waiting" class="bar">
            <i :style="{ width: Math.max(0, actor.patience) * 100 + '%' }" />
          </div>
        </div>
      </div>
    </div>

    <button
      class="flip-zone"
      :class="[face, { popped: flash }]"
      type="button"
      @pointerdown="onFlip"
    >
      <span class="flip-hint">TAP TO FLIP</span>
      <span class="flip-sub">one bit · one tap · 0.6s amber</span>
    </button>
  </div>
</template>

<style scoped>
.play {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100dvh;
}

.hud {
  flex: 0 0 auto;
  padding: calc(10px + env(safe-area-inset-top)) 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 2;
}

.brand {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  letter-spacing: 0.14em;
}

.shift {
  font-size: 11px;
  font-weight: 700;
  color: #8b8e99;
}

.clock {
  font-variant-numeric: tabular-nums;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1;
}

.clock.late {
  color: #ff4d2e;
}

.quotas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quota {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 10px;
  border-radius: 8px;
  background: #14161c;
  border: 1px solid #23262f;
}

.q-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #8b8e99;
}

.q-val {
  font-variant-numeric: tabular-nums;
  font-size: 18px;
  font-weight: 800;
}

.quota.people .q-val { color: #d8f5c8; }
.quota.cars .q-val { color: #9fd4ff; }

.bias {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #6d7180;
}

.bias-track {
  position: relative;
  height: 6px;
  border-radius: 99px;
  background: linear-gradient(90deg, #7dffa0 0%, #2a2c34 50%, #9fd4ff 100%);
}

.bias-needle {
  position: absolute;
  top: -3px;
  width: 4px;
  height: 12px;
  margin-left: -2px;
  border-radius: 2px;
  background: #f4f1ea;
  box-shadow: 0 0 8px #f4f1ea;
}

.bias-tag {
  position: absolute;
  right: 0;
  top: -14px;
  font-size: 9px;
  letter-spacing: 0.18em;
}

.bias-tag.jay { color: #ffb020; }
.bias-tag.roll { color: #ff6b4a; }

.stage {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 12px 52%;
  position: relative;
  z-index: 1;
}

.signal {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 4px;
}

.pole {
  position: absolute;
  top: 86px;
  width: 6px;
  height: 28px;
  background: #3a3d48;
  border-radius: 0 0 2px 2px;
}

.signal-glow {
  position: absolute;
  width: 130px;
  height: 90px;
  border-radius: 50%;
  filter: blur(18px);
  opacity: 0.75;
  pointer-events: none;
}

.signal.dont-walk .signal-glow { background: #ff4d2e; }
.signal.walk .signal-glow { background: #b6ff8a; }
.signal.amber .signal-glow { background: #ffc107; }

.signal-box {
  position: relative;
  width: 76px;
  height: 92px;
  border-radius: 8px;
  background: #12141a;
  border: 2px solid #2a2d36;
  display: flex;
  flex-direction: column;
  padding: 6px;
  gap: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.led {
  flex: 1;
  border-radius: 4px;
  display: grid;
  place-items: center;
  background: #0a0b0e;
}

.led svg {
  width: 28px;
  height: 28px;
  fill: #2a2c34;
}

.signal.dont-walk .led.dont {
  background: #2a0d0a;
  box-shadow: inset 0 0 12px #ff4d2e;
}
.signal.dont-walk .led.dont svg { fill: #ff4d2e; filter: drop-shadow(0 0 4px #ff4d2e); }

.signal.walk .led.walk {
  background: #122010;
  box-shadow: inset 0 0 12px #b6ff8a;
}
.signal.walk .led.walk svg { fill: #d8f5c8; filter: drop-shadow(0 0 4px #b6ff8a); }

.signal.amber .signal-box {
  border-color: #ffc107;
  box-shadow: 0 0 22px #ffc10788;
}
.signal.amber .led { background: #2a2208; }
.signal.amber .led svg { fill: #ffc107; }

.signal-caption {
  margin-top: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.signal.dont-walk .signal-caption { color: #ff4d2e; }
.signal.walk .signal-caption { color: #d8f5c8; }
.signal.amber .signal-caption { color: #ffc107; }

.intersection {
  position: relative;
  flex: 1;
  min-height: 150px;
  border-radius: 10px;
  overflow: hidden;
  background: #3a3d46;
  border: 1px solid #4a4d58;
}

.road {
  position: absolute;
  left: 0;
  right: 0;
  top: 38%;
  height: 24%;
  background: #1a1c22;
}

.sidewalk.top,
.sidewalk.bottom {
  position: absolute;
  left: 0;
  right: 0;
  height: 38%;
  background:
    repeating-linear-gradient(
      90deg,
      #42454f 0 12px,
      #3a3d46 12px 24px
    );
}
.sidewalk.bottom { bottom: 0; top: auto; }

.crosswalk {
  position: absolute;
  left: 38%;
  width: 24%;
  top: 38%;
  height: 24%;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}

.crosswalk span {
  width: 10%;
  background: #f4f1ea;
  opacity: 0.9;
}

.stop-line {
  position: absolute;
  top: 38%;
  height: 24%;
  width: 3px;
  background: #f4f1ea;
}
.stop-line.left { left: 36%; }
.stop-line.right { right: 36%; }

.actor {
  position: absolute;
  z-index: 2;
}

.actor.car {
  width: 30px;
  height: 15px;
}

.car-body {
  width: 100%;
  height: 100%;
  border-radius: 3px 5px 5px 3px;
  background: inherit;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  position: relative;
}

.car-body .cab {
  position: absolute;
  left: 35%;
  top: 15%;
  width: 32%;
  height: 70%;
  background: #9fd4ff66;
  border-radius: 2px;
}

.car-body .light {
  position: absolute;
  right: 2px;
  top: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ffe7a0;
  box-shadow: 0 7px 0 #ffe7a0;
}

.actor.person {
  width: 16px;
  height: 24px;
}

.silhouette {
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(0 0 1px #f4f1ea) drop-shadow(0 1px 1px #000);
}

.silhouette .head {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.silhouette .body {
  width: 10px;
  height: 14px;
  margin-top: 1px;
  border-radius: 4px 4px 2px 2px;
  background: currentColor;
}

.bar {
  position: absolute;
  left: 50%;
  top: -8px;
  width: 24px;
  height: 4px;
  transform: translateX(-50%);
  background: #14161c;
  border: 1px solid #000;
  border-radius: 99px;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: #7dffa0;
}

.actor.tight .bar i { background: #ffc107; }
.actor.flashing .bar i {
  background: #ff4d2e;
  animation: pulse 0.28s steps(2) infinite;
}

@keyframes pulse {
  50% { opacity: 0.25; }
}

.flip-zone {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50%;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 0 16px calc(28px + env(safe-area-inset-bottom));
  gap: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  background: linear-gradient(180deg, transparent 0%, rgba(7, 8, 11, 0.15) 28%, rgba(11, 13, 18, 0.72) 100%);
  border: 0;
}

.flip-hint {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.flip-zone.dont-walk .flip-hint { color: #ff4d2e; }
.flip-zone.walk .flip-hint { color: #d8f5c8; }
.flip-zone.amber .flip-hint { color: #ffc107; }

.flip-sub {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: #8b8e99;
}

.flip-zone:active,
.flip-zone.popped {
  background: linear-gradient(180deg, transparent 0%, rgba(255, 193, 7, 0.08) 30%, rgba(20, 18, 10, 0.8) 100%);
}
</style>
