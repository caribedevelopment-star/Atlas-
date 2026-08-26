import * as THREE from 'three';

const canvas = document.querySelector('#world');
const intro = document.querySelector('#intro');
const ending = document.querySelector('#ending');
const enterButton = document.querySelector('#enter');
const hud = document.querySelector('#hud');
const hint = document.querySelector('#hint');
const proximityBar = document.querySelector('#proximityBar');
const mobilePad = document.querySelector('#mobilePad');
const fallback = document.querySelector('#fallback');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  console.error(error);
  fallback.classList.remove('hidden');
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050403');
scene.fog = new THREE.FogExp2('#090504', 0.04);

const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 10, 18);

const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();
const camTarget = new THREE.Vector3();
let started = false;
let startTime = 0;
let phase = 'idle';
let meetTime = 0;
let proximity = 0;
let lastUiUpdate = 0;

const move = { forward: false, back: false, left: false, right: false };
const velocity = new THREE.Vector3();

scene.add(new THREE.AmbientLight('#7a563f', 0.48));
const warmKey = new THREE.DirectionalLight('#ff6b25', 1.2);
warmKey.position.set(7, 14, 4);
scene.add(warmKey);
const stageFill = new THREE.PointLight('#b72c0e', 80, 28, 2);
stageFill.position.set(0, 2.8, -9.5);
scene.add(stageFill);
const lowRim = new THREE.PointLight('#ff7f36', 18, 15, 2);
lowRim.position.set(0, 1.2, 6.5);
scene.add(lowRim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(20, 88),
  new THREE.MeshStandardMaterial({ color: '#080706', roughness: 0.98, metalness: 0.03 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const shell = new THREE.Mesh(
  new THREE.CylinderGeometry(19.5, 19.5, 10, 88, 1, true),
  new THREE.MeshStandardMaterial({ color: '#030303', roughness: 1, side: THREE.BackSide })
);
shell.position.y = 5;
scene.add(shell);

const ringGroup = new THREE.Group();
[
  [12.4, 2.3, '#6f1c0b', 0.78],
  [14.6, 3.8, '#5b190b', 0.64],
  [17.2, 5.2, '#3d1209', 0.5],
].forEach(([r, y, c, o]) => {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.06, 8, 140),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o })
  );
  torus.rotation.x = Math.PI / 2;
  torus.position.y = y;
  ringGroup.add(torus);
});
scene.add(ringGroup);

const stage = new THREE.Group();
stage.position.set(0, 0.25, -10.5);
const stageBody = new THREE.Mesh(
  new THREE.BoxGeometry(8.8, 0.5, 4.1),
  new THREE.MeshStandardMaterial({ color: '#130e0b', roughness: 0.7, metalness: 0.15 })
);
stage.add(stageBody);
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 16; col++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.05, 0.09),
      new THREE.MeshBasicMaterial({ color: col % 3 ? '#ff6f1e' : '#ffb14a', transparent: true, opacity: 0.55 + (col % 4) * 0.06 })
    );
    bar.position.set(-4.5 + col * 0.58, 0.4, -1.65 + row * 1.05);
    stage.add(bar);
  }
}
scene.add(stage);

const sphereGroup = new THREE.Group();
sphereGroup.position.set(0, 6.35, -10.2);
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(2.6, 60, 40),
  new THREE.MeshStandardMaterial({
    color: '#ffd26d', emissive: '#ff9c26', emissiveIntensity: 10.5,
    roughness: 0.55, metalness: 0.0
  })
);
sphereGroup.add(sphere);
const halo1 = new THREE.Mesh(
  new THREE.SphereGeometry(3.2, 36, 28),
  new THREE.MeshBasicMaterial({ color: '#ff8c24', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })
);
sphereGroup.add(halo1);
const halo2 = new THREE.Mesh(
  new THREE.SphereGeometry(4.2, 36, 28),
  new THREE.MeshBasicMaterial({ color: '#ff6f1e', transparent: true, opacity: 0.04, depthWrite: false, blending: THREE.AdditiveBlending })
);
sphereGroup.add(halo2);
const halo3 = new THREE.Mesh(
  new THREE.SphereGeometry(5.4, 36, 28),
  new THREE.MeshBasicMaterial({ color: '#ffc85b', transparent: true, opacity: 0.015, depthWrite: false, blending: THREE.AdditiveBlending })
);
sphereGroup.add(halo3);
const sphereLight = new THREE.PointLight('#ff8a24', 420, 44, 2);
sphereGroup.add(sphereLight);
scene.add(sphereGroup);

