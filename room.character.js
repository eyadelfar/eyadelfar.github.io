import * as THREE from 'three';

/* Drives the rigged character: which clips play and how fast, so that the feet
   keep pace with the ground, plus the things no clip covers: where the head is
   turned, and the hands while it talks. */

const DEFAULTS = { idle: { seconds: 2.5, speed: 0 }, walk: { seconds: 0.967, speed: 1.35 }, run: { seconds: 0.7, speed: 2.55 } };
const BONE = (name) => `mixamorig${name}`;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (value, low, high) => {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

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
  const arms = [
    { upper: bone('LeftArm'), fore: bone('LeftForeArm'), side: 1 },
    { upper: bone('RightArm'), fore: bone('RightForeArm'), side: -1 },
  ];
  const feet = [bone('LeftFoot'), bone('RightFoot')];

  const weights = { idle: 1, walk: 0, run: 0 };
  let phase = 0;
  let gesture = null;
  let gestureWeight = 0;
  let talking = 0;
  let talkTarget = 0;
  let clock = 0;
  const look = { yaw: 0, pitch: 0 };
  const stepping = { was: [0, 0], falling: [false, false], onStep: null };

  const parentWorld = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const rootWorld = new THREE.Quaternion();
  const point = new THREE.Vector3();

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

  function update(dt, speed, lookAt) {
    clock += dt;
    const walkSpeed = info.walk.speed;
    const runSpeed = info.run.speed;

    const moving = smooth(speed, 0.08, 0.5);
    const running = THREE.MathUtils.clamp((speed - walkSpeed * 1.1) / (runSpeed - walkSpeed * 1.1), 0, 1);
    const want = { idle: 1 - moving, walk: moving * (1 - running), run: moving * running };
    const ease = Math.min(1, dt * 9);
    for (const key of Object.keys(weights)) weights[key] += (want[key] - weights[key]) * ease;

    // One stride of the blend covers this much ground. Play it at whatever rate makes that match.
    const share = weights.run / Math.max(1e-3, weights.walk + weights.run);
    const natural = THREE.MathUtils.lerp(walkSpeed, runSpeed, share);
    const seconds = THREE.MathUtils.lerp(info.walk.seconds, info.run.seconds, share);
    const rate = THREE.MathUtils.clamp(speed / natural, 0.55, 1.35);
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

    root.getWorldQuaternion(rootWorld);

    // The head follows what it is looking at, as far as a neck goes.
    let yaw = 0;
    let pitch = 0;
    if (lookAt && head) {
      head.getWorldPosition(point);
      axis.copy(lookAt).sub(point);
      const flat = Math.hypot(axis.x, axis.z);
      axis.applyQuaternion(parentWorld.copy(rootWorld).invert());
      const bearing = Math.atan2(axis.x, axis.z);
      if (Math.abs(bearing) < 1.9) {
        yaw = THREE.MathUtils.clamp(bearing, -1.05, 1.05);
        pitch = THREE.MathUtils.clamp(-Math.atan2(axis.y, flat), -0.35, 0.4);
      }
    }
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
    onStep(callback) { stepping.onStep = callback; },
    speeds: { walk: info.walk.speed, run: info.run.speed },
  };
}
