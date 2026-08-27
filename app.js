import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const canvas = $('#world');
const intro = $('#intro');
const enterButton = $('#enter');
const ending = $('#ending');
const hud = $('#hud');
const hint = $('#hint');
const proximityBar = $('#proximityBar');
const fallback = $('#fallback');
const veil = $('#transitionVeil');
const chapter = $('#chapter');
const chapterIndex = $('#chapterIndex');
const chapterTitle = $('#chapterTitle');
const joystick = $('#joystick');
const joystickKnob = $('.joystick-knob');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  console.error(error);
  fallback.classList.remove('hidden');
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050403');
scene.fog = new THREE.FogExp2('#090504', 0.035);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 120);
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const desiredCam = new THREE.Vector3();
const target = new THREE.Vector3();

let phase = 'idle';
let started = false;
let sceneStartedAt = 0;
let phaseStartedAt = 0;
let proximity = 0;
let frame = 0;
let cameraYaw = 0;
let cameraPitch = 0.22;
let audioSystem = null;
let transitioning = false;

const keyboard = { forward:false, back:false, left:false, right:false };
const mobileAxis = new THREE.Vector2();
let joyPointer = null;
let joyOrigin = new THREE.Vector2();
let lookPointer = null;
let lastLook = new THREE.Vector2();

function clamp01(v){ return THREE.MathUtils.clamp(v,0,1); }
function smooth(v){ v=clamp01(v); return v*v*(3-2*v); }
function phaseTime(){ return clock.elapsedTime - phaseStartedAt; }
function setPhase(name){ phase=name; phaseStartedAt=clock.elapsedTime; }
function showChapter(index,title,duration=1700){
  chapterIndex.textContent=index;
  chapterTitle.textContent=title;
  chapter.classList.remove('hidden');
  setTimeout(()=>chapter.classList.add('hidden'), duration);
}

scene.add(new THREE.AmbientLight('#60483b',0.42));
const warmKey = new THREE.DirectionalLight('#ff7a32',1.0);
warmKey.position.set(5,12,6);
scene.add(warmKey);
const meetingLight = new THREE.PointLight('#ffd3a0',0,11,2);
scene.add(meetingLight);

const arenaRoot = new THREE.Group();
const roomRoot = new THREE.Group();
roomRoot.visible = false;
scene.add(arenaRoot, roomRoot);

const entityVert = `
uniform float uTime;
uniform float uReaction;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main(){
  vP=position;
  float n=noise(position*1.65+vec3(uTime*.045,uTime*.03,-uTime*.035));
  float breathe=sin(uTime*.92+position.y*1.65)*.015;
  float d=(n-.5)*(.055+uReaction*.055)+breathe;
  vec3 p=position+normal*d;
  vN=normalize(normalMatrix*normal);
  vec4 w=modelMatrix*vec4(p,1.);
  vW=w.xyz;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const entityFrag = `