function createAmbientParticles(count = 650) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 34;
    positions[i * 3 + 1] = Math.random() * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 35;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#ed6520', size: 0.04, transparent: true, opacity: 0.35,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}
const ambientParticles = createAmbientParticles();

const organicVertex = /* glsl */`
  uniform float uTime;
  uniform float uReaction;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vWorld;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main() {
    vPos = position;
    float n = noise(position * 1.95 + vec3(uTime * .07, uTime * .05, -uTime * .04));
    float breath = sin(uTime * 1.1 + position.y * 2.0) * .018;
    float d = (n - .5) * (.08 + uReaction * .08) + breath;
    vec3 p = position + normal * d;
    vN = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const organicFragment = /* glsl */`
  uniform float uTime;
  uniform float uReaction;
  uniform vec3 uBase;
  uniform vec3 uCore;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vWorld;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + .1); p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p) {
    float f = 0.0; float a = .5;
    for(int i=0;i<4;i++){ f += a*noise(p); p*=2.03; a*=.5; }
    return f;
  }
  void main() {
    vec3 n = normalize(vN);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
    float mineral = fbm(vPos * 3.0 + vec3(0.0, uTime*.02, 0.0));
    float fissure = smoothstep(.7, .9, mineral + sin(vPos.y*8.0 + mineral*5.0)*.08);
    vec3 lightDir = normalize(vec3(-.35, .75, .5));
    float lambert = max(dot(n, lightDir), 0.0);
    vec3 base = uBase * (.52 + lambert*.44) + vec3(.022);
    float glow = fissure * (.08 + uReaction*.82) + fres * (.05 + uReaction*.1);
    vec3 col = mix(base, uCore, clamp(glow,0.0,1.0));
    col += uCore * fissure * uReaction * .5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeOrganicMaterial(base, core) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uReaction: { value: 0 },
      uBase: { value: new THREE.Color(base) },
      uCore: { value: new THREE.Color(core) },
    },
    vertexShader: organicVertex,
    fragmentShader: organicFragment,
  });
}

function tubeFromPoints(points, radius, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segments, radius, 14, false);
}

