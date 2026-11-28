import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const host=document.querySelector('#world');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9a958b);
scene.fog=new THREE.Fog(0x9a958b,24,75);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,120);
camera.position.set(0,1.7,13);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
host.appendChild(renderer.domElement);

const stone=new THREE.MeshStandardMaterial({color:0xb7aa91,roughness:.88});
const pale=new THREE.MeshStandardMaterial({color:0xd0c4aa,roughness:.8});
const dark=new THREE.MeshStandardMaterial({color:0x51483b,roughness:.95});
const glass=new THREE.MeshStandardMaterial({color:0x6e8790,emissive:0x182a34,roughness:.35,metalness:.1});
const gold=new THREE.MeshStandardMaterial({color:0x9d8050,metalness:.55,roughness:.35});
const floorMat=new THREE.MeshStandardMaterial({color:0x827b6d,roughness:.55});
function box(w,h,d,x,y,z,mat=stone){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
function cylinder(rt,rb,h,x,y,z,mat=stone,segments=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
function arch(x,z,scale=1,mat=pale){
  // Paired columns and a curved-looking segmented arch.
  cylinder(.22*scale,.28*scale,5.4*scale,x-2*scale,2.7*scale,z,mat);
  cylinder(.22*scale,.28*scale,5.4*scale,x+2*scale,2.7*scale,z,mat);
  const r=2*scale;
  for(let i=0;i<=12;i++){const a=Math.PI*i/12;const b=box(.52*scale,.42*scale,.55*scale,x+Math.cos(a)*r,5.3*scale+Math.sin(a)*r,z,mat);b.rotation.z=-a}
}
function window(x,y,z,w=1.4,h=3.2){
  box(w+.3,h+.3,.22,x,y,z,dark);
  box(w,h,.24,x,y,z-.14,glass);
  box(.08,h,.12,x,y,z-.3,gold);box(w,.07,.12,x,y,z-.3,gold);
  const a=box(w,.08,.12,x,y,z-.31,gold);a.rotation.z=.0;
}
function makeCathedral(){
  box(18,.5,62,0,-.28,-14,floorMat);
  box(18,.5,62,0,9,-14,stone);
  box(.7,9,62,-9,4.5,-14,dark);box(.7,9,62,9,4.5,-14,dark);
  // Side aisles and repeating piers
  for(let z=12;z>=-39;z-=8){
    arch(-5.3,z,.88,pale);arch(5.3,z,.88,pale);
    box(1,7,1,-8.6,3.5,z,stone);box(1,7,1,8.6,3.5,z,stone);
    window(-8.55,5.2,z,1.1,2.7);window(8.55,5.2,z,1.1,2.7);
  }
  // Nave ceiling ribs, long central vault impression
  for(let z=10;z>=-36;z-=8){
    const rib=box(.32,.32,18,0,8.35,z-4,pale);rib.rotation.z=.05;
  }
  // Altar, apse and sanctuary
  box(0.0,0.0,0.0,0,0,0);
  box(10,.6,7,0,.05,-42,dark);
  box(5,1.2,2.5,0,.9,-43,pale);
  box(2,.25,1.2,0,1.62,-43,gold);
  arch(0,-47,1.35,pale);
  window(0,5.4,-48,3.1,4.2);
  // Side chapel and benches
  for(let z=6;z>-24;z-=5){
    box(3,.65,1.1,-6.2,.5,z,dark);box(3,.65,1.1,6.2,.5,z,dark);
  }
  for(let i=0;i<7;i++){cylinder(.045,.045,3.8,-7.9,2,-31+i*1.3,gold,8)}
  // Decorative capitals and floor inlay
  for(let z=12;z>=-39;z-=8)for(const x of [-5.3,5.3]){
    box(1.15,.38,1.15,x,5.05,z,gold);
  }
  for(let z=10;z>-45;z-=4){const line=box(14,.025,.045,0,.0,z,gold);line.receiveShadow=true}
}
makeCathedral();

const hemi=new THREE.HemisphereLight(0xe6e0d2,0x4b4031,1.45);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe2b0,2.4);sun.position.set(-10,15,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const altarLight=new THREE.PointLight(0xffd69a,38,24);altarLight.position.set(0,5,-40);scene.add(altarLight);
const fill=new THREE.PointLight(0x9bb4c5,18,22);fill.position.set(-7,5,-12);scene.add(fill);

let yaw=0,pitch=0,dragging=false,lastX=0,lastY=0,started=false;
const keys={};
function look(dx,dy){yaw-=dx*.003;pitch=Math.max(-1.05,Math.min(1.05,pitch-dy*.003))}
renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==='t')cycleTime()});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));

