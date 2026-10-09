import * as THREE from 'three';

/* Drives the rigged character: which clips play and how fast, so that the feet
   keep pace with the ground, plus the things no clip covers: how he carries
   himself, where the head is turned, the hands while it talks, and the eyes. */

const DEFAULTS = { idle: { seconds: 2.5, speed: 0 }, walk: { seconds: 0.967, speed: 1.35 }, run: { seconds: 0.7, speed: 2.55 } };
const BONE = (name) => `mixamorig${name}`;
const smooth = (value, low, high) => {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

/* The borrowed walk is a neutral one. This is what is laid over it: a longer
   stride, a wider track, the chest carried up, the arms held off the body and
   the shoulders working against the hips. Angles in radians. */
const CARRIAGE = {
  stride: 1.16,
  track: 0.04,
  chest: 0.05,
  lean: 0.022,
  arms: 0.065,
  elbows: 0.08,
  shoulders: 0.075,
};

/* Where the eyes are on the scan, in metres from the floor and the centre line,
   and the size of a closed lid. He wears glasses, so the eyes are part of the
   scan's surface: a blink is painted onto that surface, not hung in front of it. */
const EYES = { y: 1.5585, x: 0.0355, wide: 0.0155, tall: 0.0072, skin: 0xb48a68, lash: 0x33241b };
const BLINK = { close: 0.07, hold: 0.03, open: 0.14 };
/* Sitting: how far above the seat the hip joint rests, and how the arms settle in the lap. */
const SEAT = { hip: 0.085, lean: 0.06, upperArm: 0.3, foreArm: 1.15 };

const LID_VERTEX = 'varying vec3 vRest;\n';
const LID_FRAGMENT = `
uniform vec3 uEye[2];
uniform vec3 uEyeAcross[2];
uniform vec3 uEyeUp[2];
uniform vec3 uEyeOut[2];
uniform vec3 uLid;
uniform vec3 uLash;
uniform float uBlink;
varying vec3 vRest;
`;
const LID_PAINT = `
if (uBlink > 0.002) {
  for (int i = 0; i < 2; i++) {
    vec3 d = vRest - uEye[i];
    float u = dot(d, uEyeAcross[i]);
    float v = dot(d, uEyeUp[i]);
    float within = (1.0 - smoothstep(0.78, 1.0, length(vec2(u, v)))) * step(abs(dot(d, uEyeOut[i])), 1.0);
    // The lid's lower edge: it starts under the brow and comes down, lower in the middle than at the corners.
    float edge = 1.0 - uBlink * (1.55 + 0.28 * (1.0 - u * u));
    float lid = smoothstep(edge - 0.1, edge + 0.1, v) * within;
    float lash = (1.0 - smoothstep(0.04, 0.24, abs(v - edge))) * within * smoothstep(0.05, 0.3, uBlink);
    diffuseColor.rgb = mix(diffuseColor.rgb, uLid * (0.9 + 0.1 * smoothstep(-1.0, 1.0, v)), lid);
    diffuseColor.rgb = mix(diffuseColor.rgb, uLash, lash * 0.8);
  }
}
`;

export function createCharacter(gltf) {
  const root = gltf.scene;
  let info = DEFAULTS;
  try {
    info = { ...DEFAULTS, ...JSON.parse(root.userData.clips || gltf.parser.json.scenes[0].extras.clips) };
  } catch { /* an older file: the defaults are close */ }

  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    // The bounding sphere of a skinned mesh is worked out once, at rest. It would cull a walking figure.
    node.frustumCulled = false;
    if (node.material.map) node.material.map.colorSpace = THREE.SRGBColorSpace;
  });

  const mixer = new THREE.AnimationMixer(root);
  const action = (name, once = false) => {
    const clip = gltf.animations.find((c) => c.name === name);
    if (!clip) return null;
    const made = mixer.clipAction(clip);
    if (once) made.setLoop(THREE.LoopOnce, 1);
    made.enabled = true;
    made.setEffectiveWeight(0);
    made.play();
    return made;
  };
  const idle = action('idle');
  const walk = action('walk');
  const run = action('run');
  const gestures = { nod: action('agree', true), shake: action('headShake', true) };
  idle.setEffectiveWeight(1);
  // Walk and run are stepped by hand, on one shared phase, so a blend of the two never trips.
  walk.timeScale = 0;
  run.timeScale = 0;

  const bone = (name) => root.getObjectByName(BONE(name));
  const head = bone('Head');
  const neck = bone('Neck');
  const hips = bone('Hips');
  const spine = [bone('Spine'), bone('Spine1'), bone('Spine2')];
  const arms = [
    { upper: bone('LeftArm'), fore: bone('LeftForeArm'), side: 1 },
    { upper: bone('RightArm'), fore: bone('RightForeArm'), side: -1 },
  ];
  const legs = [
    { upper: bone('LeftUpLeg'), lower: bone('LeftLeg'), foot: bone('LeftFoot'), side: 1 },
    { upper: bone('RightUpLeg'), lower: bone('RightLeg'), foot: bone('RightFoot'), side: -1 },
  ];
  const feet = legs.map((leg) => leg.foot);
  // One longer stride covers more ground, so the feet are paced against that.
  const walkSpeed = info.walk.speed * CARRIAGE.stride;
  const runSpeed = info.run.speed;

  // Measured once, standing: what is needed to fold him onto a seat of any height with his feet on the floor.
  root.updateMatrixWorld(true);
  const build = (() => {
    const p = (object) => root.worldToLocal(object.getWorldPosition(new THREE.Vector3()));
    const [hip, knee, ankle] = [p(legs[0].upper), p(legs[0].lower), p(legs[0].foot)];
    return { hip: hip.y, thigh: hip.distanceTo(knee), knee: knee.y };
  })();
  const sitting = { want: 0, now: 0, seat: 0.5 };

  const weights = { idle: 1, walk: 0, run: 0 };
  let phase = 0;
  let gesture = null;
  let gestureWeight = 0;
  let talking = 0;
  let talkTarget = 0;
  let clock = 0;
  let sink = 0;
  const look = { yaw: 0, pitch: 0, aim: 0 };
  const stepping = { was: [0, 0], falling: [false, false], onStep: null };

  const parentWorld = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const rootWorld = new THREE.Quaternion();
  const rootInverse = new THREE.Quaternion();
  const point = new THREE.Vector3();
  const other = new THREE.Vector3();
  const origin = new THREE.Vector3();

  /* Turns a bone by an angle about an axis given in the character's own frame
     (x to its left, y up, z forward), whatever the bone's local axes are. */
  function turnBone(target, x, y, z, angle) {
    if (!target || Math.abs(angle) < 1e-4) return;
    target.parent.getWorldQuaternion(parentWorld);
    axis.set(x, y, z).applyQuaternion(rootWorld).normalize();
    turn.setFromAxisAngle(axis, angle);
    // local' = parent^-1 * turn * parent * local
    target.quaternion.premultiply(parentWorld).premultiply(turn).premultiply(parentWorld.invert());
  }

  /* A point's place in the character's own frame, whichever way the room has turned him. */
  const own = (object, into) => object.getWorldPosition(into).sub(root.getWorldPosition(origin)).applyQuaternion(rootInverse);
  const lowestAnkle = () => {
    root.updateMatrixWorld(true);
    return Math.min(own(feet[0], point).y, own(feet[1], point).y);
  };

  /* ---------- eyes ---------- */
  const lids = { ready: false, blink: { value: 0 } };
  const blinking = { wait: 1.2, since: 0, at: -1, again: false, forced: null };
  try { buildLids(); } catch (err) { console.warn('[character] no eyelids:', err); }

  /* Finds the eyes on the scan and teaches its material to draw a lid over them.
     Everything is measured in the mesh's own rest coordinates, so the lids ride
     with the head however it turns. */
  function buildLids() {
    root.updateMatrixWorld(true);
    const body = [];
    root.traverse((node) => { if (node.isMesh) body.push(node); });
    const ray = new THREE.Raycaster();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();

    // A point on the face as the mesh stores it, and the colour of the scan there.
    function probe(x, y) {
      ray.set(root.localToWorld(new THREE.Vector3(x, y, 1)), new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld));
      const hit = ray.intersectObjects(body, false)[0];
      if (!hit?.face) return null;
      const mesh = hit.object;
      const stored = mesh.geometry.attributes.position;
      const world = [hit.face.a, hit.face.b, hit.face.c].map((index) => mesh.localToWorld(mesh.getVertexPosition(index, new THREE.Vector3())));
      const weight = THREE.Triangle.getBarycoord(hit.point, world[0], world[1], world[2], new THREE.Vector3());
      const rest = new THREE.Vector3()
        .addScaledVector(a.fromBufferAttribute(stored, hit.face.a), weight.x)
        .addScaledVector(b.fromBufferAttribute(stored, hit.face.b), weight.y)
        .addScaledVector(c.fromBufferAttribute(stored, hit.face.c), weight.z);
      return { mesh, rest, uv: hit.uv };
    }
    function colourAt({ mesh, uv }) {
      const map = mesh.material.map;
      if (!map?.image || !uv) return null;
      const at = map.transformUv(uv.clone());
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 5;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(map.image, at.x * map.image.width - 2, at.y * map.image.height - 2, 5, 5, 0, 0, 5, 5);
      const data = ctx.getImageData(0, 0, 5, 5).data;
      let r = 0, g = 0, bl = 0;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; bl += data[i + 2]; }
      return r + g + bl > 0 ? [r / 25 / 255, g / 25 / 255, bl / 25 / 255] : null;
    }

    const uniforms = { uEye: [], uEyeAcross: [], uEyeUp: [], uEyeOut: [] };
    const tones = [];
    let material = null;
    for (const side of [1, -1]) {
      const centre = probe(side * EYES.x, EYES.y);
      const across = probe(side * EYES.x + EYES.wide, EYES.y);
      const up = probe(side * EYES.x, EYES.y + EYES.tall);
      if (!centre || !across || !up) return;
      material = centre.mesh.material;
      // Dividing by the squared length turns a dot product into "how many lid-widths along".
      const wide = across.rest.clone().sub(centre.rest);
      const tall = up.rest.clone().sub(centre.rest);
      const out = wide.clone().cross(tall).normalize().divideScalar(wide.length() * 1.4);
      uniforms.uEye.push(centre.rest);
      uniforms.uEyeAcross.push(wide.clone().divideScalar(wide.lengthSq()));
      uniforms.uEyeUp.push(tall.clone().divideScalar(tall.lengthSq()));
      uniforms.uEyeOut.push(out.divideScalar(out.lengthSq()));
      // The lid takes its colour from the skin just above the eye and just below it.
      for (const lift of [1.75, -1.6]) {
        const skin = probe(side * EYES.x, EYES.y + EYES.tall * lift);
        const tone = skin && colourAt(skin);
        if (tone) tones.push(tone);
      }
    }
    const mean = tones.length
      ? new THREE.Color().setRGB(...[0, 1, 2].map((i) => tones.reduce((sum, tone) => sum + tone[i], 0) / tones.length), THREE.SRGBColorSpace)
      : new THREE.Color(EYES.skin);

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uBlink = lids.blink;
      shader.uniforms.uLid = { value: mean };
      shader.uniforms.uLash = { value: new THREE.Color(EYES.lash) };
      for (const [name, value] of Object.entries(uniforms)) shader.uniforms[name] = { value };
      shader.vertexShader = LID_VERTEX + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
      shader.fragmentShader = LID_FRAGMENT + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n${LID_PAINT}`);
    };
    material.customProgramCacheKey = () => 'eyad-lids';
    material.needsUpdate = true;
    lids.ready = true;
  }

  function updateBlink(dt, moving) {
    if (!lids.ready) return;
    if (blinking.forced !== null) { lids.blink.value = blinking.forced; return; }
    blinking.since += dt;
    if (blinking.at < 0 && blinking.since >= blinking.wait) blinking.at = 0;
    let closed = 0;
    if (blinking.at >= 0) {
      blinking.at += dt;
      const t = blinking.at;
      // Lids drop fast and come back up more slowly, as real ones do.
      if (t < BLINK.close) closed = (t / BLINK.close) ** 2;
      else if (t < BLINK.close + BLINK.hold) closed = 1;
      else closed = 1 - smooth(t, BLINK.close + BLINK.hold, BLINK.close + BLINK.hold + BLINK.open);
      if (t >= BLINK.close + BLINK.hold + BLINK.open) {
        blinking.at = -1;
        blinking.since = 0;
        closed = 0;
        // Now and then a second blink follows straight after the first.
        const twice = !blinking.again && Math.random() < 0.16;
        blinking.again = twice;
        blinking.wait = twice ? 0.12 : (talking > 0.4 ? 1.6 : 2.4) + Math.random() * (moving > 0.5 ? 2.6 : 3.8);
      }
    }
    lids.blink.value = closed;
  }

  function update(dt, speed, lookAt) {
    clock += dt;

    const moving = smooth(speed, 0.08, 0.5);
    const running = THREE.MathUtils.clamp((speed - walkSpeed * 1.22) / (runSpeed - walkSpeed * 1.22), 0, 1);
    const want = { idle: 1 - moving, walk: moving * (1 - running), run: moving * running };
    const ease = Math.min(1, dt * 9);
    for (const key of Object.keys(weights)) weights[key] += (want[key] - weights[key]) * ease;

    // One stride of the blend covers this much ground. Play it at whatever rate makes that match.
    const share = weights.run / Math.max(1e-3, weights.walk + weights.run);
    const natural = THREE.MathUtils.lerp(walkSpeed, runSpeed, share);
    const seconds = THREE.MathUtils.lerp(info.walk.seconds, info.run.seconds, share);
    const rate = THREE.MathUtils.clamp(speed / natural, 0.55, 1.4);
    if (weights.walk + weights.run > 0.01) phase = (phase + (dt * rate) / seconds) % 1;
    walk.time = phase * info.walk.seconds;
    run.time = phase * info.run.seconds;

    // A nod or a shake takes over a standing body for as long as it lasts.
    if (gesture && (!gesture.isRunning() || moving > 0.3)) gesture = null;
    gestureWeight += ((gesture ? 1 : 0) - gestureWeight) * Math.min(1, dt * 7);
    for (const one of Object.values(gestures)) if (one) one.setEffectiveWeight(one === gesture ? gestureWeight : 0);
    idle.setEffectiveWeight(weights.idle * (1 - gestureWeight));
    walk.setEffectiveWeight(weights.walk);
    run.setEffectiveWeight(weights.run);
    mixer.update(dt);

    root.position.y = 0;
    root.getWorldQuaternion(rootWorld);
    rootInverse.copy(rootWorld).invert();

    // How he carries himself. Most of it belongs to the walk and fades out when he stands.
    const stepping01 = weights.walk + weights.run;
    if (stepping01 > 0.01 && hips) {
      const before = lowestAnkle();
      // Which foot leads, from the feet themselves: the opposite shoulder comes forward with it.
      const lead = THREE.MathUtils.clamp((own(feet[0], point).z - own(feet[1], other).z) / 0.45, -1, 1);
      const longer = (CARRIAGE.stride - 1) * weights.walk;
      for (const leg of legs) {
        const swing = own(leg.lower, point).sub(own(leg.upper, axis));
        const angle = Math.atan2(swing.z, -swing.y);
        turnBone(leg.upper, 1, 0, 0, -angle * longer);
        turnBone(leg.upper, 0, 0, 1, leg.side * CARRIAGE.track * stepping01);
        turnBone(leg.foot, 0, 0, 1, -leg.side * CARRIAGE.track * stepping01);
      }
      turnBone(spine[0], 1, 0, 0, CARRIAGE.lean * stepping01);
      turnBone(spine[1], 0, 1, 0, lead * CARRIAGE.shoulders * 0.4 * weights.walk);
      turnBone(spine[2], 0, 1, 0, lead * CARRIAGE.shoulders * 0.6 * weights.walk);
      turnBone(spine[2], 1, 0, 0, -CARRIAGE.chest * stepping01);
      turnBone(neck, 1, 0, 0, (CARRIAGE.chest - CARRIAGE.lean) * 0.8 * stepping01);
      for (const arm of arms) {
        turnBone(arm.upper, 0, 0, 1, arm.side * CARRIAGE.arms * stepping01);
        turnBone(arm.fore, 1, 0, 0, -CARRIAGE.elbows * weights.walk);
      }
      // A longer stride lifts both feet a little at its ends: the body comes down to meet the floor.
      sink += (before - lowestAnkle() - sink) * Math.min(1, dt * 30);
      root.position.y = sink * weights.walk;
      root.updateMatrixWorld(true);
    } else {
      sink = 0;
    }

    // Seated: thighs forward, shins down to the floor, hands in the lap, the body lowered onto the seat.
    sitting.now += (sitting.want - sitting.now) * Math.min(1, dt * 7);
    if (sitting.now > 0.005) {
      const w = sitting.now;
      const hipHeight = sitting.seat + SEAT.hip;
      const fold = Math.PI / 2 - Math.asin(THREE.MathUtils.clamp((hipHeight - build.knee) / build.thigh, -0.5, 0.5));
      for (const leg of legs) {
        turnBone(leg.upper, 1, 0, 0, -fold * w);
        turnBone(leg.lower, 1, 0, 0, fold * w);
      }
      turnBone(spine[0], 1, 0, 0, SEAT.lean * w);
      for (const arm of arms) {
        turnBone(arm.upper, 1, 0, 0, -SEAT.upperArm * w);
        turnBone(arm.fore, 1, 0, 0, -SEAT.foreArm * w);
        turnBone(arm.fore, 0, 1, 0, arm.side * 0.25 * w);
      }
      root.position.y = (hipHeight - build.hip) * w;
      root.updateMatrixWorld(true);
    }

    // The head follows what it is looking at, as far as a neck goes.
    let yaw = 0;
    let pitch = 0;
    if (lookAt && head) {
      head.getWorldPosition(point);
      axis.copy(lookAt).sub(point);
      const flat = Math.hypot(axis.x, axis.z);
      axis.applyQuaternion(rootInverse);
      const bearing = Math.atan2(axis.x, axis.z);
      if (Math.abs(bearing) < 1.9) {
        yaw = THREE.MathUtils.clamp(bearing, -1.05, 1.05);
        pitch = THREE.MathUtils.clamp(-Math.atan2(axis.y, flat), -0.35, 0.4);
      }
    }
    // Eyes close across a quick turn of the head.
    if (Math.abs(yaw - look.aim) > 0.45 && blinking.at < 0 && blinking.since > 0.5) blinking.since = blinking.wait;
    look.aim = yaw;
    const follow = Math.min(1, dt * 5);
    look.yaw += (yaw * (1 - moving * 0.7) - look.yaw) * follow;
    look.pitch += (pitch * (1 - moving * 0.7) - look.pitch) * follow;
    turnBone(neck, 0, 1, 0, look.yaw * 0.4);
    turnBone(head, 0, 1, 0, look.yaw * 0.6);
    turnBone(head, 1, 0, 0, look.pitch);

    // Talking with the hands: forearms come up and move a little, never in step with each other.
    talking += (talkTarget * (1 - moving) - talking) * Math.min(1, dt * 4);
    if (talking > 0.01) {
      for (const arm of arms) {
        const beat = Math.sin(clock * (2.1 + arm.side * 0.35) + arm.side) * 0.5 + 0.5;
        const lift = talking * (0.55 + 0.3 * beat) * (arm.side > 0 ? 1 : 0.7);
        turnBone(arm.upper, 1, 0, 0, -lift * 0.22);
        turnBone(arm.fore, 1, 0, 0, -lift);
        turnBone(arm.fore, 0, 1, 0, arm.side * lift * 0.35);
      }
    }

    updateBlink(dt, moving);

    // A foot that stops falling has just landed.
    if (stepping.onStep && moving > 0.3) {
      feet.forEach((foot, i) => {
        const y = foot.getWorldPosition(point).y;
        const falling = y < stepping.was[i] - 1e-4;
        if (stepping.falling[i] && !falling && y < 0.16) stepping.onStep(i, weights.run > 0.5);
        stepping.falling[i] = falling;
        stepping.was[i] = y;
      });
    }
  }

  return {
    root,
    head,
    update,
    reset() {
      look.yaw = 0;
      look.pitch = 0;
    },
    gesture(name) {
      const one = gestures[name];
      if (!one) return 0;
      gesture = one;
      one.reset().play();
      return one.getClip().duration;
    },
    speaking(on) { talkTarget = on ? 1 : 0; },
    /* Sits him on a seat whose top is `seat` metres off the floor, or stands him up again. */
    sit(on, seat = sitting.seat) { sitting.want = on ? 1 : 0; sitting.seat = seat; },
    /* Holds the lids at a closure from 0 to 1, or hands them back with null. */
    blink(closed) { blinking.forced = closed; if (closed !== null) lids.blink.value = closed; },
    onStep(callback) { stepping.onStep = callback; },
    speeds: { walk: walkSpeed, run: runSpeed },
  };
}