class Entity {
  constructor({ core = '#d47a2b', base = '#11100f', scale = 1, position = [0, 0, 0], variant = 'ale' } = {}) {
    this.group = new THREE.Group();
    this.group.position.set(...position);
    this.visual = new THREE.Group();
    this.group.add(this.visual);
    this.scale = scale;
    this.reaction = 0;

    this.parts = [];
    this.mats = [];

    const bodyMat = makeOrganicMaterial(base, core);
    const accentMat = makeOrganicMaterial('#090908', core);
    this.mats.push(bodyMat, accentMat);

    const pointsA = variant === 'kim'
      ? [[0.0, 1.85, 0.0], [0.06, 1.0, -0.05], [0.18, 0.2, -0.08], [0.36, -0.65, -0.12], [0.3, -1.45, -0.06]]
      : [[-0.45, 1.55, 0.12], [-0.5, 0.8, 0.08], [-0.26, 0.05, 0.18], [0.05, -0.72, 0.26], [0.2, -1.45, 0.15]];

    const pointsB = variant === 'kim'
      ? [[0.35, 1.65, 0.02], [0.2, 0.9, 0.05], [0.28, 0.05, 0.12], [0.63, -0.55, 0.16], [0.8, -1.28, 0.08]]
      : [[0.48, 1.35, -0.05], [0.28, 0.78, -0.12], [0.22, 0.02, -0.05], [0.42, -0.72, 0.02], [0.74, -1.32, -0.04]];

    const primary = new THREE.Mesh(tubeFromPoints(pointsA, 0.16), bodyMat);
    const secondary = new THREE.Mesh(tubeFromPoints(pointsB, 0.12), accentMat);
    this.visual.add(primary, secondary);
    this.parts.push(primary, secondary);

    const node = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), bodyMat);
    node.position.set(variant === 'kim' ? 0.02 : -0.42, variant === 'kim' ? 1.92 : 1.62, 0.0);
    this.visual.add(node);
    this.parts.push(node);

    const bridge = new THREE.Mesh(
      tubeFromPoints(variant === 'kim'
        ? [[0.02, 1.65, 0.01], [0.16, 1.4, 0.03], [0.28, 1.26, 0.04], [0.35, 1.15, 0.03]]
        : [[-0.42, 1.35, 0.08], [-0.18, 1.24, 0.12], [0.08, 1.16, 0.08], [0.3, 1.08, 0.0]],
        0.08,
        36
      ),
      accentMat
    );
    this.visual.add(bridge);
    this.parts.push(bridge);

    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 3),
      new THREE.MeshBasicMaterial({ color: core, transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.core.position.set(variant === 'kim' ? 0.28 : -0.12, 0.55, 0.02);
    this.core.scale.set(0.85, 1.4, 0.8);
    this.visual.add(this.core);

    const count = 72;
    const pts = new Float32Array(count * 3);
    this.particleBase = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.random() * 0.95;
      const p = new THREE.Vector3(Math.cos(a) * r * 0.68, (Math.random() - 0.5) * 3.0 + 0.2, Math.sin(a) * r * 0.4);
      this.particleBase.push(p);
      pts.set([p.x, p.y, p.z], i * 3);
    }
    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.particleMat = new THREE.PointsMaterial({ color: core, size: 0.024, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending });
    this.particles = new THREE.Points(this.particleGeo, this.particleMat);
    this.visual.add(this.particles);

    this.group.scale.setScalar(scale);
    scene.add(this.group);
  }

  update(t, reaction = this.reaction) {
    this.reaction = THREE.MathUtils.lerp(this.reaction, reaction, 0.06);
    this.mats.forEach((m, idx) => {
      m.uniforms.uTime.value = t * (idx ? 0.92 : 1.0);
      m.uniforms.uReaction.value = this.reaction;
    });

    this.visual.position.y = 1.12 + Math.sin(t * 0.86 + this.group.position.x * 0.14) * 0.08 + this.reaction * 0.05;
    this.visual.rotation.z = Math.sin(t * 0.55 + this.group.position.z * 0.1) * 0.03;
    this.visual.rotation.y = Math.sin(t * 0.28) * 0.06;
    this.core.material.opacity = 0.03 + this.reaction * 0.16;
    const pulse = 1 + Math.sin(t * 1.6) * 0.08 + this.reaction * 0.15;
    this.core.scale.set(0.85 * pulse, 1.4 * pulse, 0.8 * pulse);
    this.particleMat.opacity = 0.11 + this.reaction * 0.62;
    this.particleMat.size = 0.018 + this.reaction * 0.018;

    const attr = this.particleGeo.attributes.position;
    for (let i = 0; i < this.particleBase.length; i++) {
      const b = this.particleBase[i];
      const drift = this.reaction * 0.12;
      attr.setXYZ(
        i,
        b.x + Math.sin(t * 0.7 + i * 1.7) * drift,
        b.y + Math.sin(t * 0.45 + i * 0.9) * drift * 2.2,
        b.z + Math.cos(t * 0.6 + i * 1.3) * drift
      );
    }
    attr.needsUpdate = true;
    this.particles.rotation.y += 0.0015 + this.reaction * 0.004;
  }
}

const crowdGeo = new THREE.DodecahedronGeometry(1, 0);
const crowdMat = new THREE.MeshStandardMaterial({ color: '#090807', roughness: 1, transparent: true, opacity: 0.98 });
const crowdData = [];
for (let i = 0; i < 1600; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 2.6 + Math.pow(Math.random(), 0.62) * 14.0;
  const x = Math.cos(angle) * radius * 0.95;
  const z = Math.sin(angle) * radius * 0.8 - 3.4;
  if (z > 8 || z < -16 || Math.abs(x) > 16) continue;
  if (x > -2.3 && x < 2.3 && z > -1.6 && z < 8) continue;
  crowdData.push({ x, z, s: 0.28 + Math.random() * 0.68, r: Math.random() * Math.PI, lean: (Math.random() - 0.5) * 0.18 });
}
const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdData.length);
const dummy = new THREE.Object3D();
crowdData.forEach((p, i) => {
  dummy.position.set(p.x, 0.56 * p.s, p.z);
  dummy.rotation.set(0, p.r, p.lean);
  dummy.scale.set(0.33 * p.s, 1.85 * p.s, 0.33 * p.s);
  dummy.updateMatrix();
  crowd.setMatrixAt(i, dummy.matrix);
});
crowd.instanceMatrix.needsUpdate = true;
scene.add(crowd);

const ale = new Entity({ core: '#b7c4d1', base: '#0a0a0b', position: [-1.1, 0, 7.1], variant: 'ale', scale: 0.98 });
const kim = new Entity({ core: '#cf8750', base: '#0b0a09', scale: 0.95, position: [1.2, 0, -1.25], variant: 'kim' });

