import * as THREE from 'three';

const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
const canvas=$('#pitch');
let renderer,scene,camera,clock3d;
let homePlayers=[],awayPlayers=[],ball,ballOwner=null,ballVelocity=new THREE.Vector3();
let running=false,paused=false,matchStarted=0,lastFrame=0,homeScore=0,awayScore=0,shots=0,homeShots=0,awayShots=0,selectedPlayer=0;
let elapsed=0,charge=0,charging=false,sprint=false,joy={x:0,y:0},audioCtx=null,musicOn=true,sfxOn=true,musicTimer=null;
const FIELD_X=32,FIELD_Z=19,GOAL_HALF=2.55;
const teamData=[{name:'NORTH CITY',crest:'N',colors:[0x1688e8,0x1d4693],kit:'AZZURRO ELETTRICO'},{name:'ROYAL ATHLETIC',crest:'R',colors:[0xe84d47,0x772730],kit:'ROSSO RUBINO'},{name:'REAL VERDE',crest:'V',colors:[0x32ad69,0x16603d],kit:'VERDE FORESTA'},{name:'GOLDEN UNITED',crest:'G',colors:[0xe5b33c,0x80602b],kit:'ORO CLASSICO'},{name:'METRO FC',crest:'M',colors:[0xe9e9e9,0x333e44],kit:'BIANCO GHIACCIO'}];
let homeTeam=0,awayTeam=1,formation=0,coins=12450;

