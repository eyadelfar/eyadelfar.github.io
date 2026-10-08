import * as THREE from 'three';

/* The quiet room: a planetarium off the main room. A night sky drawn by a
   shader on the inside of a dome, a small solar system turning over a dark pool,
   a neural network laid out as a constellation, and every listed project as a
   star. Nothing in here is an image file. It only animates while someone is near. */

const SKY_VERTEX = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const SKY_FRAGMENT = `
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 uCentre;
  uniform vec4 uDoor;   // x, half width, height, z beyond which the wall is open
  uniform float uTime;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) { sum += amp * noise(p); p = p * 2.03 + 11.7; amp *= 0.5; }
    return sum;
  }
  float stars(vec3 d, float scale, float density) {
    vec3 p = d * scale;
    vec3 cell = floor(p);
    float h = hash(cell);
    if (h < density) return 0.0;
    vec3 centre = cell + 0.5 + (vec3(hash(cell + 1.3), hash(cell + 2.7), hash(cell + 4.1)) - 0.5) * 0.6;
    float glow = smoothstep(0.11, 0.0, length(p - centre));
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.6 + h * 2.4) + h * 90.0);
    return glow * twinkle * (0.5 + 0.5 * hash(cell + 9.1));
  }

  void main() {
    // The doorway: no sky where the way out is.
    if (abs(vWorld.x - uDoor.x) < uDoor.y && vWorld.y < uDoor.z && vWorld.z > uDoor.w) discard;

    vec3 d = normalize(vWorld - uCentre);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 colour = mix(vec3(0.030, 0.034, 0.075), vec3(0.004, 0.005, 0.014), up);

    // A band of dust and light across the sky, slowly drifting.
    vec3 q = d * 2.4 + vec3(uTime * 0.006, 0.0, uTime * 0.004);
    float cloud = fbm(q);
    float band = exp(-pow((d.y - 0.34 - 0.5 * d.x * d.z) * 2.6, 2.0));
    float dust = smoothstep(0.42, 0.9, cloud) * (0.35 + 0.9 * band);
    colour += mix(vec3(0.16, 0.11, 0.42), vec3(0.06, 0.30, 0.36), fbm(q * 1.7 + 4.0)) * dust * 0.55;
    colour += vec3(0.55, 0.50, 0.80) * pow(band, 3.0) * smoothstep(0.5, 0.95, fbm(q * 3.1)) * 0.10;

    float field = stars(d, 46.0, 0.90) + stars(d, 92.0, 0.93) * 0.7 + stars(d, 170.0, 0.955) * 0.5;
    colour += vec3(0.86, 0.90, 1.0) * field * (0.55 + 0.9 * band);

    // The horizon fades into the floor.
    colour *= smoothstep(-0.02, 0.10, d.y) * 0.9 + 0.1;
    gl_FragColor = vec4(colour, 1.0);
  }`;

const BODY_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

// A planet or a moon, lit by one point in space and by nothing else in the scene.
const BODY_FRAGMENT = `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  uniform vec3 uSun;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uBands;
  uniform float uSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float pattern = uBands > 0.5
      ? 0.5 + 0.5 * sin(vUv.y * 3.14159 * uBands + noise(vUv * vec2(6.0, 18.0)) * 2.4)
      : noise(vUv * vec2(14.0, 9.0)) * 0.6 + noise(vUv * vec2(40.0, 26.0)) * 0.4;
    vec3 surface = mix(uA, uB, pattern);
    float light = max(dot(normalize(vNormal), normalize(uSun - vWorld)), 0.0);
    gl_FragColor = vec4(surface * (0.045 + 1.05 * light), 1.0);
  }`;

function glowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.25, outer);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function textPlane(text, width, colour = '#c7d2fe') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colour;
  ctx.font = '600 44px Geist, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width * (96 / 512)), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
}

const PLANETS = [
  { name: 'Mercury', orbit: 0.56, size: 0.035, year: 0.24, a: 0x8c8a85, b: 0x5e5a55 },
  { name: 'Venus', orbit: 0.76, size: 0.060, year: 0.62, a: 0xe6c98a, b: 0xb98d4f },
  { name: 'Earth', orbit: 0.98, size: 0.064, year: 1.0, a: 0x2f6fd0, b: 0x3f9a5a, moon: true },
  { name: 'Mars', orbit: 1.20, size: 0.046, year: 1.88, a: 0xc1502e, b: 0x7c2f1c },
  { name: 'Jupiter', orbit: 1.52, size: 0.150, year: 5.2, a: 0xd9b48a, b: 0x9a6a4a, bands: 9 },
  { name: 'Saturn', orbit: 1.82, size: 0.120, year: 9.5, a: 0xe3cf9c, b: 0xb79a66, bands: 7, ring: true },
  { name: 'Uranus', orbit: 2.04, size: 0.085, year: 16, a: 0x9fe0e6, b: 0x6fbfc9, bands: 3 },
  { name: 'Neptune', orbit: 2.22, size: 0.082, year: 22, a: 0x3d62e0, b: 0x2742a8, bands: 4 },
];