const bondCount = 44;
const bondPositions = new Float32Array(bondCount * 3);
const bondGeo = new THREE.BufferGeometry();
bondGeo.setAttribute('position', new THREE.BufferAttribute(bondPositions, 3));
const bondMat = new THREE.LineBasicMaterial({ color: '#f1b16a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const bond = new THREE.Line(bondGeo, bondMat);
scene.add(bond);

function updateBond(t) {
  const a = ale.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
  const b = kim.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
  const attr = bondGeo.attributes.position;
  for (let i = 0; i < bondCount; i++) {
    const u = i / (bondCount - 1);
    tmpV.lerpVectors(a, b, u);
    const envelope = Math.sin(u * Math.PI);
    tmpV.y += Math.sin(u * Math.PI * 3 + t * 2.4) * 0.07 * envelope;
    tmpV.x += Math.sin(u * Math.PI * 5 + t * 1.5) * 0.045 * envelope;
    attr.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
  }
  attr.needsUpdate = true;
  bondMat.opacity = Math.max(0, (proximity - 0.6) / 0.4) * 0.7;
}

let arenaAudio = null;
async function createAudio() {
  const extAudio = new Audio('/audio/rawayana.mp3');
  extAudio.loop = true;
  extAudio.preload = 'auto';
  extAudio.volume = 0.65;
  try {
    await new Promise((resolve, reject) => {
      const done = () => resolve();
      const fail = () => reject(new Error('no custom audio'));
      extAudio.addEventListener('canplaythrough', done, { once: true });
      extAudio.addEventListener('error', fail, { once: true });
      extAudio.load();
      setTimeout(fail, 1200);
    });
    await extAudio.play();
    return {
      set(p) {
        extAudio.volume = 0.45 + p * 0.28;
      }
    };
  } catch {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    const crowdGain = ctx.createGain(); crowdGain.gain.value = 0.09; crowdGain.connect(master);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.42 + Math.sin(i * 0.0013) * 0.14;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 680;
    noise.connect(filter).connect(crowdGain); noise.start();
    const bassGain = ctx.createGain(); bassGain.gain.value = 0.06; bassGain.connect(master);
    const bass = ctx.createOscillator(); bass.type = 'sine'; bass.frequency.value = 52; bass.connect(bassGain); bass.start();
    const pulseGain = ctx.createGain(); pulseGain.gain.value = 0.018; pulseGain.connect(master);
    const pulse = ctx.createOscillator(); pulse.type = 'triangle'; pulse.frequency.value = 104; pulse.connect(pulseGain); pulse.start();
    ctx.resume().catch(() => {});
    return {
      set(p) {
        const now = ctx.currentTime;
        crowdGain.gain.setTargetAtTime(0.09 * (1 - p * 0.92), now, 0.09);
        bassGain.gain.setTargetAtTime(0.06 * (1 - p * 0.35), now, 0.1);
        pulseGain.gain.setTargetAtTime(0.018 + p * 0.04, now, 0.1);
      }
    };
  }
}

function setKey(key, value) {
  const k = key.toLowerCase();
  if (k === 'w' || k === 'arrowup') move.forward = value;
  if (k === 's' || k === 'arrowdown') move.back = value;
  if (k === 'a' || k === 'arrowleft') move.left = value;
  if (k === 'd' || k === 'arrowright') move.right = value;
  if (value && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) hint.classList.add('faded');
}
window.addEventListener('keydown', (e) => { setKey(e.key, true); if (e.key.startsWith('Arrow')) e.preventDefault(); }, { passive: false });
window.addEventListener('keyup', (e) => setKey(e.key, false));

document.querySelectorAll('[data-move]').forEach((btn) => {
  const key = btn.dataset.move;
  const down = (e) => { e.preventDefault(); move[key] = true; hint.classList.add('faded'); btn.setPointerCapture?.(e.pointerId); };
  const up = (e) => { e.preventDefault(); move[key] = false; };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
});

enterButton.addEventListener('click', async () => {
  started = true;
  phase = 'playing';
  startTime = clock.getElapsedTime();
  arenaAudio = await createAudio();
  intro.classList.add('hidden');
  hud.classList.remove('hidden');
  mobilePad.classList.remove('hidden');
});

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function updatePlayer(dt) {
  if (phase !== 'playing') return;
  const ix = (move.right ? 1 : 0) - (move.left ? 1 : 0);
  const iz = (move.back ? 1 : 0) - (move.forward ? 1 : 0);
  tmpV.set(ix, 0, iz);
  if (tmpV.lengthSq() > 0) tmpV.normalize().multiplyScalar(2.7);
  velocity.lerp(tmpV, 0.095);
  ale.group.position.addScaledVector(velocity, Math.min(dt, 0.035));
  ale.group.position.x = THREE.MathUtils.clamp(ale.group.position.x, -4.1, 4.1);
  ale.group.position.z = THREE.MathUtils.clamp(ale.group.position.z, -2.4, 8.0);
  if (velocity.lengthSq() > 0.025) {
    const ry = Math.atan2(velocity.x, velocity.z);
    ale.group.rotation.y = THREE.MathUtils.lerp(ale.group.rotation.y, ry, 0.055);
  }
}

function updateProximity(t) {
  const d = ale.group.position.distanceTo(kim.group.position);
  const raw = 1 - THREE.MathUtils.clamp((d - 1.3) / 6.8, 0, 1);
  proximity = smoothstep(0, 1, raw);
  if (t - lastUiUpdate > 0.04) {
    proximityBar.style.transform = `scaleX(${proximity})`;
    lastUiUpdate = t;
  }
  arenaAudio?.set(proximity);
  crowdMat.opacity = 0.98 - proximity * 0.4;
  ringGroup.children.forEach((ring, i) => ring.material.opacity = (0.78 - i * 0.14) * (1 - proximity * 0.36));
  if (d < 1.28 && phase === 'playing') {
    phase = 'meeting';
    meetTime = t;
    velocity.set(0, 0, 0);
    hud.classList.add('hidden');
    mobilePad.classList.add('hidden');
  }
}

function updateCamera(t) {
  if (!started) {
    camera.position.set(Math.sin(t * 0.06) * 2.4, 10.1, 18.5);
    camera.lookAt(0, 4, -8);
    return;
  }

  const elapsed = t - startTime;
  const introMix = smoothstep(0, 1, elapsed / 4.2);
  const followPos = new THREE.Vector3(ale.group.position.x * 0.46, 3.6, ale.group.position.z + 6.5);
  const globalPos = new THREE.Vector3(0, 10.2, 18.4);
  const desired = globalPos.lerp(followPos, introMix);

  if (phase === 'meeting') {
    const m = smoothstep(0, 1, (t - meetTime) / 3.2);
    const mid = ale.group.position.clone().lerp(kim.group.position, 0.5);
    desired.lerp(new THREE.Vector3(mid.x + 3.0, 2.9, mid.z + 4.4), m);
    camTarget.lerpVectors(new THREE.Vector3(ale.group.position.x * 0.3, 1.2, ale.group.position.z - 3), new THREE.Vector3(mid.x, 1.4, mid.z), m);
  } else {
    camTarget.set(ale.group.position.x * 0.36, 1.25, ale.group.position.z - 3.0);
  }

  camera.position.lerp(desired, 0.065);
  camera.lookAt(camTarget);
}

function updateMeeting(t) {
  if (phase !== 'meeting') return;
  const m = smoothstep(0, 1, (t - meetTime) / 3.0);
  const mid = ale.group.position.clone().lerp(kim.group.position, 0.5);
  ale.group.position.lerp(new THREE.Vector3(mid.x - 0.52, 0, mid.z + 0.05), 0.012 + m * 0.014);
  kim.group.position.lerp(new THREE.Vector3(mid.x + 0.52, 0, mid.z - 0.05), 0.012 + m * 0.014);
  proximity = Math.max(proximity, m);
  crowdMat.opacity = THREE.MathUtils.lerp(crowdMat.opacity, 0.14, 0.025);
  sphereLight.intensity = THREE.MathUtils.lerp(sphereLight.intensity, 140, 0.018);
  if (t - meetTime > 4.4 && phase === 'meeting') {
    phase = 'ended';
    ending.classList.remove('hidden');
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  updatePlayer(dt);
  if (started && phase !== 'ended') updateProximity(t);
  updateMeeting(t);

  const reaction = phase === 'meeting' ? Math.max(proximity, smoothstep(0, 1, (t - meetTime) / 2.3)) : proximity;
  ale.update(t, reaction * 0.44);
  kim.update(t, reaction);
  updateBond(t);

  const pulse = 1 + Math.sin(t * 0.84) * 0.02 + reaction * 0.05;
  sphere.scale.setScalar(pulse);
  halo1.scale.setScalar(1 + Math.sin(t * 0.71) * 0.05 + reaction * 0.04);
  halo2.scale.setScalar(1 + Math.sin(t * 0.49) * 0.08 + reaction * 0.08);
  halo3.scale.setScalar(1 + Math.sin(t * 0.39) * 0.12 + reaction * 0.14);
  sphereLight.intensity = (phase === 'meeting' ? sphereLight.intensity : 420) * (1 + Math.sin(t * 0.8) * 0.05);
  ambientParticles.rotation.y = t * 0.009;
  ambientParticles.position.y = Math.sin(t * 0.2) * 0.2;

  updateCamera(t);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
