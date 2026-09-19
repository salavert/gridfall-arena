import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ChargeTrigger, voltShot } from '../src/volt/weapon.js';
import { FixedClock } from '../src/volt/timing.js';
import { shootVolt, controlVoltDesktop, controlVoltTouch, updateVoltCharge, reactToVolt } from '../src/volt/gameplay.js';

// Load the actual production engine and its bundled Three classes, excluding
// only browser bootstrap. No second Three instance or alternate runner model.
let source = (await readFile(new URL('../index.html', import.meta.url),'utf8')).match(/<script type="module">([\s\S]*?)<\/script>/)[1];
source = source.slice(0,source.indexOf(';function ud('))+';export {fu,Vu,Bc,VOLT_GRAPHICS};';
source = source.replace(/from '(\.\/src\/volt\/[^']+)'/g,(_,p)=>`from '${new URL('../'+p,import.meta.url)}'`).replace(/import '\.\/src\/volt\/styles.css';/,'');
globalThis.window = { addEventListener(){}, devicePixelRatio:1 };
globalThis.document = { getElementById(){return null;} };
const { fu: Runner, Bc: roster, VOLT_GRAPHICS: G } = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(id='volt', isPlayer=true) {
  const bullets=[];
  const game={ state:'playing', elapsed:10, scene:new G.Group(),
    combat:{spawnBullet(...args){bullets.push(args);}},
    effects:{muzzle(){},flash(){},burst(){},footDust(){},leaves(){}},
    audio:{ctx:null,play(){}},shake(){},
    world:{resolveCircle(){},isBushAt(){return false;},hasLineOfSight(){return true;},isWalkable(){return true;},toTile(x){return Math.floor(x);}},
    gas:{active:false},
    input:{fire:false,firePressed:false,fireReleased:false,consumeSuperRelease(){return false;},axis(){return{x:0,z:0};},sticks:{aim:{id:null},super:{id:null}},takeShots(){return[];}},
    guide:{},guideSector:{scale:{set(){}},material:{color:{set(){}}}},updateGuide(){},
    autoAim(){return {dx:0,dz:1,x:0,z:6};},stickAim(){return {dx:0,dz:1,x:0,z:6};}
  };
  const player=new Runner(game,roster[id],{isPlayer,name:'test',x:0,z:0});
  game.player=player;game.brawlers=[player];return{game,player,bullets};
}
const aim={dx:0,dz:1,x:0,z:7};
test('production Volt fires five focused pellets for one ammo; cooldown prevents double fire',()=>{
  const{player,bullets}=fixture();
  assert.equal(shootVolt(player,aim,.85),true);assert.equal(player.ammo,2);assert.equal(bullets.length,5);
  assert.equal(bullets[0][5].damage,385);assert.ok(bullets.every(b=>b[5].range>9));
  assert.equal(shootVolt(player,aim,.85),false);assert.equal(bullets.length,5);
});
test('desktop press charges; release fires once; quick taps between simulation ticks survive',()=>{
  const{game,player,bullets}=fixture();game.input.fire=true;game.input.firePressed=true;
  for(let i=0;i<60;i++)controlVoltDesktop(game,1/60,aim);
  assert.equal(bullets.length,0);assert.equal(player.voltCharge,.85);
  game.input.fire=false;game.input.fireReleased=true;controlVoltDesktop(game,1/60,aim);controlVoltDesktop(game,1/60,aim);
  assert.equal(bullets.length,5);assert.equal(player.voltCharge,0);
  player.fireCooldown=0;game.input.firePressed=true;game.input.fireReleased=true;controlVoltDesktop(game,1/60,aim);
  assert.equal(bullets.length,10);assert.equal(bullets[5][5].charge,0);
});
test('focus loss cancels a charged shot and requires a fresh press',()=>{
  const{game,bullets}=fixture();game.input.fire=true;controlVoltDesktop(game,.6,aim);
  game.input.cancelSerial=1;controlVoltDesktop(game,.1,aim);
  game.input.fire=false;game.input.fireReleased=true;controlVoltDesktop(game,.1,aim);assert.equal(bullets.length,0);
  game.input.firePressed=true;game.input.fireReleased=true;controlVoltDesktop(game,.01,aim);assert.equal(bullets.length,5);
});
test('touch supports held aim and cancels a dragged-back gesture',()=>{
  const{game,player,bullets}=fixture();const stick=game.input.sticks.aim;stick.id=2;stick.moved=true;
  controlVoltTouch(game,.85);assert.equal(bullets.length,0);
  stick.id=null;game.input.takeShots=()=>[{kind:'attack',tap:false}];controlVoltTouch(game,.016);
  assert.equal(bullets.length,5);assert.equal(bullets[0][5].charge,1);
  player.fireCooldown=0;game.input.takeShots=()=>[];stick.id=3;controlVoltTouch(game,.8);
  stick.id=null;game.input.takeShots=()=>[{kind:'attack',cancelled:true}];controlVoltTouch(game,.016);
  assert.equal(bullets.length,5);assert.equal(player.voltCharge,0);
});
test('insufficient ammo, countdown and Overdrive cancel charging',()=>{
  for(const reason of ['ammo','countdown','super']){
    const{game,player,bullets}=fixture();game.input.fire=true;controlVoltDesktop(game,.5,aim);
    if(reason==='ammo')player.ammo=0;
    if(reason==='countdown')game.state='countdown';
    if(reason==='super'){player.superCharge=1;game.input.superHeld=true;}
    controlVoltDesktop(game,.1,aim);game.input.fire=false;game.input.fireReleased=true;controlVoltDesktop(game,.1,aim);
    assert.equal(bullets.length,0,reason);
  }
});
test('bots telegraph a distant charged shot and cancel it on death',()=>{
  const{game,player,bullets}=fixture('volt',false);
  assert.equal(player.attack(0,1,0,7),true);assert.equal(bullets.length,0);
  updateVoltCharge(player,.3);assert.ok(player.voltCharge>0);assert.equal(bullets.length,0);
  updateVoltCharge(player,1);assert.equal(bullets.length,5);assert.equal(player.lastCombat,game.elapsed);
  player.fireCooldown=0;player.attack(0,1,0,7);player.alive=false;updateVoltCharge(player,1);
  assert.equal(bullets.length,5);assert.equal(player.voltPlan,null);
});
test('bot dodge has reaction delay and respects visibility, walls and gas',()=>{
  const{game,player}=fixture();player.voltCharge=.8;player.aimAngle=0;
  const bot={id:100,alive:true,x:0,z:4,moveX:0,moveZ:0};
  const brain={b:bot,game,skill:.8,state:'fight',strafeDir:1};game.brawlers.push(bot);
  reactToVolt(brain,.05);assert.equal(bot.moveX,0);
  reactToVolt(brain,.3);assert.equal(Math.abs(bot.moveX),1);
  bot.moveX=0;player.hidden=true;reactToVolt(brain,1);assert.equal(bot.moveX,0);
  player.hidden=false;game.world.isWalkable=()=>false;reactToVolt(brain,1);assert.equal(bot.moveX,0);
  game.world.isWalkable=()=>true;game.gas={active:true,depthAt(){return 1;}};reactToVolt(brain,1);assert.equal(bot.moveX,0);
});
test('all four production kits construct and animate; Volt geometry is shared and bounded',()=>{
  for(const id of Object.keys(roster)){
    const{player}=fixture(id);player.update(1/60);player.root.updateMatrixWorld(true);assert.ok(player.model.root.children.length);
    player.dispose();
  }
  const a=fixture().player,b=fixture().player;const parts=[];a.root.traverse(o=>{if(o.isMesh&&o.castShadow)parts.push(o);});
  assert.ok(parts.length<=41);assert.ok(parts.reduce((n,p)=>n+(p.geometry.index?.count||p.geometry.attributes.position.count)/3,0)<7000);
  const other=[];b.root.traverse(o=>{if(o.isMesh&&o.castShadow)other.push(o);});
  assert.ok(parts.every((p,i)=>p.geometry===other[i].geometry));
  for(let i=0;i<600;i++){a.recoil=.5;a.animate(1/60,false);}
  assert.ok(Math.abs(a.model.arms[1].rotation.x)<2,'recoil must not accumulate rotation');
});
test('simulation time is consistent at 8, 30, 60 and 144 FPS; long suspension is discarded',()=>{
  for(const fps of [8,30,60,144]){
    const clock=new FixedClock();let seconds=0;
    for(let i=0;i<fps*10;i++)clock.advance(1/fps,dt=>{seconds+=dt;});
    assert.ok(Math.abs(seconds-10)<1e-8,`${fps} FPS: ${seconds}`);
    assert.equal(clock.advance(30,()=>assert.fail('suspended tab must not advance')),0);
  }
});
test('charge power clamps and paused held trigger cannot fire on resume',()=>{
  assert.equal(voltShot({},9).charge,1);assert.equal(voltShot({},-.1).charge,0);
  const t=new ChargeTrigger();t.step({down:true,allowed:true,dt:.6});t.cancel(true);
  assert.equal(t.step({down:false,released:true,allowed:true,dt:.01}),null);
});
