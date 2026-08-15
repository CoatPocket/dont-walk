<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import PlayScreen from './components/PlayScreen.vue'
import OverlayScreen from './components/OverlayScreen.vue'
import {
  applyFail,
  applyWin,
  beginFromTitle,
  createGame,
  finishBreath,
  flip,
  restartSitting,
  tick,
} from './lib/game.js'

const game = reactive(createGame({ seed: Date.now() % 1_000_000 }))
const flash = ref(0)

let raf = 0
let last = 0

function frame(ts) {
  if (!last) last = ts
  const dt = Math.min(0.05, (ts - last) / 1000)
  last = ts
  tick(game, dt)
  if (game.screen === 'breath' && game.breathLeft <= 0) {
    finishBreath(game)
  }
  raf = window.requestAnimationFrame(frame)
}

onMounted(() => {
  raf = window.requestAnimationFrame(frame)
})

onUnmounted(() => {
  window.cancelAnimationFrame(raf)
})

function onStart() {
  beginFromTitle(game)
}

function onFlip() {
  if (game.screen !== 'play' || game.fail || game.won) return
  const before = game.fail
  flip(game)
  flash.value += 1
  if (game.fail === 'crash' && before !== 'crash') {
    /* crash is instant — overlay follows via computed screen */
  }
}

function overlayKind() {
  if (game.screen === 'title') return 'title'
  if (game.screen === 'sitting-win') return 'sitting-win'
  if (game.screen === 'breath') return 'breath'
  if (game.fail) return 'fail'
  if (game.won) return 'shift-win'
  return null
}

function onOverlayTap() {
  const kind = overlayKind()
  if (kind === 'title') {
    onStart()
    return
  }
  if (kind === 'fail') {
    applyFail(game)
    return
  }
  if (kind === 'shift-win') {
    applyWin(game)
    return
  }
  if (kind === 'breath') {
    finishBreath(game)
    return
  }
  if (kind === 'sitting-win') {
    restartSitting(game)
  }
}
</script>

<template>
  <div class="shell">
    <PlayScreen :game="game" :flash="flash" @flip="onFlip" />
    <OverlayScreen
      v-if="overlayKind()"
      :kind="overlayKind()"
      :game="game"
      @tap="onOverlayTap"
    />
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  width: min(100vw, 430px);
  height: 100dvh;
  height: 100svh;
  overflow: hidden;
  background: #0b0c10;
  box-shadow: 0 0 0 1px #1c1e26;
}
</style>