function init3D(){
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=false;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;}catch(e){console.warn('3D renderer unavailable',e);return;}
  scene=new THREE.Scene();scene.background=new THREE.Color(0x10201b);scene.fog=new THREE.Fog(0x10201b,42,90);
  camera=new THREE.OrthographicCamera(-20,20,12,-12,.1,120);camera.position.set(0,30,21);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xc9f0e2,0x243b2b,2.1));
  const key=new THREE.DirectionalLight(0xffefcf,2.8);key.position.set(-7,24,8);scene.add(key);
  const fill=new THREE.DirectionalLight(0x8dbdff,1.05);fill.position.set(9,14,-10);scene.add(fill);
  buildPitch();buildStadium();buildGoals();
  homePlayers=Array.from({length:3},(_,i)=>createPlayer(true,i));
  awayPlayers=Array.from({length:3},(_,i)=>createPlayer(false,i));
  ball=createBall();resetKickoff();clock3d=new THREE.Clock();animate();window.addEventListener('resize',resize3D,{passive:true});
}
function mat(color,roughness=.85){return new THREE.MeshStandardMaterial({color,roughness,metalness:.02});}
function buildPitch(){
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,150),mat(0x102019));floor.rotation.x=-Math.PI/2;floor.position.y=-.12;scene.add(floor);
 const turfColors=[0x34754a,0x2d6d43];
 for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(FIELD_X/8,FIELD_Z),mat(turfColors[i%2]));m.rotation.x=-Math.PI/2;m.position.set(-FIELD_X/2+FIELD_X/16+i*FIELD_X/8,0,0);scene.add(m);}
 const white=new THREE.MeshBasicMaterial({color:0xe9f3dc,transparent:true,opacity:.68});
 const line=(x1,z1,x2,z2,w=.045)=>{const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);const m=new THREE.Mesh(new THREE.BoxGeometry(len,.035,w),white);m.position.set((x1+x2)/2,.035,(z1+z2)/2);m.rotation.y=-Math.atan2(dz,dx);scene.add(m);};
 line(-16,-9.5,16,-9.5);line(-16,9.5,16,9.5);line(-16,-9.5,-16,9.5);line(16,-9.5,16,9.5);line(0,-9.5,0,9.5);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(2.15,.04,5,60),white);ring.rotation.x=Math.PI/2;ring.position.y=.045;scene.add(ring);
 const spotGeo=new THREE.SphereGeometry(.09,8,6);for(const [x,z] of [[0,0],[-10,0],[10,0]]){const s=new THREE.Mesh(spotGeo,white);s.position.set(x,.055,z);scene.add(s);}
 for(const side of [-1,1]){const box=new THREE.Mesh(new THREE.BoxGeometry(5.1,.035,11),white);box.position.set(side*12.95,.04,0);scene.add(box);const box2=new THREE.Mesh(new THREE.BoxGeometry(2.2,.035,5.4),white);box2.position.set(side*14.9,.045,0);scene.add(box2);const arc=new THREE.Mesh(new THREE.TorusGeometry(2.15,.035,5,40,Math.PI),white);arc.rotation.x=Math.PI/2;arc.rotation.z=side===-1?Math.PI/2:-Math.PI/2;arc.position.set(side*11.05,.05,0);scene.add(arc);}
}
function buildStadium(){
 const standMat=[0x25332f,0x34433d,0x485247];
 for(let tier=0;tier<3;tier++){const geo=new THREE.BoxGeometry(36,1.5,2.7);const a=new THREE.Mesh(geo,mat(standMat[tier]));a.position.set(0,1.2+tier*1.35,-11.2-tier*.1);scene.add(a);const b=a.clone();b.position.z=11.2+tier*.1;scene.add(b);}
 for(const side of [-1,1]){const end=new THREE.Mesh(new THREE.BoxGeometry(2.8,4,25),mat(0x23312b));end.position.set(side*18,2,0);scene.add(end);}
 const crowdGeo=new THREE.SphereGeometry(.10,5,4),crowdMat=[0xd4ddca,0x88af8d,0xe35b49,0x477fbd,0xefbf50,0x535f58];
 const inst=new THREE.InstancedMesh(crowdGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),420);const dummy=new THREE.Object3D();
 for(let i=0;i<420;i++){const side=Math.floor(Math.random()*4),t=Math.random(),y=2+Math.random()*3;let x,z;if(side<2){x=(t-.5)*35;z=side===0?-12.1:12.1;}else{x=side===2?-18.1:18.1;z=(t-.5)*22;}dummy.position.set(x,y,z);dummy.scale.set(.7,.8,.7);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,new THREE.Color(crowdMat[Math.floor(Math.random()*crowdMat.length)]));}scene.add(inst);
 const postGeo=new THREE.CylinderGeometry(.035,.035,7,6),lamp=mat(0xe4f6db);for(let i=0;i<6;i++){const x=-14+i*5.6;const p=new THREE.Mesh(postGeo,lamp);p.position.set(x,7.2,-14);scene.add(p);const l=new THREE.Mesh(new THREE.BoxGeometry(1.5,.18,.3),mat(0xe2f3ce));l.position.set(x,10.65,-14);scene.add(l);}
}
function buildGoals(){
 for(const x of [-16.25,16.25]){const group=new THREE.Group(),pmat=mat(0xe7ede5,.4);const direction=x<0?-1:1;for(const z of [-GOAL_HALF,GOAL_HALF]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,2.25,8),pmat);p.position.set(x,1.12,z);group.add(p);}const cross=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,GOAL_HALF*2,8),pmat);cross.rotation.x=Math.PI/2;cross.position.set(x,2.23,0);group.add(cross);const net=new THREE.Mesh(new THREE.BoxGeometry(1.3,2.2,GOAL_HALF*2),new THREE.MeshBasicMaterial({color:0xd9e6d9,wireframe:true,transparent:true,opacity:.19}));net.position.set(x+direction*.58,1.08,0);group.add(net);scene.add(group);}
}
function createPlayer(isHome,index){
 const team=isHome?teamData[homeTeam]:teamData[awayTeam],root=new THREE.Group();const jersey=mat(team.colors[0]),shorts=mat(team.colors[1]),skin=mat(0xd7a982),dark=mat(0x17201c),sock=mat(isHome?0xe8f2f0:0xf0e9df);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.5,3,7),jersey);torso.position.y=1.13;root.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.22,9,7),skin);head.position.y=1.83;root.add(head);
 const shortsMesh=new THREE.Mesh(new THREE.BoxGeometry(.55,.28,.35),shorts);shortsMesh.position.y=.76;root.add(shortsMesh);
 const limbs=[];for(const s of [-1,1]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.4,2,6),jersey);arm.position.set(s*.39,1.15,0);arm.rotation.z=s*.17;root.add(arm);const legPivot=new THREE.Group();legPivot.position.set(s*.16,.66,0);const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.43,2,6),sock);leg.position.y=-.25;legPivot.add(leg);const boot=new THREE.Mesh(new THREE.BoxGeometry(.15,.1,.28),dark);boot.position.set(0,-.52,.07);legPivot.add(boot);root.add(legPivot);limbs.push(legPivot);}
 const number=new THREE.Mesh(new THREE.BoxGeometry(.16,.18,.02),mat(0xffffff));number.position.set(0,1.3,-.342);root.add(number);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.045,5,28),new THREE.MeshBasicMaterial({color:isHome?0xbfff55:0xff6961,transparent:true,opacity:.85}));ring.rotation.x=Math.PI/2;ring.position.y=.06;root.add(ring);
 root.position.set(isHome?-5:5,0,index===0?0:(index===1?-4.5:4.5));scene.add(root);
 return{root,limbs,isHome,index,speed:0,runClock:Math.random()*4,stun:0,shootCooldown:1+Math.random()*2,homePos:root.position.clone()};
}
function createBall(){const group=new THREE.Group();const sphere=new THREE.Mesh(new THREE.SphereGeometry(.27,12,10),mat(0xf4f5e8,.3));group.add(sphere);const seam=new THREE.Mesh(new THREE.TorusGeometry(.145,.012,4,24),new THREE.MeshBasicMaterial({color:0x17201c}));seam.rotation.x=Math.PI/2;group.add(seam);const seam2=seam.clone();seam2.rotation.z=Math.PI/2;group.add(seam2);group.position.set(0,.27,0);scene.add(group);return group;}
function resize3D(){if(!renderer||!camera)return;renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.4));const aspect=innerWidth/innerHeight;const halfH=11.4;camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();}
function animate(){requestAnimationFrame(animate);if(!renderer||!scene)return;const dt=Math.min(clock3d.getDelta(),.035);const time=clock3d.elapsedTime;
 if(running&&!paused)updateMatch(dt,time);
 for(const p of [...homePlayers,...awayPlayers]){p.runClock+=dt*(2+p.speed*1.6);const swing=Math.sin(p.runClock)*Math.min(.62,p.speed*.18);p.limbs[0].rotation.x=swing;p.limbs[1].rotation.x=-swing;p.root.position.y=Math.abs(Math.sin(p.runClock*2))*.035*Math.min(1,p.speed);}
 if(ball&&ballOwner){const d=ballOwner.root.rotation.y;const off=new THREE.Vector3(Math.sin(d)*.62,0,Math.cos(d)*.62);ball.position.set(ballOwner.root.position.x+off.x,.28,ballOwner.root.position.z+off.z);}
 if(ball){ball.rotation.x+=dt*ballVelocity.z*1.8;ball.rotation.z-=dt*ballVelocity.x*1.8;}
 const targetX=running&&ball?ball.position.x*.48:0,targetZ=running&&ball?ball.position.z*.22:0;const look=new THREE.Vector3(targetX,0,targetZ);camera.position.x+=(targetX-camera.position.x)*Math.min(1,dt*1.2);camera.position.z=21+targetZ;camera.lookAt(look);
 if(running&&!paused&&ballOwner===homePlayers[selectedPlayer]){const v=ballOwner.root.position.clone().project(camera);const x=(v.x*.5+.5)*innerWidth,y=(-v.y*.5+.5)*innerHeight;const el=$('#powerIndicator');el.style.left=x+'px';el.style.top=(y-35)+'px';}
 renderer.render(scene,camera);
}
function resetKickoff(){if(!ball)return;ballOwner=null;ballVelocity.set(0,0,0);ball.position.set(0,.27,0);homePlayers.forEach((p,i)=>{p.root.position.set(-5+i*1.4,0,i===0?0:(i===1?-4.5:4.5));p.root.rotation.y=Math.PI/2;});awayPlayers.forEach((p,i)=>{p.root.position.set(5-i*1.4,0,i===0?0:(i===1?4.5:-4.5));p.root.rotation.y=-Math.PI/2;});}
function updateMatch(dt,time){
 elapsed+=dt;const mins=Math.min(6,Math.floor(elapsed/100*6)),secs=Math.floor((elapsed/100*360)%60);$('#matchClock').textContent=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
 if(elapsed>=100){finishMatch();return;}
 const player=homePlayers[selectedPlayer];let dx=joy.x, dz=joy.y;
 if(keys.has('ArrowLeft')||keys.has('a'))dx=-1;if(keys.has('ArrowRight')||keys.has('d'))dx=1;if(keys.has('ArrowUp')||keys.has('w'))dz=-1;if(keys.has('ArrowDown')||keys.has('s'))dz=1;
 const input=new THREE.Vector2(dx,dz);if(input.length()>1)input.normalize();const speed=sprint||keys.has('Shift')?7:5.1;player.speed=input.length()*speed;
 if(input.lengthSq()>.02){player.root.position.x=THREE.MathUtils.clamp(player.root.position.x+input.x*speed*dt,-15.1,15.1);player.root.position.z=THREE.MathUtils.clamp(player.root.position.z+input.y*speed*dt,-8.6,8.6);player.root.rotation.y=Math.atan2(input.x,input.y);if(!ballOwner&&player.root.position.distanceTo(ball.position)<1.25)ballOwner=player;}
 // Teammates offer passing lanes and recover their shape.
 homePlayers.forEach((p,i)=>{if(i===selectedPlayer)return;const target=new THREE.Vector3(THREE.MathUtils.clamp(ball.position.x+(i===1?2:-2),-12,12),0,(i===1?-4.8:4.8));if(ballOwner&&ballOwner.isHome){target.x=THREE.MathUtils.clamp(player.root.position.x+3,-12,14);}else target.copy(p.homePos);moveAI(p,target,dt,3.3);});
 // Opponents pressure the carrier and take occasional, deliberately forgiving shots.
 awayPlayers.forEach((p,i)=>{p.shootCooldown-=dt;let target;if(ballOwner&&!ballOwner.isHome){target=new THREE.Vector3(THREE.MathUtils.clamp(ball.position.x-2,-14,12),0,ball.position.z+(i-1)*1.8);}else{target=new THREE.Vector3(ball.position.x+(i===0?0:(i-1)*2),0,ball.position.z+(i-1)*1.5);}moveAI(p,target,dt,3.05);if(!ballOwner&&p.root.position.distanceTo(ball.position)<1.05){ballOwner=p;}if(ballOwner===p&&p.shootCooldown<=0&&(p.root.position.x<-8||Math.random()<dt*.065)){kickBall(p,true,.54+Math.random()*.2);p.shootCooldown=3.1+Math.random()*1.8;}});
 // Loose ball pickup. The human team gets a modest assist for approachable play.
 if(!ballOwner){let best=1.3,who=null;for(const p of [...homePlayers,...awayPlayers]){const d=p.root.position.distanceTo(ball.position);if(d<best){best=d;who=p;}}if(who)ballOwner=who;}
 if(ballOwner){const carrier=ballOwner;for(const p of [...homePlayers,...awayPlayers]){if(p!==carrier&&p.root.position.distanceTo(carrier.root.position)<.72&&Math.random()<dt*.8){ballOwner=p;break;}}
   if(carrier.isHome&&carrier===player&&charging){charge=Math.min(1,charge+dt*.72);$('#powerFill').style.width=`${Math.round(charge*100)}%`;$('#powerIndicator').style.display='block';}
   if(carrier.isHome&&carrier!==player&&Math.random()<dt*.12&&carrier.root.position.x>4){kickBall(carrier,false,.47);}
 }else{ball.position.x+=ballVelocity.x*dt;ball.position.z+=ballVelocity.z*dt;ballVelocity.multiplyScalar(Math.pow(.985,dt*60));ball.position.y=.27+Math.abs(Math.sin(time*8))*Math.min(.22,ballVelocity.length()*.015);}
 if(ball.position.z>8.9||ball.position.z< -8.9){ball.position.z=THREE.MathUtils.clamp(ball.position.z,-8.9,8.9);ballVelocity.z*=-.55;}
 if(ball.position.x>16.2||ball.position.x< -16.2){if(Math.abs(ball.position.z)<GOAL_HALF){goal(ball.position.x>0);}else{ballVelocity.x*=-.65;ball.position.x=THREE.MathUtils.clamp(ball.position.x,-16.1,16.1);}}
 if(ballOwner&&ballOwner.root.position.x>14.7&&ballOwner.isHome){ballOwner.root.position.x=14.7;}if(ballOwner&&ballOwner.root.position.x< -14.7&&!ballOwner.isHome){ballOwner.root.position.x=-14.7;}
 if(charging&&ballOwner===player){const powerEl=$('#powerIndicator');powerEl.style.display='block';}else if(!charging){$('#powerIndicator').style.display='none';}
}
function moveAI(p,target,dt,speed){const dx=target.x-p.root.position.x,dz=target.z-p.root.position.z,dist=Math.hypot(dx,dz);p.speed=dist>.3?speed:0;if(dist>.28){const step=Math.min(dist,speed*dt);p.root.position.x+=dx/dist*step;p.root.position.z+=dz/dist*step;p.root.position.x=THREE.MathUtils.clamp(p.root.position.x,-15,15);p.root.position.z=THREE.MathUtils.clamp(p.root.position.z,-8.5,8.5);p.root.rotation.y=Math.atan2(dx,dz);}}
function kickBall(p,isAway,power=.72){const dir=new THREE.Vector3(isAway?-1:1,0,(Math.random()-.5)*.24);const towardsGoal=isAway?Math.max(.45,Math.min(1,(p.root.position.x+16)/32)):Math.max(.4,Math.min(1,(16-p.root.position.x)/32));dir.z+=(Math.random()-.5)*(.35-towardsGoal*.18);dir.normalize();ballOwner=null;ball.position.set(p.root.position.x+dir.x*.65,.3,p.root.position.z+dir.z*.65);ballVelocity.copy(dir).multiplyScalar(5.8+power*10);ballVelocity.y=0;shots++;if(isAway)awayShots++;else homeShots++;playSound('kick');}
function goal(awayScored){if(awayScored)awayScore++;else homeScore++;$('#scoreDisplay').innerHTML=`${homeScore} <i>—</i> ${awayScore}`;showToast(awayScored?'GOL! ROYAL ATHLETIC SEGNA':'GOOOOL! NORTH CITY!');playSound('goal');ballVelocity.set(0,0,0);ballOwner=null;setTimeout(()=>{if(running)resetKickoff();},950);}
function finishMatch(){running=false;document.body.classList.remove('playing');$('#matchScreen').classList.remove('active');$('#resultScreen').classList.add('active');$('#resultHomeName').textContent=teamData[homeTeam].name;$('#resultAwayName').textContent=teamData[awayTeam].name;$('.home-score-crest').textContent=teamData[homeTeam].crest;$('.away-score-crest').textContent=teamData[awayTeam].crest;$('#resultScore').innerHTML=`${homeScore} <i>—</i> ${awayScore}`;$('#resultHeadline').textContent=homeScore>awayScore?'VITTORIA!':homeScore===awayScore?'CHE PARTITA.':'SI RIPARTE.';const totalShots=Math.max(1,homeShots+awayShots);const homePossession=Math.round(50+Math.min(18,Math.max(-18,(homeShots-awayShots)*2)));$('#resultPossession').textContent=`${homePossession}% — POSSESSO PALLA`;
 const rows=$$('.match-stat-row');if(rows.length>=3){const homeTarget=Math.min(homeShots,Math.round(homeShots*.62)),awayTarget=Math.min(awayShots,Math.round(awayShots*.55));rows[0].children[0].textContent=homeShots;rows[0].children[4].textContent=awayShots;rows[0].children[1].firstElementChild.style.width=`${Math.round(homeShots/totalShots*100)}%`;rows[0].children[3].firstElementChild.style.width=`${Math.round(awayShots/totalShots*100)}%`;rows[1].children[0].textContent=homeTarget;rows[1].children[4].textContent=awayTarget;rows[1].children[1].firstElementChild.style.width=`${Math.round(homeTarget/Math.max(1,homeTarget+awayTarget)*100)}%`;rows[1].children[3].firstElementChild.style.width=`${Math.round(awayTarget/Math.max(1,homeTarget+awayTarget)*100)}%`;rows[2].children[0].textContent=`${homePossession}%`;rows[2].children[4].textContent=`${100-homePossession}%`;rows[2].children[1].firstElementChild.style.width=`${homePossession}%`;rows[2].children[3].firstElementChild.style.width=`${100-homePossession}%`;}
 playSound('whistle');startMenuMusic();}
