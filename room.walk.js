/* Walks the avatar somewhere: along a path found by room.nav.js, steering the
   same locomotion the keyboard does. The guide, a click on the floor and a click
   on the map all come through here, so there is one way to walk and one way to
   stop. */

const ARRIVE = 0.12;
const LIMIT_S = 45;

const lerp = (a, b, t) => a + (b - a) * Math.min(1, t);
function turnTo(from, to, t) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return { next: from + diff * Math.min(1, t), left: Math.abs(diff) };
}

export const bearing = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

export function createWalker(room, nav) {
  let walk = null;
  let settle = null;

  room.onFrame((dt) => {
    if (walk) stepWalk(dt);
    else if (settle) stepSettle(dt);
  });

  function stepWalk(dt) {
    const s = room.state();
    const [tx, tz] = walk.points[walk.index];
    const dx = tx - s.x;
    const dz = tz - s.z;
    const dist = Math.hypot(dx, dz);
    const last = walk.index === walk.points.length - 1;

    if (dist < (last ? ARRIVE : 0.32)) {
      if (last) return end(true);
      walk.index++;
      return;
    }
    room.drive({ x: dx / dist, z: dz / dist, speed: last ? Math.max(0.6, Math.min(walk.speed, dist * 2.4)) : walk.speed });

    if (walk.follow) {
      const orbit = room.orbit({});
      room.orbit({
        azimuth: turnTo(orbit.azimuth, Math.PI - s.yaw, dt * 2.4).next,
        elevation: lerp(orbit.elevation, 0.36, dt * 2),
        distance: lerp(orbit.distance, 4.1, dt * 2),
      });
    }

    walk.clock += dt;
    if (walk.clock - walk.checked > 1.1) {
      const moved = Math.hypot(s.x - walk.mark[0], s.z - walk.mark[1]);
      walk.mark = [s.x, s.z];
      walk.checked = walk.clock;
      if (moved < 0.1) {
        // Stuck on something the map did not know about: plan again from here, once.
        const again = walk.replanned ? null : nav.path([s.x, s.z], walk.points[walk.points.length - 1]);
        if (!again) return end(false);
        walk.points = again;
        walk.index = 0;
        walk.replanned = true;
      }
    }
    if (walk.clock > LIMIT_S) end(false);
  }

  function end(arrived) {
    const done = walk;
    walk = null;
    room.drive(null);
    done?.resolve(arrived);
  }

  function stepSettle(dt) {
    const s = room.state();
    const turn = turnTo(s.yaw, settle.yaw, dt * 7);
    room.turn(turn.next);
    if (settle.azimuth !== null) {
      const orbit = room.orbit({});
      room.orbit({
        azimuth: turnTo(orbit.azimuth, settle.azimuth, dt * 3).next,
        elevation: lerp(orbit.elevation, 0.22, dt * 3),
        distance: lerp(orbit.distance, 2.8, dt * 3),
      });
    }
    settle.clock += dt;
    if ((turn.left < 0.04 && settle.clock > settle.hold) || settle.clock > 1.6) {
      const done = settle;
      settle = null;
      done.resolve();
    }
  }

  function stop() {
    if (walk) end(false);
    if (settle) {
      const done = settle;
      settle = null;
      done.resolve();
    }
  }

  return {
    get busy() { return Boolean(walk || settle); },
    /* The points still to walk through, for the map to draw. */
    route: () => (walk ? walk.points.slice(walk.index) : []),
    stop,

    /* Resolves true on arrival, false if stopped, stuck or unreachable. */
    to(point, { speed = 1.5, follow = false } = {}) {
      stop();
      const s = room.state();
      const points = nav.path([s.x, s.z], point);
      if (!points || !points.length) return Promise.resolve(Math.hypot(s.x - point[0], s.z - point[1]) < 0.4);
      return new Promise((resolve) => {
        walk = { points, index: 0, resolve, clock: 0, checked: 0, mark: [s.x, s.z], replanned: false, speed, follow };
      });
    },

    /* Turns the avatar to look at a point. */
    face(x, z) {
      const s = room.state();
      return new Promise((resolve) => { settle = { yaw: bearing(s.x, s.z, x, z), azimuth: null, clock: 0, hold: 0.15, resolve }; });
    },

    /* The guide's arrival: the camera swings round to see the thing over the
       avatar's shoulder, and the avatar turns to the visitor, the way a guide would. */
    present(x, z) {
      const s = room.state();
      const azimuth = Math.PI - bearing(s.x, s.z, x, z) + 0.42;
      return new Promise((resolve) => { settle = { yaw: -azimuth, azimuth, clock: 0, hold: 0.7, resolve }; });
    },
  };
}
