import { createVoltModel, animateVolt } from './volt/model.js';
import { attackVolt, controlVoltDesktop, controlVoltTouch, updateVoltCharge, voltShotFeedback, reactToVolt, runFrame } from './volt/gameplay.js';
import { TILES as Z, SURFACES as Fc, RUNNER_RADIUS as Ic, RULES as Lc, LAMP as Rc, RUNNERS as Bc, classifyImpactSurface } from './game/config.js';
import { roleTactics, aiMood, tacticalPointScore, objectiveInterest } from './game/ai.js';
import { AudioSystem as Xu } from './systems/CombatAudio.js';
import { combatIntensity as presentationCombatIntensity, nearMissPresentation, duelCameraFrame, feedbackBands, movementPose, attackIntentPose, hitReactionPose, corePowerPresentation, destructionProfile, superScarProfile, arenaZoneProfile, contactShadowPresentation, incomingProjectileThreat, hazardPhase, runnerLocomotionProfile, damageWearPresentation, projectilePresentation, superBuildPresentation } from './presentation/combat.js';
import { FrontEndDirector } from './presentation/FrontEndDirector.js';
import './presentation/frontEnd.css';
import './volt/styles.css';


const productionDependencies = { createVoltModel, animateVolt, attackVolt, controlVoltDesktop, controlVoltTouch, updateVoltCharge, voltShotFeedback, reactToVolt, runFrame, Z, Fc, Ic, Lc, Rc, Bc, classifyImpactSurface, roleTactics, aiMood, tacticalPointScore, objectiveInterest, Xu, presentationCombatIntensity, nearMissPresentation, duelCameraFrame, feedbackBands, movementPose, attackIntentPose, hitReactionPose, corePowerPresentation, destructionProfile, superScarProfile, arenaZoneProfile, contactShadowPresentation, incomingProjectileThreat, hazardPhase, runnerLocomotionProfile, damageWearPresentation, projectilePresentation, superBuildPresentation, FrontEndDirector };
Object.assign(globalThis, productionDependencies);

const loadClassic = (relativePath) => new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = new URL(relativePath, import.meta.url).href;
  script.onload = resolve;
  script.onerror = () => reject(new Error(`Unable to load production subsystem: ${relativePath}`));
  document.head.appendChild(script);
});

await loadClassic('../runtime/kernel.js');
for (const subsystem of ["Renderer.js","Lighting.js","Arena.js","Runner.js","Combat.js","Effects.js","Void.js","AI.js","Input.js","Hud.js","Game.js"]) {
  await loadClassic(`../runtime/${subsystem}`);
}

;function ud(e){let t;try{t=new globalThis.ld(e||{})}catch(error){let panel=document.getElementById(`loading`);panel.textContent=`Unable to start 3D rendering. Enable hardware acceleration and reload.`;console.error(error);return;}window.__game=t;try{window.claude?.hot?.snapshot?.(()=>({selected:t.hud.selected}))}catch{}}var dd=window.claude?.hot;dd?.ready?dd.ready(ud):ud(dd?.data??{});