export function buildZen({ scene, centre, radius, door, interactables, work }) {
  const [cx, cz] = centre;
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);
  scene.add(group);
  const animated = [];
  const centre3 = new THREE.Vector3(cx, 0, cz);

  /* ---- the dome and the floor ---- */
  const sky = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    uniforms: {
      uCentre: { value: new THREE.Vector3(cx, -0.6, cz) },
      uDoor: { value: new THREE.Vector4(door.x, door.half, door.height, cz + radius - 1.4) },
      uTime: { value: 0 },
    },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius + 0.35, 64, 40, 0, Math.PI * 2, 0, Math.PI / 2 + 0.12), sky);
  dome.scale.y = 1.08;
  group.add(dome);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius + 0.35, 72),
    new THREE.MeshStandardMaterial({ color: 0x06070f, roughness: 0.32, metalness: 0.55 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.004;
  group.add(floor);

  // A ring of light where the floor meets the sky.
  const horizon = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.2, 0.018, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x4f46e5 }),
  );
  horizon.rotation.x = Math.PI / 2;
  horizon.position.y = 0.05;
  group.add(horizon);

  /* ---- the solar system over a pool ---- */
  const POOL = 2.45;
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(POOL, 64),
    new THREE.MeshStandardMaterial({ color: 0x03040a, roughness: 0.08, metalness: 0.95 }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  group.add(pool);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(POOL, 0.03, 10, 120), new THREE.MeshBasicMaterial({ color: 0x818cf8 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.045;
  group.add(rim);

  const orrery = new THREE.Group();
  orrery.position.y = 1.32;
  orrery.rotation.x = 0.13;
  group.add(orrery);
  const sunWorld = new THREE.Vector3(cx, 1.32, cz);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  orrery.add(sun);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,190,1)', 'rgba(255,170,80,0.45)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(1.5);
  orrery.add(halo);
  const sunLight = new THREE.PointLight(0xffd9a8, 0, 8, 1.6);
  sunLight.position.y = 1.32;
  group.add(sunLight);

  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const bodyMaterial = (a, b, bands = 0, seed = 1) => new THREE.ShaderMaterial({
    vertexShader: BODY_VERTEX,
    fragmentShader: BODY_FRAGMENT,
    uniforms: { uSun: { value: sunWorld }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uBands: { value: bands }, uSeed: { value: seed } },
  });
  PLANETS.forEach((planet, i) => {
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, k) => new THREE.Vector3(Math.cos((k / 128) * Math.PI * 2) * planet.orbit, 0, Math.sin((k / 128) * Math.PI * 2) * planet.orbit))),
      new THREE.LineBasicMaterial({ color: 0x8b93c7, transparent: true, opacity: 0.22 }),
    );
    orrery.add(line);
    const body = new THREE.Mesh(sphere, bodyMaterial(planet.a, planet.b, planet.bands || 0, i * 7.3));
    body.scale.setScalar(planet.size);
    orrery.add(body);
    let moon = null;
    if (planet.moon) {
      moon = new THREE.Mesh(sphere, bodyMaterial(0xc9c9c9, 0x8a8a8a, 0, 3.1));
      moon.scale.setScalar(0.017);
      orrery.add(moon);
    }
    if (planet.ring) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 2.2, 64),
        new THREE.MeshBasicMaterial({ color: 0xd8c79a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = Math.PI / 2 - 0.42;
      body.add(ring);
    }
    const start = i * 2.4;
    animated.push((t) => {
      // Faster than the real thing by a great deal, but in the real proportions to each other.
      const angle = start + (t * 0.5) / planet.year;
      body.position.set(Math.cos(angle) * planet.orbit, 0, Math.sin(angle) * planet.orbit);
      body.rotation.y = t * 0.4;
      if (moon) moon.position.set(body.position.x + Math.cos(t * 2.2) * 0.13, 0.02, body.position.z + Math.sin(t * 2.2) * 0.13);
    });
  });

  /* ---- a moon, hanging high ---- */
  const moon = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
    vertexShader: BODY_VERTEX,
    fragmentShader: BODY_FRAGMENT,
    uniforms: { uSun: { value: new THREE.Vector3(cx + 30, 9, cz + 12) }, uA: { value: new THREE.Color(0xe9e6dc) }, uB: { value: new THREE.Color(0x8d8a82) }, uBands: { value: 0 }, uSeed: { value: 12.4 } },
  }));
  moon.scale.setScalar(0.62);
  moon.position.set(-2.9, 4.3, -2.6);
  group.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(220,225,255,0.35)', 'rgba(140,150,255,0.12)'), blending: THREE.AdditiveBlending, depthWrite: false }));
  moonGlow.scale.setScalar(3.2);
  moonGlow.position.copy(moon.position);
  group.add(moonGlow);
  animated.push((t) => { moon.rotation.y = t * 0.03; });

  /* ---- motes of light drifting in the room ---- */
  const MOTES = 260;
  const motePositions = new Float32Array(MOTES * 3);
  const moteSeeds = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (radius - 0.4);
    motePositions.set([Math.cos(a) * r, 0.3 + Math.random() * 4.2, Math.sin(a) * r], i * 3);
    moteSeeds[i] = Math.random() * 100;
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  group.add(new THREE.Points(moteGeometry, new THREE.PointsMaterial({ color: 0xaab4ff, size: 0.022, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  animated.push((t) => {
    for (let i = 0; i < MOTES; i++) motePositions[i * 3 + 1] += Math.sin(t * 0.3 + moteSeeds[i]) * 0.0006;
    moteGeometry.attributes.position.needsUpdate = true;
  });

  /* ---- a neural network as a constellation ---- */
  const onWall = (azimuth, height, inset = 0.55) => new THREE.Vector3(Math.sin(azimuth) * (radius - inset), height, Math.cos(azimuth) * (radius - inset));
  const NET_AT = -Math.PI * 0.62;
  const layers = [4, 6, 6, 3];
  const nodes = layers.map((count, layer) => Array.from({ length: count }, (_, n) => onWall(
    NET_AT + (layer - 1.5) * 0.17,
    2.5 + (n - (count - 1) / 2) * 0.42,
  )));
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xc7d2fe });
  const nodeMeshes = [];
  for (const layer of nodes) {
    for (const position of layer) {
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), nodeMaterial.clone());
      node.position.copy(position);
      group.add(node);
      nodeMeshes.push(node);
    }
  }
  const edges = [];
  for (let l = 0; l < nodes.length - 1; l++) for (const a of nodes[l]) for (const b of nodes[l + 1]) edges.push([a, b]);
  group.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(edges.flat()),
    new THREE.LineBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.2 }),
  ));
  const pulses = Array.from({ length: 22 }, (_, i) => ({ edge: (i * 37) % edges.length, at: i / 22 }));
  const pulsePositions = new Float32Array(pulses.length * 3);
  const pulseGeometry = new THREE.BufferGeometry();
  pulseGeometry.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3));
  group.add(new THREE.Points(pulseGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
  const scratch = new THREE.Vector3();
  animated.push((t, dt) => {
    pulses.forEach((pulse, i) => {
      pulse.at += dt * 0.55;
      if (pulse.at >= 1) { pulse.at = 0; pulse.edge = Math.floor(Math.random() * edges.length); }
      scratch.lerpVectors(edges[pulse.edge][0], edges[pulse.edge][1], pulse.at);
      pulsePositions.set([scratch.x, scratch.y, scratch.z], i * 3);
    });
    pulseGeometry.attributes.position.needsUpdate = true;
    nodeMeshes.forEach((node, i) => node.material.color.setScalar(0.62 + 0.38 * Math.abs(Math.sin(t * 1.4 + i * 0.6))));
  });
  const netLabel = textPlane('A neural network, as a constellation', 2.6);
  netLabel.position.copy(onWall(NET_AT, 1.15, 0.5));
  netLabel.lookAt(0, 1.15, 0);
  group.add(netLabel);

  /* ---- every listed project, as a star ---- */
  const GALAXY_AT = Math.PI * 0.62;
  const groups = [...new Set(work.map((item) => item.group))];
  const starGlow = glowTexture('rgba(255,255,255,1)', 'rgba(150,160,255,0.5)');
  const hues = [0xa5b4fc, 0x5eead4, 0xfcd34d, 0xf9a8d4, 0x93c5fd, 0xfdba74];
  const stars = [];
  work.forEach((item, i) => {
    const g = groups.indexOf(item.group);
    const peers = work.filter((other) => other.group === item.group);
    const k = peers.indexOf(item);
    // Each topic is a loose cluster; its members sit on a small ring around the cluster's centre.
    const clusterAzimuth = GALAXY_AT + (g - (groups.length - 1) / 2) * 0.24;
    const clusterHeight = 2.0 + (g % 2) * 1.05;
    const angle = (k / peers.length) * Math.PI * 2 + g;
    const spread = peers.length > 1 ? 0.3 : 0;
    const position = onWall(clusterAzimuth + (Math.cos(angle) * spread) / radius, clusterHeight + Math.sin(angle) * spread * 0.9, 0.6);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starGlow, color: hues[g % hues.length], blending: THREE.AdditiveBlending, depthWrite: false }));
    star.position.copy(position);
    star.scale.setScalar(item.kind === 'system' ? 0.34 : 0.42);
    group.add(star);
    // Something solid to click on: sprites are awkward targets.
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    target.position.copy(position);
    target.userData = { interact: 'zen', say: `${item.name}. ${item.note}`, prompt: `Press <b>E</b> to read about ${item.name}` };
    group.add(target);
    interactables.push(target);
    stars.push({ star, seed: i * 1.7, base: star.scale.x });
  });
  groups.forEach((name, g) => {
    const label = textPlane(name, 1.5, '#8b93c7');
    const at = onWall(GALAXY_AT + (g - (groups.length - 1) / 2) * 0.24, 1.42 + (g % 2) * 1.05, 0.5);
    label.position.copy(at);
    label.lookAt(0, at.y, 0);
    group.add(label);
  });
  const galaxyLabel = textPlane('Everything listed on this site, as stars', 2.9);
  galaxyLabel.position.copy(onWall(GALAXY_AT, 0.95, 0.5));
  galaxyLabel.lookAt(0, 0.95, 0);
  group.add(galaxyLabel);
  animated.push((t) => { for (const s of stars) s.star.scale.setScalar(s.base * (0.86 + 0.14 * Math.sin(t * 1.3 + s.seed))); });

  /* ---- somewhere to sit and breathe ---- */
  const BREATH = [0, 0, radius - 2.35];
  const breath = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.016, 8, 96), new THREE.MeshBasicMaterial({ color: 0x5eead4 }));
  breath.rotation.x = Math.PI / 2;
  breath.position.set(BREATH[0], 0.04, BREATH[2]);
  group.add(breath);
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 14), new THREE.MeshStandardMaterial({ color: 0x23264a, roughness: 0.9 }));
  cushion.scale.y = 0.34;
  cushion.position.set(BREATH[0], 0.1, BREATH[2]);
  cushion.userData = { interact: 'zen', say: 'Breathe in as the ring grows, and out as it falls. Four seconds in, six out.', prompt: 'Press <b>E</b> to breathe with the ring' };
  group.add(cushion);
  interactables.push(cushion);
  const breathLabel = textPlane('in', 0.5, '#5eead4');
  breathLabel.rotation.x = -Math.PI / 2;
  breathLabel.position.set(BREATH[0], 0.03, BREATH[2] + 1.15);
  group.add(breathLabel);
  const outLabel = textPlane('out', 0.5, '#5eead4');
  outLabel.rotation.x = -Math.PI / 2;
  outLabel.position.copy(breathLabel.position);
  group.add(outLabel);
  animated.push((t) => {
    const cycle = t % 10;
    const inhale = cycle < 4;
    const phase = inhale ? cycle / 4 : 1 - (cycle - 4) / 6;
    const eased = phase * phase * (3 - 2 * phase);
    breath.scale.setScalar(0.72 + 0.62 * eased);
    breathLabel.material.opacity = inhale ? 0.9 : 0;
    outLabel.material.opacity = inhale ? 0 : 0.9;
  });

  // Enough light to see who is standing in here.
  const fill = new THREE.PointLight(0x8b93ff, 0, 13, 1.4);
  fill.position.set(0, 4.2, 1.5);
  group.add(fill);

  const solar = new THREE.Mesh(new THREE.CylinderGeometry(POOL, POOL, 1.9, 24), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  solar.position.y = 1.1;
  solar.userData = { interact: 'zen', say: 'The solar system. Not to scale, and far faster than the real one, but each planet keeps its true pace against the others.', prompt: 'Press <b>E</b> for a word about the solar system' };
  group.add(solar);
  interactables.push(solar);

  const toWorld = (v) => [cx + v.x, cz + v.z];
  const inward = (azimuth) => [-Math.sin(azimuth), -Math.cos(azimuth)];
  return {
    obstacles: [{ minX: cx - POOL * 0.86, maxX: cx + POOL * 0.86, minZ: cz - POOL * 0.86, maxZ: cz + POOL * 0.86 }],
    places: {
      meditation: { at: [cx, cz], stand: [cx + BREATH[0], cz + BREATH[2] + 0.75] },
      solar_system: { at: [cx, cz], stand: [cx + 2.2, cz + 2.75] },
      constellation: { at: toWorld(onWall(NET_AT, 0, 0.55)), normal: inward(NET_AT) },
      project_stars: { at: toWorld(onWall(GALAXY_AT, 0, 0.6)), normal: inward(GALAXY_AT) },
    },
    /* `presence` runs from 0 in the main room to 1 inside. */
    update(t, dt, viewer, presence) {
      sunLight.intensity = 1.5 * presence;
      fill.intensity = 0.9 * presence;
      if (presence < 0.02 && viewer.distanceTo(centre3) > radius + 9) return;
      sky.uniforms.uTime.value = t;
      for (const step of animated) step(t, dt);
    },
  };
}
