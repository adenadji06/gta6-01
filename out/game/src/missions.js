// Harbor Heat — the six story missions: progression, timers, rewards, banners.
import { MISSIONS } from './config.js';

export function createMissions(onEvent) {
  const m = {
    index: 0,            // 0-based into MISSIONS; 6 = all done
    stage: 1,            // 1 or 2 (two-part missions)
    timer: 0,            // seconds left, 0 = no timer
    banner: '',          // text shown briefly
    bannerT: 0,
    done: false,
  };

  m.current = function () { return MISSIONS[m.index] || null; };

  m.objective = function () {
    const c = m.current();
    if (!c) return 'All missions complete — free roam, Jax.';
    if (m.stage === 2 && c.stage2) return c.stage2.objective;
    return c.objective;
  };

  m.target = function () {
    const c = m.current();
    if (!c) return null;
    if (m.stage === 2 && c.stage2) return c.stage2.target;
    return c.target;
  };

  m.start = function (index, startWanted) {
    m.index = index;
    m.stage = 1;
    m.done = false;
    const c = m.current();
    if (!c) return;
    m.timer = c.timer || 0;
    m.banner = `${c.name} — ${c.briefing}`;
    m.bannerT = 5;
    if (onEvent) onEvent({ type: 'mission-start', mission: c, wanted: c.startWanted || 0 });
  };

  m.completeStage = function () {
    const c = m.current();
    if (!c) return;
    if (m.stage === 1 && c.stage2) {
      m.stage = 2;
      m.banner = `Part 2 — ${c.stage2.objective}`;
      m.bannerT = 4;
      if (onEvent) onEvent({ type: 'mission-stage', mission: c });
      return;
    }
    const reward = c.reward + (c.stage2 ? c.stage2.reward : 0);
    m.banner = `${c.name} complete — +$${reward.toLocaleString()}`;
    m.bannerT = 4;
    if (onEvent) onEvent({ type: 'mission-complete', mission: c, reward });
    if (m.index + 1 >= MISSIONS.length) {
      m.done = true;
      m.index = MISSIONS.length;
      m.timer = 0;
      if (onEvent) onEvent({ type: 'all-complete' });
    } else {
      m.start(m.index + 1);
    }
  };

  m.failTimer = function () {
    m.banner = 'Time up — the job fell through. Try again.';
    m.bannerT = 4;
    m.timer = 0;
    if (onEvent) onEvent({ type: 'mission-failed', mission: m.current() });
    // Restart the same mission fresh (no cash lost).
    const idx = m.index;
    m.start(idx);
  };

  m.update = function (dt) {
    if (m.bannerT > 0) m.bannerT -= dt;
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) m.failTimer();
    }
  };

  m.load = function (index) {
    if (index >= 0 && index < MISSIONS.length) m.start(index);
  };

  return m;
}