uniform float uTime;
uniform float uReaction;
uniform vec3 uBase;
uniform vec3 uCore;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.-2.*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float f=0.,a=.5; for(int i=0;i<4;i++){f+=a*noise(p);p*=2.03;a*=.5;} return f; }
void main(){
  vec3 n=normalize(vN), view=normalize(cameraPosition-vW);
  float fres=pow(1.-max(dot(n,view),0.),2.2);
  float mineral=fbm(vP*2.8+vec3(0,uTime*.012,0));
  float vein=smoothstep(.73,.9,mineral+sin(vP.y*7.+mineral*5.)*.08);
  vec3 ld=normalize(vec3(-.3,.8,.5));
  float lam=max(dot(n,ld),0.);
  vec3 base=uBase*(.56+lam*.46)+vec3(.018);
  float glow=vein*(.04+uReaction*.7)+fres*(.035+uReaction*.08);
  vec3 c=mix(base,uCore,clamp(glow,0.,1.));
  c+=uCore*vein*uReaction*.34;
  gl_FragColor=vec4(c,1.);
}`;
function entityMaterial(base,core){
  return new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uReaction:{value:0},uBase:{value:new THREE.Color(base)},uCore:{value:new THREE.Color(core)}},vertexShader:entityVert,fragmentShader:entityFrag});
}
function tube(points,radius,radial=18){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve,72,radius,radial,false);
}

class BlobEntity {
  constructor({position,base='#11100f',core='#cab39d',variant='ale',scale=1}){
    this.group=new THREE.Group();
    this.group.position.set(...position);
    this.visual=new THREE.Group();
    this.group.add(this.visual);
    this.reaction=0;

    const matA=entityMaterial(base,core);
    const matB=entityMaterial('#0b0a09',core);
    this.materials=[matA,matB];

    const left = variant==='kim'
      ? [[-.34,1.55,.02],[-.46,.95,.06],[-.4,.24,.11],[-.23,-.52,.11],[-.06,-1.15,.06]]
      : [[-.48,1.35,.08],[-.54,.78,.1],[-.46,.12,.15],[-.24,-.6,.15],[.04,-1.14,.06]];
    const right = variant==='kim'
      ? [[.36,1.44,-.02],[.52,.82,-.04],[.5,.13,.02],[.64,-.54,.04],[.72,-1.08,.02]]
      : [[.4,1.22,-.05],[.52,.7,-.04],[.47,.12,.02],[.57,-.5,.03],[.77,-1.02,.0]];
    const arch = variant==='kim'
      ? [[-.3,1.48,.02],[-.12,1.65,.03],[.1,1.68,.0],[.34,1.42,-.02]]
      : [[-.45,1.3,.05],[-.27,1.52,.06],[.0,1.53,.02],[.38,1.18,-.02]];

    const a=new THREE.Mesh(tube(left,.29),matA);
    const b=new THREE.Mesh(tube(right,.25),matB);
    const c=new THREE.Mesh(tube(arch,.23),matA);
    this.visual.add(a,b,c);

    const belly=new THREE.Mesh(new THREE.IcosahedronGeometry(.72,5),matA);
    belly.position.set(variant==='kim'?0.05:-0.02,.05,.02);
    belly.scale.set(1.08,1.28,.72);
    this.visual.add(belly);

    const shoulder=new THREE.Mesh(new THREE.IcosahedronGeometry(.48,4),matB);
    shoulder.position.set(variant==='kim'?-.08:-.16,.88,.03);
    shoulder.scale.set(1.2,.9,.72);
    this.visual.add(shoulder);

    this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.56,3),new THREE.MeshBasicMaterial({color:core,transparent:true,opacity:.025,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.core.position.set(0,.18,.02);
    this.core.scale.set(1.1,1.42,.8);
    this.visual.add(this.core);

    const count=78, arr=new Float32Array(count*3);
    this.particleBase=[];
    for(let i=0;i<count;i++){
      const aa=Math.random()*Math.PI*2, r=.48+Math.random()*.82;
      const p=new THREE.Vector3(Math.cos(aa)*r*.7,(Math.random()-.5)*2.8+.15,Math.sin(aa)*r*.42);
      this.particleBase.push(p); arr.set([p.x,p.y,p.z],i*3);
    }
    this.particleGeo=new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position',new THREE.BufferAttribute(arr,3));
    this.particleMat=new THREE.PointsMaterial({color:core,size:.023,transparent:true,opacity:.1,depthWrite:false,blending:THREE.AdditiveBlending});
    this.particles=new THREE.Points(this.particleGeo,this.particleMat);
    this.visual.add(this.particles);

    this.group.scale.setScalar(scale);
    scene.add(this.group);
  }
  update(t,reaction){
    this.reaction=THREE.MathUtils.lerp(this.reaction,reaction,.055);
    this.materials.forEach((m,i)=>{m.uniforms.uTime.value=t*(i?.91:1);m.uniforms.uReaction.value=this.reaction;});
    this.visual.position.y=1.22+Math.sin(t*.82+this.group.position.x*.18)*.07+this.reaction*.035;
    this.visual.rotation.z=Math.sin(t*.43)*.024;
    this.visual.rotation.y=Math.sin(t*.26)*.055;
    this.core.material.opacity=.025+this.reaction*.15;
    const p=1+Math.sin(t*1.45)*.06+this.reaction*.11;
    this.core.scale.set(1.1*p,1.42*p,.8*p);
    this.particleMat.opacity=.08+this.reaction*.52;
    const attr=this.particleGeo.attributes.position;
    for(let i=0;i<this.particleBase.length;i++){
      const b=this.particleBase[i], d=this.reaction*.1;
      attr.setXYZ(i,b.x+Math.sin(t*.7+i*1.4)*d,b.y+Math.sin(t*.46+i*.83)*d*2.0,b.z+Math.cos(t*.58+i*1.1)*d);
    }
    attr.needsUpdate=true;
    this.particles.rotation.y+=.001+this.reaction*.003;
  }
}

const ale=new BlobEntity({position:[-1.1,0,7.2],base:'#0b0b0c',core:'#b7c3ce',variant:'ale',scale:1.05});
const kim=new BlobEntity({position:[1.25,0,-1.25],base:'#0b0a09',core:'#cf8f58',variant:'kim',scale:1.0});

const floor=new THREE.Mesh(new THREE.CircleGeometry(20,96),new THREE.MeshStandardMaterial({color:'#090807',roughness:.98}));
floor.rotation.x=-Math.PI/2; arenaRoot.add(floor);
const shell=new THREE.Mesh(new THREE.CylinderGeometry(19,19,10,96,1,true),new THREE.MeshStandardMaterial({color:'#030303',roughness:1,side:THREE.BackSide}));
shell.position.y=5; arenaRoot.add(shell);

const rings=[];
[[12.5,2.3,'#7f240d'],[14.6,3.8,'#5a180b'],[17.1,5.25,'#351008']].forEach(([r,y,c],i)=>{
  const m=new THREE.Mesh(new THREE.TorusGeometry(r,.065,8,140),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.72-i*.13}));
  m.rotation.x=Math.PI/2;m.position.y=y;arenaRoot.add(m);rings.push(m);
});

const stage=new THREE.Group(); stage.position.set(0,.28,-10.6); arenaRoot.add(stage);
const stageBody=new THREE.Mesh(new THREE.BoxGeometry(9,.55,4.2),new THREE.MeshStandardMaterial({color:'#150f0b',roughness:.7,metalness:.18})); stage.add(stageBody);
const stageBars=[];
for(let row=0;row<4;row++) for(let col=0;col<16;col++){
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.38,.055,.1),new THREE.MeshBasicMaterial({color:col%3?'#ff6419':'#ffab3f',transparent:true,opacity:.48}));
  bar.position.set(-4.35+col*.58,.4,-1.7+row*1.12); stage.add(bar); stageBars.push(bar);
}
const stageFill=new THREE.PointLight('#ff4310',90,28,2); stageFill.position.set(0,2.2,-9.4); arenaRoot.add(stageFill);

const sphereGroup=new THREE.Group(); sphereGroup.position.set(0,6.5,-10.15); arenaRoot.add(sphereGroup);
const sphere=new THREE.Mesh(new THREE.SphereGeometry(2.8,64,48),new THREE.MeshStandardMaterial({color:'#ffe094',emissive:'#ff9b23',emissiveIntensity:12.5,roughness:.42})); sphereGroup.add(sphere);
const halos=[];
[[3.35,.13,'#ff9d31'],[4.25,.052,'#ff6d1a'],[5.5,.018,'#ffd47b']].forEach(([r,o,c])=>{
  const h=new THREE.Mesh(new THREE.SphereGeometry(r,36,28),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,depthWrite:false,blending:THREE.AdditiveBlending}));
  sphereGroup.add(h);halos.push(h);
});
const sphereLight=new THREE.PointLight('#ff9d31',470,50,2);sphereGroup.add(sphereLight);

const beams=[];
for(let i=0;i<8;i++){
  const geo=new THREE.ConeGeometry(.42,10,18,1,true);
  const mat=new THREE.MeshBasicMaterial({color:i%2?'#ff6022':'#ffb050',transparent:true,opacity:.035,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const beam=new THREE.Mesh(geo,mat);
  beam.position.set((i-3.5)*1.1,5,-8.9);
  beam.rotation.x=Math.PI;
  beam.rotation.z=(i-3.5)*.04;
  arenaRoot.add(beam); beams.push(beam);
}

const crowdGeo=new THREE.DodecahedronGeometry(1,0);
const crowdMat=new THREE.MeshStandardMaterial({color:'#080706',roughness:1,transparent:true,opacity:.99});
const crowdData=[];
for(let i=0;i<1450;i++){
  const angle=Math.random()*Math.PI*2;
  const radius=2.8+Math.pow(Math.random(),.7)*14.2;
  const x=Math.cos(angle)*radius*.94;
  const z=Math.sin(angle)*radius*.82-3.5;
  if(z>8.5||z<-16||Math.abs(x)>16) continue;
  if(Math.abs(x)<2.15&&z>-2&&z<8.5) continue;
  crowdData.push({x,z,s:.28+Math.random()*.66,ry:Math.random()*Math.PI,phase:Math.random()*Math.PI*2});
}
const crowd=new THREE.InstancedMesh(crowdGeo,crowdMat,crowdData.length);
const dummy=new THREE.Object3D();
arenaRoot.add(crowd);
function updateCrowd(t,intensity=1){
  if(frame%2) return;
  crowdData.forEach((p,i)=>{
    const bounce=Math.sin(t*3.1+p.phase)*.055*intensity;
    dummy.position.set(p.x,.62*p.s+bounce,p.z);
    dummy.rotation.set(0,p.ry+Math.sin(t*.8+p.phase)*.04,Math.sin(t*1.4+p.phase)*.035*intensity);
    dummy.scale.set(.36*p.s,1.55*p.s*(1+bounce*.3),.38*p.s);
    dummy.updateMatrix();crowd.setMatrixAt(i,dummy.matrix);
  });
  crowd.instanceMatrix.needsUpdate=true;
}
updateCrowd(0,1);

function makeSparkField(count,color){
  const arr=new Float32Array(count*3);
  for(let i=0;i<count;i++){arr[i*3]=(Math.random()-.5)*34;arr[i*3+1]=Math.random()*9;arr[i*3+2]=(Math.random()-.5)*34;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(arr,3));
  return new THREE.Points(g,new THREE.PointsMaterial({color,size:.035,transparent:true,opacity:.32,depthWrite:false,blending:THREE.AdditiveBlending}));
}
const arenaDust=makeSparkField(720,'#ee6e28');arenaRoot.add(arenaDust);

roomRoot.position.set(0,0,0);
const roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(18,22),new THREE.MeshStandardMaterial({color:'#11100f',roughness:.75,metalness:.04}));
roomFloor.rotation.x=-Math.PI/2; roomFloor.position.z=-1; roomRoot.add(roomFloor);
const wallMat=new THREE.MeshStandardMaterial({color:'#11100f',roughness:.96});
const leftWall=new THREE.Mesh(new THREE.BoxGeometry(.45,8,20),wallMat);leftWall.position.set(-5.7,4,-1);roomRoot.add(leftWall);
const rightWall=leftWall.clone();rightWall.position.x=5.7;roomRoot.add(rightWall);
const backWall=new THREE.Mesh(new THREE.BoxGeometry(12,8,.45),wallMat);backWall.position.set(0,4,-9);roomRoot.add(backWall);
const ceiling=new THREE.Mesh(new THREE.BoxGeometry(12,.35,20),new THREE.MeshStandardMaterial({color:'#070707',roughness:1}));ceiling.position.set(0,8,-1);roomRoot.add(ceiling);

const doorRoot=new THREE.Group(); doorRoot.position.set(0,0,-8.72); roomRoot.add(doorRoot);
const doorPanel=new THREE.Mesh(new THREE.PlaneGeometry(2.1,4.4),new THREE.MeshBasicMaterial({color:'#c98541',transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false}));doorPanel.position.y=2.2;doorPanel.rotation.y=Math.PI;doorRoot.add(doorPanel);
const frameMat=new THREE.MeshBasicMaterial({color:'#f2a95f'});
const dl=new THREE.Mesh(new THREE.BoxGeometry(.09,4.7,.12),frameMat);dl.position.set(-1.1,2.35,.05);doorRoot.add(dl);
const dr=dl.clone();dr.position.x=1.1;doorRoot.add(dr);
const dt=new THREE.Mesh(new THREE.BoxGeometry(2.3,.09,.12),frameMat);dt.position.set(0,4.7,.05);doorRoot.add(dt);
const doorLight=new THREE.PointLight('#f0a45b',34,10,2);doorLight.position.set(0,2.3,-.6);doorRoot.add(doorLight);
const roomLight=new THREE.PointLight('#c8976a',14,13,2); roomLight.position.set(0,5,0); roomRoot.add(roomLight);
const roomDust=makeSparkField(240,'#bc8b63'); roomDust.material.opacity=.16; roomRoot.add(roomDust);

const bondCount=48,bondArr=new Float32Array(bondCount*3),bondGeo=new THREE.BufferGeometry();
bondGeo.setAttribute('position',new THREE.BufferAttribute(bondArr,3));
const bondMat=new THREE.LineBasicMaterial({color:'#f0b16b',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
const bond=new THREE.Line(bondGeo,bondMat);scene.add(bond);
function updateBond(t){
  const a=ale.group.position.clone().add(new THREE.Vector3(0,1.35,0));
  const b=kim.group.position.clone().add(new THREE.Vector3(0,1.35,0));
  const attr=bondGeo.attributes.position;
  for(let i=0;i<bondCount;i++){
    const u=i/(bondCount-1);tmp.lerpVectors(a,b,u);const e=Math.sin(u*Math.PI);
    tmp.y+=Math.sin(u*Math.PI*3+t*2.5)*.06*e;tmp.x+=Math.sin(u*Math.PI*5+t*1.4)*.035*e;attr.setXYZ(i,tmp.x,tmp.y,tmp.z);
  }
  attr.needsUpdate=true;
  bond.visible=phase!=='room'&&phase!=='door';
  bondMat.opacity=Math.max(0,(proximity-.58)/.42)*.72;
}

async function createAudio(){
  const custom=new Audio('/audio/rawayana.mp3');custom.loop=true;custom.preload='auto';custom.volume=.72;
  try{
    await new Promise((res,rej)=>{let done=false;const ok=()=>{if(!done){done=true;res();}};const fail=()=>{if(!done){done=true;rej();}};custom.addEventListener('canplay',ok,{once:true});custom.addEventListener('error',fail,{once:true});custom.load();setTimeout(fail,900);});
    await custom.play();return {set(p){custom.volume=.58+p*.18;},setRoom(){custom.volume=.12;},stop(){custom.pause();}};
  }catch{}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  const ctx=new AC(),master=ctx.createGain();master.gain.value=.62;master.connect(ctx.destination);
  const crowdGain=ctx.createGain();crowdGain.gain.value=.11;crowdGain.connect(master);
  const bb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=bb.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.43+Math.sin(i*.0014)*.15;
  const noise=ctx.createBufferSource();noise.buffer=bb;noise.loop=true;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=850;noise.connect(lp).connect(crowdGain);noise.start();
  const bassGain=ctx.createGain();bassGain.gain.value=.075;bassGain.connect(master);const bass=ctx.createOscillator();bass.type='sine';bass.frequency.value=51;bass.connect(bassGain);bass.start();
  const hiGain=ctx.createGain();hiGain.gain.value=.018;hiGain.connect(master);const hi=ctx.createOscillator();hi.type='triangle';hi.frequency.value=102;hi.connect(hiGain);hi.start();
  ctx.resume().catch(()=>{});
  return {set(p){const n=ctx.currentTime;crowdGain.gain.setTargetAtTime(.11*(1-p*.88),n,.1);bassGain.gain.setTargetAtTime(.075*(1-p*.35),n,.1);hiGain.gain.setTargetAtTime(.018+p*.03,n,.1);lp.frequency.setTargetAtTime(850-p*600,n,.15);},setRoom(){const n=ctx.currentTime;crowdGain.gain.setTargetAtTime(.002,n,.5);bassGain.gain.setTargetAtTime(.008,n,.5);hiGain.gain.setTargetAtTime(.004,n,.5);},stop(){try{noise.stop();bass.stop();hi.stop();ctx.close();}catch{}}};
}

function keyboardAxis(){return new THREE.Vector2((keyboard.right?1:0)-(keyboard.left?1:0),(keyboard.forward?1:0)-(keyboard.back?1:0));}
function onKey(k,v){k=k.toLowerCase();if(k==='w'||k==='arrowup')keyboard.forward=v;if(k==='s'||k==='arrowdown')keyboard.back=v;if(k==='a'||k==='arrowleft')keyboard.left=v;if(k==='d'||k==='arrowright')keyboard.right=v;if(v)hint.classList.add('faded');}
addEventListener('keydown',e=>{onKey(e.key,true);if(e.key.startsWith('Arrow'))e.preventDefault();},{passive:false});
addEventListener('keyup',e=>onKey(e.key,false));

canvas.addEventListener('pointerdown',e=>{
  if(!started||transitioning||phase==='meeting')return;
  if(e.pointerType!=='mouse'&&e.clientX<innerWidth*.52){
    joyPointer=e.pointerId;joyOrigin.set(e.clientX,e.clientY);joystick.style.left=`${e.clientX}px`;joystick.style.top=`${e.clientY}px`;joystick.classList.remove('hidden');canvas.setPointerCapture?.(e.pointerId);
  }else{
    lookPointer=e.pointerId;lastLook.set(e.clientX,e.clientY);canvas.setPointerCapture?.(e.pointerId);
  }
  hint.classList.add('faded');
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerId===joyPointer){
    const dx=e.clientX-joyOrigin.x,dy=e.clientY-joyOrigin.y,len=Math.hypot(dx,dy),max=38,s=Math.min(1,max/Math.max(len,1));
    mobileAxis.set(dx*s/max,-dy*s/max);joystickKnob.style.transform=`translate(calc(-50% + ${dx*s}px), calc(-50% + ${dy*s}px))`;
  }
  if(e.pointerId===lookPointer){
    const dx=e.clientX-lastLook.x,dy=e.clientY-lastLook.y;cameraYaw-=dx*.0055;cameraPitch=THREE.MathUtils.clamp(cameraPitch+dy*.0035,-.05,.52);lastLook.set(e.clientX,e.clientY);
  }
});
function endPointer(e){
  if(e.pointerId===joyPointer){joyPointer=null;mobileAxis.set(0,0);joystick.classList.add('hidden');joystickKnob.style.transform='translate(-50%,-50%)';}
  if(e.pointerId===lookPointer)lookPointer=null;
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);

async function transitionToRoom(){
  if(transitioning)return; transitioning=true; setPhase('transition-room');
  veil.classList.add('on');
  await new Promise(r=>setTimeout(r,1050));
  arenaRoot.visible=false;roomRoot.visible=true;bond.visible=false;
  ale.group.position.set(-.9,0,3.1);kim.group.position.set(.9,0,1.9);ale.group.rotation.set(0,0,0);kim.group.rotation.set(0,0,0);
  cameraYaw=0;cameraPitch=.18;camera.position.set(0,4.2,8.7);target.set(0,1.3,0);
  scene.fog.color.set('#0c0b0a');scene.fog.density=.055;audioSystem?.setRoom?.();
  setPhase('room');sceneStartedAt=clock.elapsedTime;showChapter('MEMORY 02','THE ROOM',1800);
  await new Promise(r=>setTimeout(r,260));veil.classList.remove('on');
  setTimeout(()=>{transitioning=false;hud.classList.remove('hidden');hint.textContent='MUÉVETE · MIRA · ACÉRCATE A LA PUERTA';hint.classList.remove('faded');},750);
}

async function triggerDoor(){
  if(transitioning)return;transitioning=true;setPhase('door');hud.classList.add('hidden');
  showChapter('MEMORY 02','THE DOOR',1900);
  setTimeout(()=>{doorPanel.material.opacity=.55;doorLight.intensity=95;},500);
  setTimeout(()=>{veil.classList.add('on');},2200);
  setTimeout(()=>{ending.classList.remove('hidden');transitioning=false;},3200);
}

enterButton.addEventListener('click',async()=>{
  started=true;setPhase('concert');sceneStartedAt=clock.elapsedTime;audioSystem=await createAudio();
  intro.classList.add('hidden');hud.classList.remove('hidden');showChapter('MEMORY 01','THE ENCOUNTER',1650);
});

const velocity=new THREE.Vector3();
function updatePlayer(dt){
  if(!started||transitioning||phase==='meeting'||phase==='transition-room'||phase==='door')return;
  const k=keyboardAxis();const axis=k.lengthSq()>0?k:mobileAxis;
  const dir=new THREE.Vector3(axis.x,0,-axis.y);
  if(dir.lengthSq()>1)dir.normalize();
  if(dir.lengthSq()>0)dir.applyAxisAngle(new THREE.Vector3(0,1,0),cameraYaw).multiplyScalar(2.75);
  velocity.lerp(dir,.1);ale.group.position.addScaledVector(velocity,Math.min(dt,.035));
  if(phase==='concert'){
    ale.group.position.x=THREE.MathUtils.clamp(ale.group.position.x,-4.3,4.3);ale.group.position.z=THREE.MathUtils.clamp(ale.group.position.z,-2.5,8.2);
  } else if(phase==='room'){
    ale.group.position.x=THREE.MathUtils.clamp(ale.group.position.x,-4.2,4.2);ale.group.position.z=THREE.MathUtils.clamp(ale.group.position.z,-7.2,4.0);
  }
  if(velocity.lengthSq()>.02)ale.group.rotation.y=THREE.MathUtils.lerp(ale.group.rotation.y,Math.atan2(velocity.x,velocity.z),.07);
}

function updateConcert(t){
  const d=ale.group.position.distanceTo(kim.group.position);
  const raw=1-THREE.MathUtils.clamp((d-1.35)/7.1,0,1);proximity=smooth(raw);
  proximityBar.style.transform=`scaleX(${proximity})`;audioSystem?.set?.(proximity);
  const isolate=smooth((proximity-.34)/.66);
  crowdMat.opacity=.99-isolate*.58;updateCrowd(t,1-isolate*.82);
  stageBars.forEach((b,i)=>b.material.opacity=.34+.34*(.5+.5*Math.sin(t*4+i*.45)));
  beams.forEach((b,i)=>{b.rotation.z=(i-3.5)*.035+Math.sin(t*.55+i)*.16;b.rotation.x=Math.PI+Math.sin(t*.42+i*.7)*.08;b.material.opacity=.025+.025*(.5+.5*Math.sin(t*1.1+i));});
  meetingLight.position.copy(kim.group.position).lerp(ale.group.position,.5).add(new THREE.Vector3(0,2.6,0));meetingLight.intensity=isolate*24;
  rings.forEach((r,i)=>r.material.opacity=(.72-i*.13)*(1-isolate*.35));
  if(d<1.38&&phase==='concert'){setPhase('meeting');hud.classList.add('hidden');velocity.set(0,0,0);}
}

function updateMeeting(t){
  const p=smooth(phaseTime()/3.2);proximity=Math.max(proximity,p);
  const mid=ale.group.position.clone().lerp(kim.group.position,.5);
  ale.group.position.lerp(new THREE.Vector3(mid.x-.62,0,mid.z+.05),.015+p*.01);
  kim.group.position.lerp(new THREE.Vector3(mid.x+.62,0,mid.z-.05),.015+p*.01);
  crowdMat.opacity=THREE.MathUtils.lerp(crowdMat.opacity,.12,.03);updateCrowd(t,.12);
  meetingLight.position.set(mid.x,2.7,mid.z);meetingLight.intensity=30+p*30;
  audioSystem?.set?.(1);
  if(phaseTime()>4.4)transitionToRoom();
}

function updateRoom(t){
  const sep=kim.group.position.distanceTo(ale.group.position);
  if(sep>2.3){tmp.copy(ale.group.position).add(new THREE.Vector3(.9,0,.7));kim.group.position.lerp(tmp,.0035);}
  doorPanel.material.opacity=.16+.05*Math.sin(t*1.3);
  doorLight.intensity=34+8*Math.sin(t*.9);
  const dDoor=ale.group.position.distanceTo(new THREE.Vector3(0,0,-7.0));
  proximity=1-THREE.MathUtils.clamp((dDoor-1.2)/8,0,1);proximityBar.style.transform=`scaleX(${smooth(proximity)})`;
  if(dDoor<1.35&&phase==='room')triggerDoor();
}

function updateCamera(t){
  if(!started){camera.position.set(Math.sin(t*.06)*2.4,10.2,18.6);camera.lookAt(0,4,-8);return;}
  if(phase==='concert'){
    const reveal=smooth((t-sceneStartedAt)/4.2);
    const radius=6.4, height=3.6+cameraPitch*2.0;
    desiredCam.set(ale.group.position.x+Math.sin(cameraYaw)*radius,height,ale.group.position.z+Math.cos(cameraYaw)*radius);
    desiredCam.lerp(new THREE.Vector3(0,10.2,18.5),1-reveal);
    target.set(ale.group.position.x*.35,1.25,ale.group.position.z-2.7);
  } else if(phase==='meeting'){
    const p=smooth(phaseTime()/3.2),mid=ale.group.position.clone().lerp(kim.group.position,.5);
    desiredCam.set(mid.x+3.1*(1-p*.2),2.9,mid.z+4.2*(1-p*.15));target.set(mid.x,1.35,mid.z);
  } else if(phase==='room'){
    const introRoom=smooth((t-sceneStartedAt)/3.0),radius=5.8,height=3.25+cameraPitch*1.6;
    desiredCam.set(ale.group.position.x+Math.sin(cameraYaw)*radius,height,ale.group.position.z+Math.cos(cameraYaw)*radius);
    desiredCam.lerp(new THREE.Vector3(0,4.8,8.7),1-introRoom);target.set(ale.group.position.x*.25,1.2,ale.group.position.z-2.0);
  } else if(phase==='door'){
    const p=smooth(phaseTime()/2.4);desiredCam.lerpVectors(new THREE.Vector3(ale.group.position.x,2.7,ale.group.position.z+4.5),new THREE.Vector3(0,2.25,-5.4),p);target.lerpVectors(new THREE.Vector3(0,1.3,-7.4),new THREE.Vector3(0,2.3,-8.7),p);
  }
  camera.position.lerp(desiredCam,.07);camera.lookAt(target);
}

function updateVisuals(t){
  const reaction=phase==='meeting'?Math.max(proximity,smooth(phaseTime()/2.2)):phase==='room'?0.22:phase==='door'?0.45:proximity;
  ale.update(t,reaction*.55);kim.update(t,reaction);
  updateBond(t);
  if(arenaRoot.visible){
    const pulse=1+Math.sin(t*.84)*.025+reaction*.04;sphere.scale.setScalar(pulse);
    halos[0].scale.setScalar(1+Math.sin(t*.71)*.05);halos[1].scale.setScalar(1+Math.sin(t*.49)*.08);halos[2].scale.setScalar(1+Math.sin(t*.39)*.11);
    sphereLight.intensity=(phase==='meeting'?260:470)*(1+Math.sin(t*.8)*.055);arenaDust.rotation.y=t*.01;
  }
  if(roomRoot.visible)roomDust.rotation.y=-t*.006;
}

function animate(){
  requestAnimationFrame(animate);frame++;const dt=clock.getDelta(),t=clock.elapsedTime;
  updatePlayer(dt);
  if(phase==='concert')updateConcert(t);else if(phase==='meeting')updateMeeting(t);else if(phase==='room')updateRoom(t);
  updateVisuals(t);updateCamera(t);renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);});
