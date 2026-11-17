// Harbor Heat — the story of Jax Marlowe, a getaway driver who came back to
// Port Vermilion to settle a debt. Six missions, all original: a first car,
// a collection, a hot delivery, a heat wave, a bank job and one last goodbye.
// The mission state machine only reads and writes `state`; it spawns goons,
// pickups and wanted heat through the simulation's own arrays.
import { LANDMARKS, MISSION_REWARDS, dist } from './config.js';
import { addWanted, spawnGoon, spawnPickup, toast } from './sim.js';

export const MISSIONS = [
  { id: 'first-wheels', title: 'FIRST WHEELS', brief: "Ray's garage needs a set of wheels. Any car will do — borrow one, or take one. Then bring it to Ray." },
  { id: 'collector', title: 'THE COLLECTOR', brief: 'A debtor at the Docks owes Ray $900. Go and collect. His friends will object. They always do.' },
  { id: 'delivery', title: 'HOT DELIVERY', brief: 'A package is waiting at the Marina. Pick it up, then run it to North Hills before the clock runs out. The cops are already sniffing.' },
  { id: 'heat-wave', title: 'HEAT WAVE', brief: 'Three stars and the whole Vermilion force on your tail. Lose them. Stay out of sight until the heat dies.' },
  { id: 'harbor-job', title: 'THE HARBOR JOB', brief: "The Harbor Bank keeps its cash in the back room. Walk in, hold E at the vault door, grab it all — then lose a four-star tail and get home." },
  { id: 'goodbye', title: 'THE LONG GOODBYE', brief: 'Five stars. Everybody wants you. Reach the Pier and the boat waiting there. Sixty seconds of hell, then freedom.' },
];

function setObjective(state, text, target = null) {
  state.mission.objective = text;
  state.mission.target = target;
}

function completeMission(state, sound) {
  const idx = state.mission.index;
  const reward = MISSION_REWARDS[idx];
  state.player.cash += reward;
  state.missionsDone++;
  state.mission.done = true;
  state.mission.doneT = 0;
  toast(state, `MISSION COMPLETE — ${MISSIONS[idx].title}`, `+$${reward}`, 4);
  sound?.missionDone();
  // Clear the heat the job earned, so the next briefing reads clean.
  state.player.wanted = 0;
  state.player.wantedTimer = 0;
}

function failMission(state, sound, reason) {
  state.mission.failed = true;
  state.mission.failReason = reason;
  state.events.missionFailed = reason;
  sound?.fail();
}

export function startMission(state, index) {
  if (index >= MISSIONS.length) {
    state.mission = { index, stage: 0, timer: 0, title: 'FREE ROAM', brief: 'Every job is done. Port Vermilion is yours — drive, explore, and stay out of trouble. Or don\'t.', objective: 'FREE ROAM — the city is yours', target: null, done: false, data: {} };
    return;
  }
  const m = MISSIONS[index];
  state.missionIndex = index;
  state.mission = { index, stage: 0, timer: 0, title: m.title, brief: m.brief, objective: '', target: null, done: false, failed: false, data: {} };
  toast(state, `MISSION ${index + 1}/6 — ${m.title}`, m.brief, 5);
  if (index === 0) setObjective(state, 'Get in a car — press E near one', null);
  if (index === 1) setObjective(state, 'Go to The Docks', LANDMARKS.docks);
  if (index === 2) setObjective(state, 'Pick up the package at the Marina', LANDMARKS.marina);
  if (index === 3) { addWanted(state, 3, 'THE WHOLE FORCE IS COMING'); setObjective(state, 'Lose the heat — stay out of sight', null); }
  if (index === 4) setObjective(state, 'Get to the Harbor Bank', LANDMARKS.bank);
  if (index === 5) { addWanted(state, 5, 'EVERY UNIT IN THE CITY'); setObjective(state, 'Reach the Pier — survive 60 seconds', LANDMARKS.pier); state.mission.timer = 60; }
}

