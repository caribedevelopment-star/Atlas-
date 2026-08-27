import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const canvas = $('#world');
const intro = $('#intro');
const enterButton = $('#enter');
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
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.45));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050403');
scene.fog = new THREE.FogExp2('#090504', 0.026);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 180);
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
const desired = new THREE.Vector3();
const target = new THREE.Vector3();

let started = false;
let phase = 'idle';
let phaseStartedAt = 0;
let cameraYaw = 0;
let cameraPitch = 0.18;
let proximity = 0;
let currentPlayer = null;
let currentKim = null;
let audioSystem = null;
let frame = 0;
let transitioning = false;
let worldProgress = 0;

const keyboard = { forward:false, back:false, left:false, right:false };
const mobileAxis = new THREE.Vector2();
let joyPointer = null;
let joyOrigin = new THREE.Vector2();
let lookPointer = null;
let lastLook = new THREE.Vector2();

function clamp01(v){ return THREE.MathUtils.clamp(v,0,1); }
function smooth(v){ v=clamp01(v); return v*v*(3-2*v); }
function setPhase(name){ phase=name; phaseStartedAt=clock.elapsedTime; }
function phaseTime(){ return clock.elapsedTime-phaseStartedAt; }
function setHint(text){ hint.textContent=text; }
function showChapter(index,title,duration=1800){
  chapterIndex.textContent=index; chapterTitle.textContent=title;
  chapter.classList.remove('hidden');
  setTimeout(()=>chapter.classList.add('hidden'),duration);
}
function fadeToBlack(on=true){ veil.classList.toggle('on',on); }
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

scene.add(new THREE.AmbientLight('#5d493d',0.42));
const globalKey = new THREE.DirectionalLight('#ff8a42',1.05);
globalKey.position.set(6,14,8); scene.add(globalKey);
const meetingLight = new THREE.PointLight('#ffd6a6',0,16,2); scene.add(meetingLight);

const arenaRoot=new THREE.Group();
const roomRoot=new THREE.Group(); roomRoot.visible=false;
const tunnelRoot=new THREE.Group(); tunnelRoot.visible=false;
const landRoot=new THREE.Group(); landRoot.visible=false;
scene.add(arenaRoot,roomRoot,tunnelRoot,landRoot);