function startGame(){homeScore=awayScore=elapsed=shots=homeShots=awayShots=0;$('#scoreDisplay').innerHTML='0 <i>—</i> 0';$('#matchClock').textContent='00:00';$('#homeScoreName').textContent=teamData[homeTeam].name;$('#awayScoreName').textContent=teamData[awayTeam].name;$('.home-score-crest').textContent=teamData[homeTeam].crest;$('.away-score-crest').textContent=teamData[awayTeam].crest;resetKickoff();$('#resultScreen').classList.remove('active');$$('.screen').forEach(s=>s.classList.remove('active'));$('#matchScreen').classList.add('active');document.body.classList.add('playing');running=true;paused=false;$('#pauseOverlay').classList.remove('open');playSound('whistle');}
const keys=new Set();
function showScreen(name){running=false;paused=false;document.body.classList.remove('playing');$$('.screen').forEach(s=>s.classList.remove('active'));const target=$(`#${name.endsWith('Screen')?name:name+'Screen'}`);if(target)target.classList.add('active');if(name==='home'||name==='homeScreen')startMenuMusic();}
function showToast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>el.classList.remove('show'),2100);}
function setTeamUI(){const h=teamData[homeTeam],a=teamData[awayTeam];$('#homeTeamName').textContent=h.name;$('#homeCrest').textContent=h.crest;$('#kitLabel').textContent=h.kit;$('#awayTeamName').textContent=a.name;$('#awayCrest').textContent=a.crest;$('.blue-kit .shirt').style.background=`linear-gradient(90deg,#${h.colors[1].toString(16)},#${h.colors[0].toString(16)},#${h.colors[1].toString(16)})`;$('.red-kit .shirt').style.background=`linear-gradient(90deg,#${a.colors[1].toString(16)},#${a.colors[0].toString(16)},#${a.colors[1].toString(16)})`;if(scene){homePlayers.forEach(p=>scene.remove(p.root));awayPlayers.forEach(p=>scene.remove(p.root));homePlayers=Array.from({length:3},(_,i)=>createPlayer(true,i));awayPlayers=Array.from({length:3},(_,i)=>createPlayer(false,i));resetKickoff();}}
function playSound(type){if(!sfxOn)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const now=audioCtx.currentTime;const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.connect(gain);gain.connect(audioCtx.destination);if(type==='whistle'){osc.type='sine';osc.frequency.setValueAtTime(1900,now);osc.frequency.exponentialRampToValueAtTime(1400,now+.42);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.09,now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+.48);osc.start(now);osc.stop(now+.5);}else if(type==='goal'){osc.type='sawtooth';osc.frequency.setValueAtTime(390,now);osc.frequency.exponentialRampToValueAtTime(780,now+.24);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.11,now+.04);gain.gain.exponentialRampToValueAtTime(.0001,now+.8);osc.start(now);osc.stop(now+.82);}else{osc.type='triangle';osc.frequency.setValueAtTime(type==='kick'?125:260,now);gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.11);osc.start(now);osc.stop(now+.12);}}catch(e){}}
function startMenuMusic(){if(!musicOn||musicTimer)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const notes=[110,164.81,196,146.83,220,164.81];let i=0;musicTimer=setInterval(()=>{if(!musicOn||!audioCtx)return;const now=audioCtx.currentTime;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.value=notes[i++%notes.length];g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.018,now+.04);g.gain.exponentialRampToValueAtTime(.0001,now+.38);o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+.4);},390);}catch(e){}}
function stopMenuMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}}
function initUI(){
 $$('[data-screen]').forEach(btn=>btn.addEventListener('click',()=>showScreen(btn.dataset.screen)));
 $('#brandHome').addEventListener('click',()=>showScreen('homeScreen'));
 $('#startMatch').addEventListener('click',()=>{stopMenuMusic();setTeamUI();startGame();});
 $('#changeHome').addEventListener('click',()=>{homeTeam=(homeTeam+1)%teamData.length;if(homeTeam===awayTeam)homeTeam=(homeTeam+1)%teamData.length;setTeamUI();playSound('kick');});
 $('#changeAway').addEventListener('click',()=>{awayTeam=(awayTeam+1)%teamData.length;if(awayTeam===homeTeam)awayTeam=(awayTeam+1)%teamData.length;setTeamUI();playSound('kick');});
 $('#pauseBtn').addEventListener('click',()=>{paused=true;$('#pauseOverlay').classList.add('open');});$('#resumeMatch').addEventListener('click',()=>{paused=false;$('#pauseOverlay').classList.remove('open');});$('#quitMatch').addEventListener('click',()=>{$('#pauseOverlay').classList.remove('open');showScreen('homeScreen');});
 $('#rematchBtn').addEventListener('click',startGame);
 $('#formationBtn').addEventListener('click',()=>{formation=(formation+1)%3;const labels=['4—3—3 OFFENSIVO','4—4—2 EQUILIBRATO','3—5—2 PRESSING'];$('.formation-label').textContent=labels[formation];showToast(`MODULO AGGIORNATO: ${labels[formation]}`);});
 $$('.bid-btn').forEach(b=>b.addEventListener('click',()=>showToast('OFFERTA INVIATA AL CLUB')));
 $$('.toggle').forEach((t,i)=>t.addEventListener('click',()=>{t.classList.toggle('on');if(i===3){musicOn=t.classList.contains('on');musicOn?startMenuMusic():stopMenuMusic();}if(i===4)sfxOn=t.classList.contains('on');}));
 $('#openPack').addEventListener('click',()=>openPack());
 $$('.shop-item .buy-btn').forEach((button,index)=>{if(index===3)return;button.addEventListener('click',()=>{const offers=[{cost:2500,count:5},{cost:1800,count:3},{cost:900,count:11}];const offer=offers[index];if(coins<offer.cost){showToast('CREDITI INSUFFICIENTI');return;}showScreen('ultimateScreen');setTimeout(()=>openPack(offer.cost,offer.count),180);});});
 let dailyClaimed=false;$('#dailyDrop').addEventListener('click',()=>{if(dailyClaimed){showToast('DAILY DROP GIÀ RISCATTATO');return;}dailyClaimed=true;coins+=300;updateCoins();$('#dailyDrop').textContent='RISCATTATO ✓';$('#dailyDrop').disabled=true;showToast('DAILY DROP RISCATTATO: +300 CREDITI');playSound('goal');});
 $$('.nav-tile').forEach(tile=>tile.addEventListener('mouseenter',()=>{$$('.nav-tile').forEach(t=>t.classList.remove('selected'));tile.classList.add('selected');}));
 $('#shootBtn').addEventListener('pointerdown',e=>{e.preventDefault();charging=true;charge=.1;playSound('kick');});window.addEventListener('pointerup',()=>{if(charging){shoot();}});
 $('#passBtn').addEventListener('pointerdown',e=>{e.preventDefault();passBall();});$('#sprintBtn').addEventListener('pointerdown',e=>{e.preventDefault();sprint=true;});for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('#sprintBtn').addEventListener(ev,()=>sprint=false);
 const base=$('#joyBase'),stick=$('#joyStick');let joyPointer=null;
 base.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;base.setPointerCapture(joyPointer);updateJoy(e);});base.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)updateJoy(e);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])base.addEventListener(ev,()=>{joyPointer=null;joy={x:0,y:0};stick.style.transform='translate(0px,0px)';});
 function updateJoy(e){const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.34,d=Math.hypot(dx,dy),scale=d>max?max/d:1;const x=dx*scale,y=dy*scale;stick.style.transform=`translate(${x}px,${y}px)`;joy={x:x/max,y:y/max};}
 window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key===' '&&!charging){charging=true;charge=.08;}});window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key===' '&&charging)shoot();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)paused=true;});
 startMenuMusic();
}
function shoot(){if(!charging)return;charging=false;$('#powerIndicator').style.display='none';$('#powerFill').style.width='0%';const p=homePlayers[selectedPlayer];if(ballOwner===p){const power=Math.max(.24,charge);kickBall(p,false,power);showToast(power>.68?'TIRO POTENTE!':'TIRO!');}else if(p.root.position.distanceTo(ball.position)<2.1){ballOwner=p;kickBall(p,false,Math.max(.25,charge));}else{showToast('AVVICINATI AL PALLONE');}charge=0;}
function passBall(){const p=homePlayers[selectedPlayer];if(ballOwner!==p){if(!ballOwner&&p.root.position.distanceTo(ball.position)<2.1)ballOwner=p;else{showToast('AVVICINATI AL PALLONE');return;}}const options=homePlayers.filter(q=>q!==p);options.sort((a,b)=>a.root.position.distanceTo(p.root.position)-b.root.position.distanceTo(p.root.position));const target=options[0],dir=new THREE.Vector3(target.root.position.x-p.root.position.x,0,target.root.position.z-p.root.position.z).normalize();ballOwner=null;ball.position.set(p.root.position.x+dir.x*.65,.3,p.root.position.z+dir.z*.65);ballVelocity.copy(dir).multiplyScalar(9.2);playSound('kick');showToast('PASSAGGIO!');}
const packPlayers=[['A. MORETTI','ST',88,'card-gold','portrait-one'],['L. SANTORO','CM',84,'card-silver','portrait-two'],['J. COSTA','DC',82,'card-blue','portrait-three'],['M. VILLA','RW',86,'card-gold','portrait-two'],['D. ROMANO','GK',81,'card-blue','portrait-one'],['F. CONTI','CDM',83,'card-silver','portrait-three'],['R. BIANCHI','LW',87,'card-gold','portrait-one'],['G. SERRA','CB',80,'card-blue','portrait-two']];
let packBusy=false,ownedCards=27;
function updateCoins(){const value=coins.toLocaleString('en-US');$('#coinCount').textContent=value;$$('.club-coins').forEach(el=>el.innerHTML=`✦ &nbsp;${value}`);}
function addPlayerCard(data){const [name,pos,rating,rarity,portrait]=data,card=document.createElement('div');card.className=`player-card ${rarity} new-card`;card.innerHTML=`<div class="card-rating">${rating}<small>${pos}</small></div><div class="card-glow">✦</div><div class="card-portrait ${portrait}">⚽</div><div class="card-flag">✦</div><div class="card-info"><b>${name}</b><span>NUOVO • ${pos}</span><div>${78+Math.floor(Math.random()*19)} PAC &nbsp; ${70+Math.floor(Math.random()*25)} TIR<br>${75+Math.floor(Math.random()*20)} PAS &nbsp; ${74+Math.floor(Math.random()*22)} DRI</div></div>`;card.title=`${name} • ${rating} OVR`;card.addEventListener('click',()=>showToast(`${name} • ${rating} OVR • ${pos}`));$('#playerCards').append(card);}
function openPack(cost=1000,count=3){if(packBusy)return;if(coins<cost){showToast('CREDITI INSUFFICIENTI');return;}coins-=cost;updateCoins();packBusy=true;const box=$('#packBox'),button=$('#openPack');box.classList.add('opening');button.disabled=true;playSound('goal');showToast('IL PACCHETTO SI STA APRIENDO…');setTimeout(()=>{const players=Array.from({length:count},()=>packPlayers[Math.floor(Math.random()*packPlayers.length)]);players.forEach(addPlayerCard);ownedCards+=players.length;const label=$('.collection-header h3 span');if(label)label.textContent=ownedCards;$('#playerCards').scrollTo({left:$('#playerCards').scrollWidth,behavior:'smooth'});box.classList.remove('opening');button.disabled=false;packBusy=false;showToast(`${players.length} NUOVI GIOCATORI AGGIUNTI!`);},950);}

init3D();
initUI();
setTeamUI();
updateCoins();
