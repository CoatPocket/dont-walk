<script setup>
import { computed } from 'vue'
import { formatClock } from '../lib/game.js'

const props = defineProps({
  kind: { type: String, required: true },
  game: { type: Object, required: true },
})

const emit = defineEmits(['tap'])

const title = computed(() => {
  switch (props.kind) {
    case 'title':
      return "DON'T WALK"
    case 'fail':
      if (props.game.fail === 'crash') return 'CRASH'
      if (props.game.fail === 'riot') return 'RIOT'
      return 'SHIFT OVER'
    case 'shift-win':
      return 'SHIFT CLEAR'
    case 'breath':
      return 'NEXT SHIFT'
    case 'sitting-win':
      return 'SITTING DONE'
    default:
      return ''
  }
})

const blurb = computed(() => {
  switch (props.kind) {
    case 'title':
      return 'You are the box on the pole. One tap flips the city. Hold anyone too long and they riot. Flip too soon and they die.'
    case 'fail':
      if (props.game.fail === 'crash') return 'A body was still committed. You flipped them into the other stream.'
      if (props.game.fail === 'riot') return 'A patience bar hit zero. The street boiled over.'
      return 'Clock hit zero before both quotas cleared.'
    case 'shift-win':
      return `People ${props.game.peopleCleared}/${props.game.peopleQuota} · Cars ${props.game.carsCleared}/${props.game.carsQuota}. Density ticks up.`
    case 'breath':
      return `Shift ${props.game.shiftNumber} of ${props.game.sittingLength}. Density ${props.game.density}.`
    case 'sitting-win':
      return `${props.game.sittingLength} shifts. The box goes dark. Tap to sit again.`
    default:
      return ''
  }
})

const cta = computed(() => {
  switch (props.kind) {
    case 'title':
      return 'TAP TO START'
    case 'fail':
      return 'TAP TO RETRY'
    case 'shift-win':
      return 'TAP TO CONTINUE'
    case 'breath':
      return `TAP · ${formatClock(props.game.breathLeft)}`
    case 'sitting-win':
      return 'TAP FOR A NEW SITTING'
    default:
      return 'TAP'
  }
})

function onTap(ev) {
  ev.preventDefault()
  emit('tap')
}
</script>

<template>
  <button class="overlay" :class="kind" type="button" @pointerdown="onTap">
    <div class="panel">
      <p class="kicker" v-if="kind === 'title'">ONE INTERSECTION</p>
      <h1>{{ title }}</h1>
      <p class="blurb">{{ blurb }}</p>
      <p class="cta">{{ cta }}</p>
    </div>
  </button>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 22px;
  background: rgba(5, 6, 9, 0.94);
  backdrop-filter: blur(10px);
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  text-align: left;
}

.overlay.title,
.overlay.fail,
.overlay.shift-win,
.overlay.breath,
.overlay.sitting-win {
  background: rgba(5, 6, 9, 0.96);
}

.panel {
  width: 100%;
  max-width: 360px;
  padding: 22px 20px 24px;
  border-radius: 14px;
  background: #0b0c10;
  box-shadow: 0 0 0 1px #2a2d36, 0 18px 48px rgba(0, 0, 0, 0.72);
}

.kicker {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: #d0d2da;
}

h1 {
  margin: 0 0 14px;
  font-size: clamp(40px, 12vw, 56px);
  line-height: 0.92;
  letter-spacing: -0.03em;
  color: #f4f1ea;
  text-shadow: 0 2px 0 #000;
}

.overlay.fail h1 { color: #ff6a4d; }
.overlay.shift-win h1 { color: #d8f5c8; }
.overlay.breath h1 { color: #ffc107; }
.overlay.sitting-win h1 { color: #9fd4ff; }
.overlay.title h1 { color: #ff6a4d; }

.blurb {
  margin: 0 0 28px;
  font-size: 16px;
  line-height: 1.4;
  color: #f4f1ea;
  max-width: 28ch;
}

.cta {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.2em;
  color: #ffffff;
}
</style>