export function updateMission(state, dt, sound) {
  const m = state.mission;
  if (!m) return;
  if (m.done) {
    m.doneT = (m.doneT || 0) + dt;
    if (m.doneT > 2.2) startMission(state, m.index + 1);
    return;
  }
  if (m.failed) return; // main.js restarts it after the fail screen
  const p = state.player;
  const idx = m.index;
  m.timer = Math.max(0, (m.timer || 0) - (idx === 2 && m.stage === 1 ? dt : idx === 3 ? dt : idx === 5 ? dt : 0));

  if (idx === 0) {
    if (m.stage === 0) {
      if (!p.onFoot) { m.stage = 1; setObjective(state, "Drive to Ray's Garage", LANDMARKS.garage); }
    } else if (dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 110) {
      completeMission(state, sound);
    }
  } else if (idx === 1) {
    if (m.stage === 0) {
      if (dist(p.x, p.y, LANDMARKS.docks.x, LANDMARKS.docks.y) < 170) {
        m.stage = 1;
        m.data.spawned = true;
        spawnGoon(state, LANDMARKS.docks.x - 70, LANDMARKS.docks.y - 40);
        spawnGoon(state, LANDMARKS.docks.x + 60, LANDMARKS.docks.y + 30);
        spawnGoon(state, LANDMARKS.docks.x + 20, LANDMARKS.docks.y - 90);
        setObjective(state, 'Deal with the debtor\'s friends (3)', LANDMARKS.docks);
        toast(state, 'THEY CAME OUT SWINGING', 'Three of them. The cash is on the ground when they drop.', 3.5);
      }
    } else if (m.stage === 1) {
      const left = state.goons.length;
      setObjective(state, `Deal with the debtor's friends (${left} left)`, LANDMARKS.docks);
      if (left === 0) {
        m.stage = 2;
        spawnPickup(state, LANDMARKS.docks.x, LANDMARKS.docks.y, 'cash', 900);
        setObjective(state, 'Grab the cash, then get back to the Safehouse', LANDMARKS.safehouse);
      }
    } else if (m.stage === 2) {
      if (p.cash >= 0 && dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 120 && state.pickups.filter((k) => k.kind === 'cash' && k.amount === 900).length === 0) {
        completeMission(state, sound);
      } else if (dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 120) {
        setObjective(state, 'Grab the cash first — it is still at the Docks', LANDMARKS.docks);
      }
    }
  } else if (idx === 2) {
    if (m.stage === 0) {
      if (dist(p.x, p.y, LANDMARKS.marina.x, LANDMARKS.marina.y) < 120) {
        m.stage = 1;
        m.timer = 100;
        addWanted(state, 1, 'A PATROL CAR MADE YOU');
        setObjective(state, 'Deliver to North Hills — 100 seconds!', LANDMARKS.hills);
        toast(state, 'PACKAGE SECURED', 'Drive fast. The clock is already running.', 3);
      }
    } else if (m.stage === 1) {
      setObjective(state, `Deliver to North Hills — ${Math.ceil(m.timer)}s left`, LANDMARKS.hills);
      if (dist(p.x, p.y, LANDMARKS.hills.x, LANDMARKS.hills.y) < 120) completeMission(state, sound);
      else if (m.timer <= 0) failMission(state, sound, 'The delivery window closed.');
    }
  } else if (idx === 3) {
    m.timer = (m.timer || 150);
    setObjective(state, `Lose the heat — ${Math.ceil(m.timer)}s (${'★'.repeat(p.wanted) || 'CLEAN'})`, null);
    if (p.wanted === 0) completeMission(state, sound);
    else if (m.timer <= 0) failMission(state, sound, 'The heat never died down.');
  } else if (idx === 4) {
    if (m.stage === 0) {
      if (dist(p.x, p.y, LANDMARKS.bank.x, LANDMARKS.bank.y) < 120) {
        m.stage = 1;
        m.data.channel = 0;
        setObjective(state, 'Stand at the vault door — the crack is running', LANDMARKS.bank);
      }
    } else if (m.stage === 1) {
      const near = dist(p.x, p.y, LANDMARKS.bank.x, LANDMARKS.bank.y) < 90 && p.onFoot;
      if (near) {
        m.data.channel += dt;
        setObjective(state, `Cracking the vault… ${Math.min(99, Math.floor((m.data.channel / 4) * 100))}%`, LANDMARKS.bank);
        if (m.data.channel >= 4) {
          m.stage = 2;
          addWanted(state, 4, 'SILENT ALARM — FOUR STARS');
          spawnPickup(state, LANDMARKS.bank.x, LANDMARKS.bank.y + 40, 'cash', 5000);
          setObjective(state, 'Grab the cash and get to the Safehouse!', LANDMARKS.safehouse);
        }
      } else {
        m.data.channel = Math.max(0, m.data.channel - dt * 2);
        setObjective(state, 'Hold E at the vault door (stay close, on foot)', LANDMARKS.bank);
      }
    } else if (m.stage === 2) {
      if (state.pickups.some((k) => k.kind === 'cash' && k.amount === 5000)) {
        setObjective(state, 'Grab the cash first!', LANDMARKS.bank);
      } else if (dist(p.x, p.y, LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 120) {
        completeMission(state, sound);
      } else {
        setObjective(state, 'Escape to the Safehouse!', LANDMARKS.safehouse);
      }
    }
  } else if (idx === 5) {
    setObjective(state, `Reach the Pier — ${Math.ceil(m.timer)}s (${'★'.repeat(p.wanted) || 'CLEAN'})`, LANDMARKS.pier);
    if (dist(p.x, p.y, LANDMARKS.pier.x, LANDMARKS.pier.y) < 130) {
      completeMission(state, sound);
      state.mission.epilogue = true;
    } else if (m.timer <= 0) {
      failMission(state, sound, 'The boat left without you.');
    }
  }
}