const entityVert=`
uniform float uTime; uniform float uReaction; varying vec3 vN; varying vec3 vW; varying vec3 vP;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){vP=position;float q=n(position*1.5+vec3(uTime*.04,uTime*.025,-uTime*.032));float breath=sin(uTime*.82+position.y*1.45)*.018;float d=(q-.5)*(.06+uReaction*.075)+breath;vec3 p=position+normal*d;vN=normalize(normalMatrix*normal);vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const entityFrag=`
uniform float uTime; uniform float uReaction; uniform vec3 uBase; uniform vec3 uCore; varying vec3 vN; varying vec3 vW; varying vec3 vP;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*n(p);p*=2.03;a*=.5;}return f;}
void main(){vec3 nn=normalize(vN),view=normalize(cameraPosition-vW);float fres=pow(1.-max(dot(nn,view),0.),2.4);float mineral=fbm(vP*2.4+vec3(0,uTime*.012,0));float vein=smoothstep(.74,.9,mineral+sin(vP.y*6.4+mineral*5.)*.08);vec3 ld=normalize(vec3(-.35,.82,.45));float lam=max(dot(nn,ld),0.);vec3 base=uBase*(.58+lam*.44)+vec3(.015);float glow=vein*(.035+uReaction*.72)+fres*(.028+uReaction*.07);vec3 c=mix(base,uCore,clamp(glow,0.,1.));c+=uCore*vein*uReaction*.32;gl_FragColor=vec4(c,1.);}`;
function entityMaterial(base,core){return new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uReaction:{value:0},uBase:{value:new THREE.Color(base)},uCore:{value:new THREE.Color(core)}},vertexShader:entityVert,fragmentShader:entityFrag});}
function tube(points,radius,radial=18){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return new THREE.TubeGeometry(curve,64,radius,radial,false);}

class Entity{
  constructor({parent,position=[0,0,0],base='#0b0b0c',core='#c3c9ce',variant='ale',scale=1}){
    this.group=new THREE.Group(); this.group.position.set(...position); parent.add(this.group);
    this.visual=new THREE.Group(); this.group.add(this.visual); this.reaction=0; this.variant=variant;
    const a=entityMaterial(base,core), b=entityMaterial('#090909',core); this.materials=[a,b];
    const mass1=new THREE.Mesh(new THREE.IcosahedronGeometry(.9,5),a); mass1.scale.set(1.05,1.48,.78); mass1.position.set(variant==='kim'?.04:-.05,.02,0);
    const mass2=new THREE.Mesh(new THREE.IcosahedronGeometry(.72,5),b); mass2.scale.set(.95,1.15,.72); mass2.position.set(variant==='kim'?-.18:.18,.72,.02);
    const mass3=new THREE.Mesh(new THREE.IcosahedronGeometry(.48,4),a); mass3.scale.set(1.05,.82,.7); mass3.position.set(variant==='kim'?.12:-.16,1.37,.01);
    this.visual.add(mass1,mass2,mass3);
    const loopPts=variant==='kim'
      ? [[-.42,.95,.03],[-.75,.55,.08],[-.7,-.08,.12],[-.38,-.63,.1],[.05,-.75,.04]]
      : [[.42,.88,-.02],[.76,.52,-.04],[.72,-.08,.0],[.43,-.58,.05],[.08,-.72,.04]];
    const loop=new THREE.Mesh(tube(loopPts,.28),b); this.visual.add(loop);
    this.arm=new THREE.Group(); this.arm.position.set(variant==='kim'?-.62:.62,.75,.08); this.visual.add(this.arm);
    const dir=variant==='kim'?-1:1;
    const armMesh=new THREE.Mesh(tube([[0,0,0],[.28*dir,.02,.02],[.55*dir,.04,.01],[.78*dir,.02,0]],.18,16),a); this.arm.add(armMesh);
    this.hand=new THREE.Mesh(new THREE.IcosahedronGeometry(.24,4),a); this.hand.position.set(.82*dir,.02,0); this.arm.add(this.hand);
    this.armRestScale=.72; this.arm.scale.set(this.armRestScale,1,1);
    this.core=new THREE.Mesh(new THREE.IcosahedronGeometry(.58,3),new THREE.MeshBasicMaterial({color:core,transparent:true,opacity:.018,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.core.scale.set(1.1,1.5,.78); this.core.position.y=.2; this.visual.add(this.core);
    const count=64,arr=new Float32Array(count*3);this.particleBase=[];
    for(let i=0;i<count;i++){const aa=Math.random()*Math.PI*2,r=.45+Math.random()*.9,p=new THREE.Vector3(Math.cos(aa)*r*.72,(Math.random()-.5)*2.8+.25,Math.sin(aa)*r*.42);this.particleBase.push(p);arr.set([p.x,p.y,p.z],i*3)}
    this.particleGeo=new THREE.BufferGeometry();this.particleGeo.setAttribute('position',new THREE.BufferAttribute(arr,3));
    this.particleMat=new THREE.PointsMaterial({color:core,size:.025,transparent:true,opacity:.08,depthWrite:false,blending:THREE.AdditiveBlending});
    this.particles=new THREE.Points(this.particleGeo,this.particleMat);this.visual.add(this.particles);
    this.group.scale.setScalar(scale);
  }
  update(t,reaction=0,meeting=0){
    this.reaction=THREE.MathUtils.lerp(this.reaction,reaction,.06);
    this.materials.forEach((m,i)=>{m.uniforms.uTime.value=t*(i?.92:1);m.uniforms.uReaction.value=this.reaction});
    this.visual.position.y=1.34+Math.sin(t*.78+this.group.position.x*.12)*.07+this.reaction*.035;
    this.visual.rotation.z=Math.sin(t*.38+(this.variant==='kim'?1:0))*.025;
    this.core.material.opacity=.018+this.reaction*.15;
    this.arm.scale.x=THREE.MathUtils.lerp(this.arm.scale.x,this.armRestScale+meeting*.63,.07);
    this.arm.rotation.z=THREE.MathUtils.lerp(this.arm.rotation.z,(this.variant==='kim'?-.06:.06)*meeting,.06);
    this.particleMat.opacity=.07+this.reaction*.52;
    const attr=this.particleGeo.attributes.position;
    for(let i=0;i<this.particleBase.length;i++){const p=this.particleBase[i],d=this.reaction*.09;attr.setXYZ(i,p.x+Math.sin(t*.7+i)*d,p.y+Math.sin(t*.45+i*.8)*d*2,p.z+Math.cos(t*.55+i*1.1)*d)}
    attr.needsUpdate=true; this.particles.rotation.y+=.001+this.reaction*.003;
  }
  handWorld(){ return this.hand.getWorldPosition(new THREE.Vector3()); }
}

const arenaFloor=new THREE.Mesh(new THREE.CircleGeometry(29,112),new THREE.MeshStandardMaterial({color:'#070606',roughness:.98}));arenaFloor.rotation.x=-Math.PI/2;arenaRoot.add(arenaFloor);
const shell=new THREE.Mesh(new THREE.CylinderGeometry(29,29,15,112,1,true),new THREE.MeshStandardMaterial({color:'#020202',roughness:1,side:THREE.BackSide}));shell.position.y=7.5;arenaRoot.add(shell);
for(const [r,y,o] of [[19,3,.66],[22.5,5,.52],[26,7,.36]]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.09,8,160),new THREE.MeshBasicMaterial({color:'#7a1c09',transparent:true,opacity:o}));ring.rotation.x=Math.PI/2;ring.position.y=y;arenaRoot.add(ring)}

const stage=new THREE.Group();stage.position.set(0,.35,-17.2);arenaRoot.add(stage);
const stageBody=new THREE.Mesh(new THREE.BoxGeometry(13,1.2,5.4),new THREE.MeshStandardMaterial({color:'#0d0907',roughness:.62,metalness:.2}));stage.add(stageBody);
const stageGlow=new THREE.PointLight('#ff4b10',160,42,2);stageGlow.position.set(0,3.2,1);stage.add(stageGlow);
const stageBars=[];
for(let row=0;row<5;row++)for(let col=0;col<22;col++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.43,.07,.13),new THREE.MeshBasicMaterial({color:col%4?'#ff5a14':'#ffc163',transparent:true,opacity:.5}));bar.position.set(-5.8+col*.56,.9,-2.2+row*1.05);stage.add(bar);stageBars.push(bar)}
const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=256;const sctx=signCanvas.getContext('2d');sctx.fillStyle='#18100b';sctx.fillRect(0,0,1024,256);sctx.font='900 180px Arial Black, Arial';sctx.textAlign='center';sctx.textBaseline='middle';sctx.fillStyle='#fff1d3';sctx.shadowColor='#ff6a1e';sctx.shadowBlur=35;sctx.fillText('RAWA',512,135);
const signTex=new THREE.CanvasTexture(signCanvas);signTex.colorSpace=THREE.SRGBColorSpace;
const sign=new THREE.Mesh(new THREE.PlaneGeometry(6.8,1.65),new THREE.MeshBasicMaterial({map:signTex,transparent:true}));sign.position.set(0,.05,2.72);sign.rotation.x=-.03;stage.add(sign);

const sphereGroup=new THREE.Group();sphereGroup.position.set(0,9.4,-16);arenaRoot.add(sphereGroup);
const sphere=new THREE.Mesh(new THREE.SphereGeometry(4.15,72,56),new THREE.MeshStandardMaterial({color:'#ffe6a7',emissive:'#ff9a28',emissiveIntensity:15,roughness:.35}));sphereGroup.add(sphere);
const halos=[];for(const [r,o,c] of [[5,.15,'#ff9a32'],[6.3,.055,'#ff6b1a'],[8,.018,'#ffd47d']]){const h=new THREE.Mesh(new THREE.SphereGeometry(r,40,28),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,depthWrite:false,blending:THREE.AdditiveBlending}));sphereGroup.add(h);halos.push(h)}
const sphereLight=new THREE.PointLight('#ff9b2d',760,70,2);sphereGroup.add(sphereLight);

const crowdGeo=new THREE.DodecahedronGeometry(1,0);const crowdMat=new THREE.MeshStandardMaterial({color:'#090807',roughness:1});
const crowdData=[];
for(let i=0;i<2150;i++){const a=Math.random()*Math.PI*2,r=4+Math.pow(Math.random(),.65)*23,x=Math.cos(a)*r*.98,z=Math.sin(a)*r*.78-5.2;if(z>14||z<-21||Math.abs(x)>25)continue;if(Math.abs(x)<2.9&&z>-1&&z<13)continue;crowdData.push({x,z,s:.3+Math.random()*.68,seed:Math.random()*9})}
const crowd=new THREE.InstancedMesh(crowdGeo,crowdMat,crowdData.length);crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);arenaRoot.add(crowd);
const dummy=new THREE.Object3D();
function updateCrowd(t,intimacy=0){if(frame%2)return;for(let i=0;i<crowdData.length;i++){const p=crowdData[i],beat=(Math.sin(t*4.4+p.seed)+1)*.5,sway=Math.sin(t*1.7+p.seed)*.08*(1-intimacy*.8);dummy.position.set(p.x+sway,p.s*(.56+beat*.035),p.z);dummy.rotation.set(0,p.seed,sway*.7);dummy.scale.set(.36*p.s,1.9*p.s*(1+beat*.035),.36*p.s);dummy.updateMatrix();crowd.setMatrixAt(i,dummy.matrix)}crowd.instanceMatrix.needsUpdate=true}

const beams=[];for(let i=0;i<12;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(.6,15,16,1,true),new THREE.MeshBasicMaterial({color:i%2?'#ff5a1c':'#ffb35b',transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));cone.position.set((i-5.5)*1.7,7,-13);cone.rotation.z=(i-5.5)*.045;arenaRoot.add(cone);beams.push(cone)}

const arenaAle=new Entity({parent:arenaRoot,position:[-1.5,0,12.5],core:'#b9c0c8',variant:'ale',scale:1.05});
const arenaKim=new Entity({parent:arenaRoot,position:[1.6,0,1.4],core:'#d39867',variant:'kim',scale:1.02});

const bondGeo=new THREE.BufferGeometry();const bondArr=new Float32Array(42*3);bondGeo.setAttribute('position',new THREE.BufferAttribute(bondArr,3));const bondMat=new THREE.LineBasicMaterial({color:'#ffd1a0',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});const bond=new THREE.Line(bondGeo,bondMat);arenaRoot.add(bond);
function updateBond(t,meet=0){const a=arenaAle.handWorld(),b=arenaKim.handWorld(),attr=bondGeo.attributes.position;for(let i=0;i<42;i++){const u=i/41;tmp.lerpVectors(a,b,u);const env=Math.sin(u*Math.PI);tmp.y+=Math.sin(u*Math.PI*4+t*2)*.05*env;attr.setXYZ(i,tmp.x,tmp.y,tmp.z)}attr.needsUpdate=true;bondMat.opacity=Math.max(0,(proximity-.58)/.42)*.65+meet*.3}

const roomFloor=new THREE.Mesh(new THREE.PlaneGeometry(22,32),new THREE.MeshStandardMaterial({color:'#14110f',roughness:.86,metalness:.08}));roomFloor.rotation.x=-Math.PI/2;roomRoot.add(roomFloor);
const back=new THREE.Mesh(new THREE.PlaneGeometry(22,10),new THREE.MeshStandardMaterial({color:'#0b0a09',roughness:.96}));back.position.set(0,5,-12);roomRoot.add(back);
for(const x of [-11,11]){const w=new THREE.Mesh(new THREE.PlaneGeometry(32,10),new THREE.MeshStandardMaterial({color:'#0b0a09',roughness:.96,side:THREE.DoubleSide}));w.position.set(x,5,0);w.rotation.y=Math.PI/2;roomRoot.add(w)}
const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(22,32),new THREE.MeshStandardMaterial({color:'#080706',roughness:1,side:THREE.DoubleSide}));ceiling.position.y=10;ceiling.rotation.x=Math.PI/2;roomRoot.add(ceiling);
const roomLight=new THREE.RectAreaLight('#e7c7a7',5,5,8);roomLight.position.set(-5,6,-1);roomLight.lookAt(0,0,-3);roomRoot.add(roomLight);
const doorFrame=new THREE.Mesh(new THREE.BoxGeometry(3.8,6.9,.38),new THREE.MeshStandardMaterial({color:'#18130f',roughness:.72}));doorFrame.position.set(0,3.45,-11.72);roomRoot.add(doorFrame);
const door=new THREE.Mesh(new THREE.PlaneGeometry(3.05,6.05),new THREE.MeshBasicMaterial({color:'#f8dec1',transparent:true,opacity:.11,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));door.position.set(0,3.3,-11.5);roomRoot.add(door);
const doorHalo=new THREE.PointLight('#f2c697',28,12,2);doorHalo.position.set(0,3.4,-9.8);roomRoot.add(doorHalo);
const roomAle=new Entity({parent:roomRoot,position:[-.8,0,8.8],core:'#b9c0c8',variant:'ale',scale:1.02});
const roomKim=new Entity({parent:roomRoot,position:[1.2,0,6.8],core:'#d39867',variant:'kim',scale:.98});

const tunnelMat=new THREE.MeshBasicMaterial({color:'#d7b18d',transparent:true,opacity:.18,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
const tunnelRings=[];for(let i=0;i<32;i++){const r=new THREE.Mesh(new THREE.TorusGeometry(2.6+i*.03,.035,7,64),tunnelMat.clone());r.position.z=-i*2.0;r.rotation.z=i*.23;tunnelRoot.add(r);tunnelRings.push(r)}
const starCount=900,starArr=new Float32Array(starCount*3);for(let i=0;i<starCount;i++){const a=Math.random()*Math.PI*2,rr=1+Math.random()*5.5;starArr.set([Math.cos(a)*rr,Math.sin(a)*rr,-Math.random()*70],i*3)}const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starArr,3));const tunnelStars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#f4d7bd',size:.04,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));tunnelRoot.add(tunnelStars);

landRoot.position.set(0,0,0);
const landFloor=new THREE.Mesh(new THREE.PlaneGeometry(80,90,1,1),new THREE.MeshStandardMaterial({color:'#7b6d5b',roughness:1}));landFloor.rotation.x=-Math.PI/2;landFloor.position.z=-12;landRoot.add(landFloor);
const hemi=new THREE.HemisphereLight('#b8c9d6','#5a4b3d',1.1);landRoot.add(hemi);const sun=new THREE.DirectionalLight('#f1c98a',2.2);sun.position.set(-12,18,8);landRoot.add(sun);
const greenMat=new THREE.MeshStandardMaterial({color:'#60734c',roughness:.92,transparent:true,opacity:0});
const lavenderMat=new THREE.MeshStandardMaterial({color:'#6d4b8c',roughness:.86,transparent:true,opacity:0});
const grassGeo=new THREE.ConeGeometry(.035,.45,5);const grass=new THREE.InstancedMesh(grassGeo,greenMat,950);const lavender=new THREE.InstancedMesh(new THREE.ConeGeometry(.055,.62,6),lavenderMat,620);landRoot.add(grass,lavender);
for(let i=0;i<950;i++){dummy.position.set((Math.random()-.5)*42,.22,-8-Math.random()*38);dummy.rotation.y=Math.random()*6.28;dummy.scale.setScalar(.6+Math.random()*.9);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix)}
for(let i=0;i<620;i++){dummy.position.set((Math.random()-.5)*40,.31,-18-Math.random()*30);dummy.rotation.y=Math.random()*6.28;dummy.scale.setScalar(.65+Math.random()*.9);dummy.updateMatrix();lavender.setMatrixAt(i,dummy.matrix)}
grass.instanceMatrix.needsUpdate=true;lavender.instanceMatrix.needsUpdate=true;
const landAle=new Entity({parent:landRoot,position:[-1,0,14],core:'#b9c0c8',variant:'ale',scale:1.02});
const landKim=new Entity({parent:landRoot,position:[1.25,0,11.8],core:'#d39867',variant:'kim',scale:.98});

async function createAudio(){
  const ext=new Audio('/audio/rawayana.mp3');ext.loop=true;ext.volume=.72;ext.preload='auto';
  try{await new Promise((res,rej)=>{const ok=()=>res(),bad=()=>rej();ext.addEventListener('canplaythrough',ok,{once:true});ext.addEventListener('error',bad,{once:true});ext.load();setTimeout(bad,1100)});await ext.play();return{mode:'track',set(p){ext.volume=.64-p*.35},fade(v){ext.volume=v}}}
  catch{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;const ctx=new AC(),master=ctx.createGain();master.gain.value=.62;master.connect(ctx.destination);const crowdGain=ctx.createGain();crowdGain.gain.value=.12;crowdGain.connect(master);const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.36;const noise=ctx.createBufferSource();noise.buffer=buf;noise.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;noise.connect(filter).connect(crowdGain);noise.start();const bassGain=ctx.createGain();bassGain.gain.value=.08;bassGain.connect(master);const bass=ctx.createOscillator();bass.type='sine';bass.frequency.value=51;bass.connect(bassGain);bass.start();const topGain=ctx.createGain();topGain.gain.value=.025;topGain.connect(master);const top=ctx.createOscillator();top.type='triangle';top.frequency.value=102;top.connect(topGain);top.start();ctx.resume();return{mode:'synth',set(p){crowdGain.gain.setTargetAtTime(.12*(1-p*.92),ctx.currentTime,.08);bassGain.gain.setTargetAtTime(.08*(1-p*.48),ctx.currentTime,.08);topGain.gain.setTargetAtTime(.025+p*.045,ctx.currentTime,.08)},fade(v){master.gain.setTargetAtTime(v,ctx.currentTime,.12)}}}
}

function key(e,v){const k=e.key.toLowerCase();if(k==='w'||k==='arrowup')keyboard.forward=v;if(k==='s'||k==='arrowdown')keyboard.back=v;if(k==='a'||k==='arrowleft')keyboard.left=v;if(k==='d'||k==='arrowright')keyboard.right=v}
addEventListener('keydown',e=>{key(e,true);if(e.key.startsWith('Arrow'))e.preventDefault()},{passive:false});addEventListener('keyup',e=>key(e,false));
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.clientX<innerWidth*.48){joyPointer=e.pointerId;joyOrigin.set(e.clientX,e.clientY);joystick.style.left=`${e.clientX-60}px`;joystick.style.top=`${e.clientY-60}px`;joystick.style.bottom='auto';joystick.classList.remove('hidden');return}lookPointer=e.pointerId;lastLook.set(e.clientX,e.clientY)});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer){const dx=e.clientX-joyOrigin.x,dy=e.clientY-joyOrigin.y,l=Math.min(46,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);mobileAxis.set(Math.cos(a)*l/46,-Math.sin(a)*l/46);joystickKnob.style.transform=`translate(${Math.cos(a)*l}px,${Math.sin(a)*l}px)`}else if(e.pointerId===lookPointer){const dx=e.clientX-lastLook.x,dy=e.clientY-lastLook.y;cameraYaw-=dx*.0048;cameraPitch=THREE.MathUtils.clamp(cameraPitch-dy*.0038,-.18,.62);lastLook.set(e.clientX,e.clientY)}});
function releasePointer(e){if(e.pointerId===joyPointer){joyPointer=null;mobileAxis.set(0,0);joystickKnob.style.transform='translate(0,0)';joystick.classList.add('hidden')}if(e.pointerId===lookPointer)lookPointer=null}
canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);

function movementVector(){const x=(keyboard.right?1:0)-(keyboard.left?1:0)+mobileAxis.x,z=(keyboard.back?1:0)-(keyboard.forward?1:0)-mobileAxis.y;tmp.set(x,0,z);if(tmp.lengthSq()>1)tmp.normalize();const f=new THREE.Vector3(Math.sin(cameraYaw),0,-Math.cos(cameraYaw));const r=new THREE.Vector3(Math.cos(cameraYaw),0,Math.sin(cameraYaw));return new THREE.Vector3().addScaledVector(f,-tmp.z).addScaledVector(r,tmp.x)}
function movePlayer(dt,bounds){if(!currentPlayer||transitioning||phase.includes('cinematic')||phase==='tunnel')return;const v=movementVector();if(v.lengthSq()>.01){v.normalize();currentPlayer.group.position.addScaledVector(v,dt*3.4);currentPlayer.group.rotation.y=THREE.MathUtils.lerp(currentPlayer.group.rotation.y,Math.atan2(v.x,v.z),.09)}currentPlayer.group.position.x=THREE.MathUtils.clamp(currentPlayer.group.position.x,bounds.x0,bounds.x1);currentPlayer.group.position.z=THREE.MathUtils.clamp(currentPlayer.group.position.z,bounds.z0,bounds.z1)}

async function startRoom(){
  transitioning=true;fadeToBlack(true);audioSystem?.fade?.(0);await wait(900);
  arenaRoot.visible=false;roomRoot.visible=true;tunnelRoot.visible=false;landRoot.visible=false;scene.background.set('#070605');scene.fog=new THREE.FogExp2('#090807',.032);
  currentPlayer=roomAle;currentKim=roomKim;roomAle.group.position.set(-.8,0,8.8);roomKim.group.position.set(1.2,0,6.8);cameraYaw=0;cameraPitch=.18;setPhase('room');proximity=0;proximityBar.style.transform='scaleX(0)';
  fadeToBlack(false);showChapter('MEMORY 02','THE ROOM',2000);setHint('ACÉRCATE A LA PUERTA');await wait(650);transitioning=false;
}
async function startTunnel(){
  if(transitioning)return;transitioning=true;setPhase('tunnel');hud.classList.add('hidden');fadeToBlack(true);await wait(680);
  roomRoot.visible=false;tunnelRoot.visible=true;scene.background.set('#020202');scene.fog=null;camera.position.set(0,0,4);camera.rotation.set(0,0,0);fadeToBlack(false);await wait(3150);
  fadeToBlack(true);await wait(700);tunnelRoot.visible=false;landRoot.visible=true;scene.background.set('#8997a0');scene.fog=new THREE.FogExp2('#9ba6aa',.018);currentPlayer=landAle;currentKim=landKim;landAle.group.position.set(-1,0,14);landKim.group.position.set(1.25,0,11.8);cameraYaw=0;cameraPitch=.2;worldProgress=0;setPhase('land');fadeToBlack(false);hud.classList.remove('hidden');showChapter('MEMORY 03','THE AWAKENING',2200);setHint('AVANZA JUNTO A ELLA');transitioning=false;
}

enterButton.addEventListener('click',async()=>{started=true;intro.classList.add('hidden');hud.classList.remove('hidden');currentPlayer=arenaAle;currentKim=arenaKim;setPhase('concert');showChapter('MEMORY 01','THE ENCOUNTER',1800);setHint('MUÉVETE ENTRE LA MULTITUD · ENCUÉNTRALA');audioSystem=await createAudio()});

function updateConcert(t,dt){
  movePlayer(dt,{x0:-7,x1:7,z0:-1,z1:14});
  const d=arenaAle.group.position.distanceTo(arenaKim.group.position);proximity=smooth(1-clamp01((d-1.6)/9));proximityBar.style.transform=`scaleX(${proximity})`;audioSystem?.set?.(proximity);
  const meet=smooth((proximity-.72)/.28);arenaAle.update(t,proximity*.45,meet);arenaKim.update(t,proximity,meet);updateBond(t,meet);updateCrowd(t,proximity);
  meetingLight.position.lerp(arenaAle.group.position.clone().lerp(arenaKim.group.position,.5).add(new THREE.Vector3(0,2.2,0)),.08);meetingLight.intensity=proximity*30;
  crowdMat.color.lerp(new THREE.Color(proximity>.65?'#050505':'#090807'),.03);
  stageBars.forEach((b,i)=>b.material.opacity=.34+Math.max(0,Math.sin(t*5.2+i*.42))*.58);beams.forEach((b,i)=>{b.rotation.y=Math.sin(t*.4+i)*.45;b.material.opacity=.022+Math.max(0,Math.sin(t*3+i))*.035});
  const pulse=1+Math.sin(t*1.9)*.025;sphere.scale.setScalar(pulse);halos.forEach((h,i)=>h.scale.setScalar(1+Math.sin(t*(.42+i*.07)+i)*(.05+i*.02)));sphereLight.intensity=720+Math.max(0,Math.sin(t*2.1))*220;
  if(d<1.82&&phase==='concert'){setPhase('concert_cinematic');setHint('');}
  if(phase==='concert_cinematic'){
    const m=smooth(phaseTime()/3.1);const mid=arenaAle.group.position.clone().lerp(arenaKim.group.position,.5);arenaAle.group.position.lerp(new THREE.Vector3(mid.x-.78,0,mid.z+.05),.025);arenaKim.group.position.lerp(new THREE.Vector3(mid.x+.78,0,mid.z-.05),.025);arenaAle.update(t,1,m);arenaKim.update(t,1,m);updateBond(t,m);if(phaseTime()>3.35)startRoom();
  }
}

function updateRoom(t,dt){
  movePlayer(dt,{x0:-8,x1:8,z0:-10.3,z1:10});roomAle.update(t,.12,0);roomKim.update(t,.18,0);
  const dDoor=roomAle.group.position.distanceTo(new THREE.Vector3(0,0,-9.9));door.material.opacity=.11+Math.max(0,Math.sin(t*1.2))*.08;doorHalo.intensity=22+Math.sin(t*1.3)*5;
  if(dDoor<2.1&&!transitioning){setHint('CRUZA');startTunnel();}
}

function updateTunnel(t){
  const p=phaseTime();camera.position.z=4-p*10.8;camera.rotation.z=Math.sin(p*.8)*.05;tunnelRings.forEach((r,i)=>{r.rotation.z+=.006*(i%3+1);r.material.opacity=.08+Math.max(0,Math.sin(t*2+i*.4))*.2});tunnelStars.position.z=(p*14)%12;
}

function updateLand(t,dt){
  movePlayer(dt,{x0:-12,x1:12,z0:-38,z1:16});landAle.update(t,.16+worldProgress*.3,0);landKim.update(t,.18+worldProgress*.36,0);
  const followTarget=landAle.group.position.clone().add(new THREE.Vector3(1.7,0,-2));landKim.group.position.lerp(followTarget,.012);
  worldProgress=smooth(clamp01((14-landAle.group.position.z)/38));greenMat.opacity=smooth(worldProgress*1.45);lavenderMat.opacity=smooth((worldProgress-.28)/.72);landFloor.material.color.lerp(new THREE.Color(worldProgress>.5?'#657253':'#7b6d5b'),.02);
  hemi.intensity=1.05+worldProgress*.75;sun.intensity=2.0+worldProgress*1.25;
  if(worldProgress>.5)setHint('EL MUNDO RECUERDA CÓMO ESTAR VIVO');
  if(worldProgress>.9)setHint('SIGUE HACIA LA LAVANDA');
}

function updateCamera(t){
  if(!started){camera.position.set(Math.sin(t*.055)*3,11.5,24);camera.lookAt(0,5,-11);return}
  if(phase==='tunnel')return;
  if(phase==='concert' || phase==='concert_cinematic'){
    if(phase==='concert_cinematic'){
      const m=smooth(phaseTime()/2.8),mid=arenaAle.group.position.clone().lerp(arenaKim.group.position,.5);desired.set(mid.x+3.4,3.3,mid.z+5.2);target.set(mid.x,1.45,mid.z);camera.position.lerp(desired,.065);camera.lookAt(target);return;
    }
  }
  const player=currentPlayer;if(!player)return;
  const dist=phase==='room'?6.1:phase==='land'?7.3:7.1;
  const height=phase==='room'?3.3:3.7;
  desired.set(player.group.position.x+Math.sin(cameraYaw)*dist,player.group.position.y+height+Math.sin(cameraPitch)*1.4,player.group.position.z+Math.cos(cameraYaw)*dist);
  target.set(player.group.position.x,player.group.position.y+1.35,player.group.position.z);
  camera.position.lerp(desired,.075);camera.lookAt(target);
}

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),t=clock.elapsedTime;frame++;
  if(started){if(phase==='concert'||phase==='concert_cinematic')updateConcert(t,dt);else if(phase==='room')updateRoom(t,dt);else if(phase==='tunnel')updateTunnel(t);else if(phase==='land')updateLand(t,dt)}
  updateCamera(t);renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.45));renderer.setSize(innerWidth,innerHeight)});