function setTime(v){
 const hour=Number(v);document.querySelector('#timeLabel').textContent=String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.round((hour%1)*60)).padStart(2,'0');
 const daylight=Math.max(.12,Math.sin((hour-6)/12*Math.PI));
 sun.intensity=.22+daylight*2.7;hemi.intensity=.35+daylight*1.25;
 sun.color.setHSL(.11,.42,.65+daylight*.25);
 scene.background=new THREE.Color().setHSL(.09,.12,.12+daylight*.43);
 scene.fog.color.copy(scene.background);
 altarLight.intensity=hour<7||hour>18?65:25;
}
const time=document.querySelector('#time');time.addEventListener('input',()=>setTime(time.value));setTime(time.value);
function cycleTime(){time.value=(Number(time.value)+3)%24;setTime(time.value)}
document.querySelector('#shadows').addEventListener('change',e=>{renderer.shadowMap.enabled=e.target.checked;sun.castShadow=e.target.checked});
document.querySelector('#glow').addEventListener('change',e=>{hemi.intensity=e.target.checked?1.45:.55});
document.querySelector('#quality').addEventListener('change',e=>{renderer.setPixelRatio(Math.min(devicePixelRatio,e.target.value==='low'?1:e.target.value==='medium'?1.4:2))});
document.querySelector('#camera').addEventListener('change',e=>{showToast(e.target.value==='pointer'?'Drag to look around the cathedral':'Drag to look around')});
document.querySelector('#go').addEventListener('click',()=>{
 const d=document.querySelector('#destination').value;
 camera.position.set(d==='altar'?0: d==='chapel'? -5.7:0,1.7,d==='altar'?-34:d==='chapel'?-12:13);
 yaw=0;pitch=0;showToast('Moved to '+document.querySelector('#destination').selectedOptions[0].text);
});
function showToast(s){const t=document.querySelector('#toast');t.textContent=s;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2200)}
document.querySelector('#enter').addEventListener('click',()=>{started=true;document.querySelector('#intro').classList.add('hidden');showToast('Use WASD or arrow keys to explore')});
document.querySelector('#hidePanel').addEventListener('click',()=>{document.querySelector('.panel').style.display='none';document.querySelector('#showPanel').style.display='block'});
document.querySelector('#showPanel').addEventListener('click',()=>{document.querySelector('.panel').style.display='block';document.querySelector('#showPanel').style.display='none'});

const clock=new THREE.Clock();
function animate(){
 requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
 if(started){
  let f=0,s=0;
  if(keys.w||keys.arrowup)f+=1;if(keys.s||keys.arrowdown)f-=1;
  if(keys.a)s-=1;if(keys.d)s+=1;
  if(keys.arrowleft)yaw+=dt*1.5;if(keys.arrowright)yaw-=dt*1.5;
  const speed=(keys.shift?8:3.4)*dt;
  camera.position.x+=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed;
  camera.position.z+=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed;
  camera.position.x=THREE.MathUtils.clamp(camera.position.x,-7.8,7.8);
  camera.position.z=THREE.MathUtils.clamp(camera.position.z,-47,12);
  camera.position.y=1.7;
 }
 camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
 renderer.render(scene,camera);
}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
