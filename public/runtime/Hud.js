/* HUD production subsystem. Owns DOM state and menu input; FrontEndDirector owns the camera. */
var Ku=new H,$=e=>document.getElementById(e),qu=e=>{let t=Math.floor(e)%24,n=Math.floor((e-Math.floor(e))*60);return`${String(t).padStart(2,`0`)}:${String(n).padStart(2,`0`)}`},Ju=e=>e>=19.4||e<5.6?`🌙`:e>=17.2||e<7.2?`🌇`:`☀️`;globalThis.Yu=class{constructor(e){this.game=e,this.root=$(`hud`),this.overheadLayer=$(`overheads`),this.floaterLayer=$(`floaters`),this.overheads=new Map,this.boxBars=new Map,this.edgeThreats=new Map,this.floaters=[];for(let e=0;e<36;e++){let e=document.createElement(`div`);e.className=`floater`,e.hidden=!0,this.floaterLayer.appendChild(e),this.floaters.push({el:e,life:0,x:0,y:0,z:0,drift:0})}this.floaterCursor=0,this.bannerT=0,this.hurt=0,this.damageDirT=0,this.damageDirStrength=0,this.damageDir=document.createElement(`div`),this.damageDir.className=`damage-dir`,this.damageDir.textContent=`▲`,this.damageDir.hidden=!0,this.overheadLayer.appendChild(this.damageDir),this.projectileThreat=document.createElement(`div`),this.projectileThreat.className=`projectile-threat`,this.projectileThreat.textContent=`➤`,this.projectileThreat.hidden=!0,this.overheadLayer.appendChild(this.projectileThreat),this.selected=`volt`,this.lastLeft=-1,this.lastClock=``,this.lastSuper=-1,this.statsT=0,this.frames=0,this.fps=0,this.touch=!1,this.stickEls={move:$(`stick-move`),aim:$(`stick-aim`)},this.buildMenu(),this.buildSettings()}setTouchMode(e){this.touch=e,document.body.classList.toggle(`touch`,e),this.lastSuper=-1}updateSticks(){if(!this.touch)return;let e=this.game.input.sticks,t=window.innerWidth,n=window.innerHeight,r={move:[Math.max(96,t*.14),n-118],aim:[t-Math.max(104,t*.13),n-128]};for(let t of[`move`,`aim`]){let n=e[t],i=this.stickEls[t];if(!i)continue;let a=n.id!==null,o=a?n.ox:r[t][0],s=a?n.oy:r[t][1];i.style.transform=`translate3d(${o.toFixed(1)}px, ${s.toFixed(1)}px, 0)`,i.classList.toggle(`on`,a),i.firstElementChild.style.transform=`translate(${(n.x*58).toFixed(1)}px, ${(n.y*58).toFixed(1)}px)`}}buildMenu() {
  this.menu = $('menu');
  this.menuKeys = new Set();
  for (const id of RUNNER_IDS) {
    const runner = Bc[id];
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'runner-tile';
    tile.dataset.id = id;
    tile.setAttribute('aria-label', `${runner.name}, ${runner.role}`);
    tile.style.setProperty('--tile-body', '#' + runner.palette.body.toString(16).padStart(6, '0'));
    tile.style.setProperty('--tile-accent', '#' + runner.palette.accent.toString(16).padStart(6, '0'));
    tile.innerHTML = `<span class="runner-marker" aria-hidden="true">P1</span>
      <span class="runner-portrait"><img src="./${id}-portrait.png" alt="" draggable="false" /></span>
      <strong>${runner.name}</strong>`;
    tile.addEventListener('click', () => this.chooseRunner(id));
    $('cards').appendChild(tile);
  }
  // Capture before gameplay input, including when a tile or Start has focus.
  window.addEventListener('keydown', event => this.handleMenuKey(event), true);
  window.addEventListener('keyup', event => {
    const key = event.code || event.key;
    if (!this.menuKeys.delete(key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener('blur', () => this.menuKeys.clear());
  $('play').addEventListener('click', () => this.confirmRunner());
  $('again').addEventListener('click', () => this.game.startMatch(this.selected));
  $('to-menu').addEventListener('click', () => this.game.toMenu());
  this.select(this.selected);
}
menuIsActive() {
  return this.game.state === 'menu' && this.menu.classList.contains('open') && !$('settings').classList.contains('open');
}
handleMenuKey(event) {
  const key = event.code || event.key;
  // A held confirmation key must not become gameplay input after the transition.
  if (this.menuKeys.has(key)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (!this.menuIsActive()) return;
  const columns = window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches ? 2 : 4;
  const action = menuKeyAction(event, columns);
  if (!action) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  this.menuKeys.add(key);
  if (event.repeat) return;
  if (action.start) this.confirmRunner();
  else this.chooseRunner(nextRunnerId(this.selected, action.step));
}
chooseRunner(id) {
  if (!this.menuIsActive()) return;
  this.game.audio.unlock();
  if (id === this.selected) return;
  this.game.audio.play('click');
  this.select(id);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    this.selectionAnimation?.cancel();
    const tile = $('cards').querySelector('[aria-pressed="true"]');
    this.selectionAnimation = tile.animate([
      { transform: 'translateY(-6px) scale(1.06)', filter: 'brightness(1.55)' },
      { transform: 'translateY(-6px) scale(1.06)', filter: 'brightness(1)' },
    ], { duration: 230, easing: 'ease-out' });
  }
}
confirmRunner() {
  if (this.menuIsActive()) this.game.startMatch(this.selected);
}
renderSelection(runner) {
  if (!runner) return;
  const body = '#' + runner.palette.body.toString(16).padStart(6, '0');
  const accent = '#' + runner.palette.accent.toString(16).padStart(6, '0');
  this.menu.dataset.runner = runner.id;
  this.menu.dataset.selectedIndex = selectedRunnerIndex(runner.id);
  document.documentElement.style.setProperty('--runner-body', body);
  document.documentElement.style.setProperty('--runner-accent', accent);
  $('hero-name').textContent = runner.name;
  $('hero-role').textContent = runner.role;
  $('hero-blurb').textContent = runner.blurb;
  for (const stat of runnerStats(runner.id)) {
    const bar = $('hero-' + stat.id);
    bar.style.setProperty('--value', Math.round(stat.value / stat.max * 100) + '%');
    bar.parentElement.setAttribute('aria-label', stat.label);
    bar.parentElement.title = stat.label;
  }
}
select(id) {
  if (!Bc[id]) return;
  this.selected = id;
  document.querySelectorAll('#cards .runner-tile').forEach(tile => {
    tile.setAttribute('aria-pressed', String(tile.dataset.id === id));
  });
  this.renderSelection(Bc[id]);
  this.game.presentation?.select(id);
}
showMenu(visible) {
  this.menu.classList.toggle('open', visible);
  if (visible) {
    $('result').classList.remove('open');
    this.renderSelection(Bc[this.selected]);
  }
  this.root.classList.toggle('hidden', visible);
}
showResult(e,t,n,r,i){let a=$(`result`),o=$(`result-title`);o.textContent=e?`GRID SECURED`:t<=3?`SIGNAL LOST`:`DISCONNECTED`,o.classList.toggle(`lose`,!e),a.classList.toggle(`win`,e),a.classList.toggle(`lose`,!e),$(`result-kicker`).textContent=e?`ARENA CLEARED`:`RUN TERMINATED`,$(`result-rank`).textContent=`RANK #${t} of ${n}`,$(`result-stats`).innerHTML=`<span>${r} elimination${r===1?``:`s`}</span><span>${i} core${i===1?``:`s`}</span>`,a.classList.add(`open`),this.game.presentation?.showResult(e)}hideResult(){$(`result`).classList.remove(`open`,`win`,`lose`),this.game.presentation?.hideResult()}buildSettings(){let e=this.game,t=$(`settings`);$(`gear`).addEventListener(`click`,()=>t.classList.toggle(`open`));let n=$(`quality-seg`);for(let[t,r]of Object.entries(Uc)){let i=document.createElement(`button`);i.textContent=r.label,i.dataset.q=t,i.addEventListener(`click`,()=>e.setQuality(t,!0)),n.appendChild(i)}let r=$(`difficulty-seg`);for(let[t,n]of Object.entries(Hc)){let i=document.createElement(`button`);i.textContent=n.label,i.dataset.d=t,i.addEventListener(`click`,()=>e.setDifficulty(t)),r.appendChild(i)}$(`auto-time`).addEventListener(`change`,t=>e.setAutoTime(t.target.checked)),$(`time-slider`).addEventListener(`input`,t=>{e.setAutoTime(!1),e.lighting.setTime(parseFloat(t.target.value))}),$(`tog-ao`).addEventListener(`change`,t=>e.setToggle(`ao`,t.target.checked)),$(`tog-bloom`).addEventListener(`change`,t=>e.setToggle(`bloom`,t.target.checked)),$(`tog-mute`).addEventListener(`change`,t=>e.setMuted(t.target.checked))}syncSettings(){let e=this.game;document.querySelectorAll(`#quality-seg button`).forEach(t=>t.classList.toggle(`on`,t.dataset.q===e.pipeline.qualityName)),document.querySelectorAll(`#difficulty-seg button`).forEach(t=>t.classList.toggle(`on`,t.dataset.d===e.difficultyName)),$(`auto-time`).checked=e.autoTime,$(`tog-ao`).checked=e.pipeline.toggles.ao,$(`tog-ao`).disabled=!e.pipeline.quality.ao,$(`tog-bloom`).checked=e.pipeline.toggles.bloom,$(`tog-mute`).checked=e.audio.muted}toast(e){let t=$(`toast`);t.textContent=e,t.classList.add(`show`),clearTimeout(this.toastTimer),this.toastTimer=setTimeout(()=>t.classList.remove(`show`),3200)}reset(){for(let e of this.overheads.values())e.root.remove();this.overheads.clear();for(let e of this.edgeThreats.values())e.remove();this.edgeThreats.clear(),this.damageDirT=0,this.damageDirStrength=0,this.damageDir.hidden=!0;for(let e of this.boxBars.values())e.root.remove();this.boxBars.clear();for(let e of this.floaters)e.life=0,e.el.hidden=!0;$(`feed`).innerHTML=``,this.lastLeft=-1,this.hideResult()}addBrawler(e){let t=document.createElement(`div`);t.className=`oh`+(e.isPlayer?` me`:``),t.innerHTML=`<div class="oh-name"><span class="n"></span><span class="oh-cubes"></span></div>
      <div class="oh-bar"><div class="oh-fill"></div><span class="oh-hp"></span></div>
      ${e.isPlayer?`<div class="oh-ammo"><i><b></b></i><i><b></b></i><i><b></b></i></div>`:``}`,t.querySelector(`.n`).textContent=e.name,this.overheadLayer.appendChild(t),this.overheads.set(e.id,{root:t,fill:t.querySelector(`.oh-fill`),hp:t.querySelector(`.oh-hp`),cubes:t.querySelector(`.oh-cubes`),ammo:[...t.querySelectorAll(`.oh-ammo b`)],lastHp:-1,lastMax:-1,lastCubes:-1,lastAmmo:[-1,-1,-1],shown:!0}),e.isPlayer||(()=>{let t=document.createElement(`div`);t.className=`edge-threat`,t.textContent=`▲`,t.hidden=!0,this.overheadLayer.appendChild(t),this.edgeThreats.set(e.id,t)})()}floatText(e,t,n,r,i){let a=this.floaters[this.floaterCursor];this.floaterCursor=(this.floaterCursor+1)%this.floaters.length,a.life=.85,a.x=e+(Math.random()-.5)*.5,a.y=t,a.z=n,a.drift=(Math.random()-.5)*30,a.el.textContent=r,a.el.className=`floater `+i,a.el.hidden=!1}feed(e){let t=$(`feed`),n=document.createElement(`div`);for(n.innerHTML=e,t.appendChild(n);t.children.length>3;)t.firstChild.remove();setTimeout(()=>n.remove(),4e3)}banner(e,t=1,n=!1){let r=$(`banner`);r.textContent=e,r.classList.toggle(`small`,n),r.classList.add(`show`),this.bannerT=t}flashHurt(e,t){if(this.hurt=$c(this.hurt+e/1400,.35,1),!t||!this.game.player)return;let n={},r={},i=this.game.player;this.project(i.x,1.05,i.z,n),this.project(t.x,1.05,t.z,r);let a=r.x-n.x,o=r.y-n.y,s=Math.hypot(a,o)||1,strength=$c(e/1800,0,1),c=n.x+a/s*(54+18*strength),l=n.y+o/s*(54+18*strength),u=Math.atan2(o,a)*180/Math.PI+90;this.damageDirT=.42+.18*strength,this.damageDirStrength=$c(.45+e/1500,.5,1),this.damageDir.hidden=!1,this.damageDir.style.transform=`translate3d(${c.toFixed(1)}px, ${l.toFixed(1)}px, 0) rotate(${u.toFixed(1)}deg)`,this.damageDir.style.opacity=String(this.damageDirStrength)}project(e,t,n,r){return Ku.set(e,t,n).project(this.game.camera),r.x=(Ku.x*.5+.5)*window.innerWidth,r.y=(-Ku.y*.5+.5)*window.innerHeight,r.nx=Ku.x,r.ny=Ku.y,r.on=Ku.z<1&&Math.abs(Ku.x)<1.15&&Math.abs(Ku.y)<1.2,r}update(e){let t=this.game,n={};for(let e of t.brawlers){let t=this.overheads.get(e.id);if(!t)continue;let r=e.alive&&e.root.visible,i=r?this.project(e.x,e.root.position.y+1.72,e.z,n):null,a=r&&i.on,p=this.edgeThreats.get(e.id);if(p){let o=this.game.player,s=o&&o.alive?sl(e.x,e.z,o.x,o.z):1/0,c=e.threatCue||0,superThreat=e.anticipationSuper||e.superReady&&s<8,intent=e.intentKind||e.def.attack.kind,l=r&&!a&&(s<11.5||c>.08||superThreat);p.classList.toggle(`super`,!!superThreat),p.classList.toggle(`lob`,intent===`lob`),p.classList.toggle(`melee`,intent===`melee`||intent===`leap`),p.textContent=superThreat?`◆`:intent===`lob`?`●`:intent===`melee`||intent===`leap`?`▲`:`▴`;if(p.hidden=!l,l){let e=window.innerWidth,t=window.innerHeight,n=i.x-e*.5,r=i.y-t*.5,a=Math.min((e*.5-30)/(Math.abs(n)||1),(t*.5-54)/(Math.abs(r)||1),1),o=e*.5+n*a,d=t*.5+r*a,c=Math.atan2(r,n)*180/Math.PI+90;p.style.transform=`translate3d(${o.toFixed(1)}px, ${d.toFixed(1)}px, 0) rotate(${c.toFixed(1)}deg)`,p.style.opacity=$c(.28+.42*$c(1-s/13,0,1)+c*.5,.28,1).toFixed(2)}}if(a!==t.shown&&(t.root.hidden=!a,t.shown=a),!a)continue;t.root.style.transform=`translate3d(${i.x.toFixed(1)}px, ${(i.y-44).toFixed(1)}px, 0)`;let hudAlpha=1;if(e.isPlayer){let hpRatio=e.hp/e.maxHp,critical=hpRatio<.3,threatened=this.game.threatFocus>.36,reloading=e.ammo<3,engaged=this.game.elapsed-e.lastCombat<2.2;t.root.classList.toggle(`critical`,critical),t.root.classList.toggle(`threatened`,threatened),t.root.classList.toggle(`reloading`,reloading),t.root.classList.toggle(`super-ready`,e.superReady),hudAlpha=$c(.5+(engaged?.2:0)+(critical?.2:0)+(threatened?.14:0),.5,1)}else{let p=this.game.player,near=p&&p.alive?$c(1-sl(e.x,e.z,p.x,p.z)/12,0,1):0,engaged=this.game.elapsed-e.lastCombat<2?1:0;hudAlpha=.22+near*.3+engaged*.22+(e.threatCue||0)*.48}t.root.style.opacity=hudAlpha.toFixed(2);if(e.isPlayer)t.root.style.transform=`translate3d(${i.x.toFixed(1)}px, ${(i.y-46).toFixed(1)}px, 0) scale(${(1+.035*this.game.threatFocus).toFixed(3)})`;let o=Math.max(0,Math.ceil(e.hp));if((o!==t.lastHp||e.maxHp!==t.lastMax)&&(t.lastHp=o,t.lastMax=e.maxHp,t.fill.style.transform=`scaleX(${$c(o/e.maxHp,0,1).toFixed(3)})`,t.hp.textContent=o),e.cubes!==t.lastCubes&&(t.lastCubes=e.cubes,t.cubes.textContent=e.cubes>0?`⚡${e.cubes}`:``),e.isPlayer)for(let n=0;n<3;n++){let r=$c(e.ammo-n+(Math.floor(e.ammo)===n?e.reloadT:0),0,1),i=Math.round(r*40);i!==t.lastAmmo[n]&&(t.lastAmmo[n]=i,t.ammo[n].style.transform=`scaleX(${(i/40).toFixed(3)})`,t.ammo[n].style.opacity=r>=1?`1`:`0.55`)}}let player=t.player,bestThreat=null;if(player&&player.alive){for(let b of t.combat.bullets){if(!b.alive||b.owner===player||b.melee)continue;let dx=player.x-b.x,dz=player.z-b.z,along=dx*b.dx+dz*b.dz,cross=Math.abs(dx*b.dz-dz*b.dx),th=incomingProjectileThreat({along,cross,speed:b.speed,isSuper:b.isSuper});if(th&&(!bestThreat||th.priority>bestThreat.th.priority))bestThreat={b,th}}}if(bestThreat&&player){let pp={},tp={},dx=bestThreat.b.x-player.x,dz=bestThreat.b.z-player.z,dist=Math.hypot(dx,dz)||1;this.project(player.x,1.05,player.z,pp),this.project(player.x+dx/dist*2.2,1.05,player.z+dz/dist*2.2,tp);let sx=tp.x-pp.x,sy=tp.y-pp.y,len=Math.hypot(sx,sy)||1,px=pp.x+sx/len*58,py=pp.y+sy/len*58,ang=Math.atan2(sy,sx)*180/Math.PI;this.projectileThreat.hidden=!1,this.projectileThreat.classList.toggle(`super`,bestThreat.b.isSuper),this.projectileThreat.style.transform=`translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${ang.toFixed(1)}deg)`,this.projectileThreat.style.opacity=bestThreat.th.opacity.toFixed(2)}else this.projectileThreat.hidden=!0;for(let e of t.combat.boxes){let t=this.boxBars.get(e);if(!(e.alive&&e.hp<e.maxHp)){t&&(t.root.remove(),this.boxBars.delete(e));continue}if(!t){let n=document.createElement(`div`);n.className=`oh box`,n.innerHTML=`<div class="oh-bar"><div class="oh-fill"></div><span class="oh-hp"></span></div>`,this.overheadLayer.appendChild(n),t={root:n,fill:n.querySelector(`.oh-fill`),hp:n.querySelector(`.oh-hp`),last:-1},this.boxBars.set(e,t)}let r=this.project(e.x,1.35,e.z,n);t.root.hidden=!r.on,t.root.style.transform=`translate3d(${r.x.toFixed(1)}px, ${(r.y-20).toFixed(1)}px, 0)`;let p=this.game.player,near=p&&p.alive?$c(1-sl(e.x,e.z,p.x,p.z)/13,0,1):0;t.root.style.opacity=(.3+near*.7).toFixed(2);let i=Math.max(0,Math.ceil(e.hp));i!==t.last&&(t.last=i,t.fill.style.transform=`scaleX(${$c(i/e.maxHp,0,1).toFixed(3)})`,t.hp.textContent=i)}for(let t of this.floaters){if(t.life<=0)continue;if(t.life-=e,t.life<=0){t.el.hidden=!0;continue}let r=1-t.life/.85,i=this.project(t.x,t.y+r*.9,t.z,n),a=r<.15?.6+r/.15*.6:1.2-Math.min(1,(r-.15)*1.5)*.2;t.el.style.transform=`translate3d(${(i.x+t.drift*r).toFixed(1)}px, ${i.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${a.toFixed(2)})`,t.el.style.opacity=r>.7?((1-r)/.3).toFixed(2):`1`}let r=t.brawlers.reduce((e,t)=>e+ +!!t.alive,0);r!==this.lastLeft&&(this.lastLeft=r,$(`left-count`).innerHTML=`RUNNERS ONLINE <b>${r}</b>`),$(`left-count`).classList.toggle(`final`,r<=2&&r>0);let i=`${Ju(t.lighting.time)} ${qu(t.lighting.time)}`;i!==this.lastClock&&(this.lastClock=i,$(`clock`).textContent=i,$(`time-label`).textContent=qu(t.lighting.time),document.activeElement!==$(`time-slider`)&&($(`time-slider`).value=t.lighting.time));let a=t.player,o=a?Math.round(a.superCharge*100):0;if(o!==this.lastSuper){this.lastSuper=o;let e=$(`super`);e.style.setProperty(`--p`,o),e.classList.toggle(`ready`,o>=100),e.classList.toggle(`charging`,o>0&&o<100),$(`super-core`).textContent=o>=100?this.touch?`OVERDRIVE!`:`SPACE!`:`OVERDRIVE ${o}%`}let h=$(`hints`);h&&(h.style.opacity=t.state===`playing`?String(.14+.54*$c(1-t.matchTime/8,0,1)):`.68`),this.updateSticks(),this.bannerT>0&&(this.bannerT-=e,this.bannerT<=0&&$(`banner`).classList.remove(`show`)),this.hurt=Math.max(0,this.hurt-e*2.2);let lowHealth=a&&a.alive?$c((.32-a.hp/a.maxHp)/.22,0,1):0,criticalPulse=lowHealth*(.055+.045*(.5+.5*Math.sin(t.elapsed*6.5))),hurtOpacity=Math.max(this.hurt,criticalPulse);$(`hurt`).style.opacity=hurtOpacity.toFixed(2),this.damageDirT>0&&(this.damageDirT=Math.max(0,this.damageDirT-e),this.damageDir.style.opacity=(this.damageDirStrength*$c(this.damageDirT/.6,0,1)).toFixed(2),this.damageDirT<=0&&(this.damageDir.hidden=!0));let s=a&&a.alive&&t.gas.active&&t.gas.depthAt(a.x,a.z)>.35;if($(`gas-warn`).style.opacity=s?`1`:`0`,this.frames++,this.statsT+=e,this.statsT>=.5&&(this.fps=Math.round(this.frames/this.statsT),this.frames=0,this.statsT=0,$(`settings`).classList.contains(`open`))){let e={render:t.frameStats},n=t.lighting,r=n.lampSlots.filter(e=>e.intensity>.01).length,i=n.lampSlots.filter(e=>e.castShadow&&e.shadow.autoUpdate).length;$(`stats`).textContent=`${this.fps} fps   ${e.render.calls} draws   ${(e.render.triangles/1e3).toFixed(0)}k tris\nsun shadow ${n.mapSize}px over ${(n.shadowRadius*2).toFixed(0)}m  (${t.pipeline.usingPCSS?`PCSS`:`PCF`})\nlamps lit ${r}  casting ${i}   pool lights ${n.pool.filter(e=>e.intensity>0).length}/${n.pool.length}\n`+(t.userPickedQuality?`quality: your choice`:`quality: auto  (night frame ${t.perf.benchMs?t.perf.benchMs.toFixed(1):`?`} ms at startup)`)}}};
