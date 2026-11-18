import {CAP,label} from './math.mjs';
import {relics} from './relics.mjs';

const damageThresholds=[100n,10000n,10n**8n,10n**12n,10n**20n,10n**40n,CAP+1n];
export function magnitude([n,d]) {
  const abs=n<0n?-n:n;
  return damageThresholds.filter(value=>abs>=value*d).length;
}
export function timeline(result,armor) {
  let combo=0;
  const steps=result.steps.map((step,index)=>{
    if(!step.card.enemy && step.op) combo++;
    const type=step.card.enemy?'enemy':step.op?'card':'enemy';
    const name=step.op?label(step.op):label(step.card)+' 無効';
    return {index,type,name,value:step.result,combo};
  });
  for(const trigger of result.triggers) {
    steps.push({type:'relic',name:relics[trigger.id].name+' · '+label(trigger.op),value:trigger.result,combo,relic:trigger.id});
  }
  steps.push({type:'impact',name:armor>1?'装甲 ÷'+armor+' · ダメージ確定':'ダメージ確定',value:[result.final,1n],combo});
  return steps;
}
// For exact integer endpoints of a similar order, interpolate with integer arithmetic.
export function reelValue([from,fd],[to,td],tick) {
  if(tick>=12) return [to,td];
  if(tick<=0) return [from,fd];
  if(fd!==1n||td!==1n||from<0n||to<0n) return [from,fd];
  const delta=to-from;
  if(delta<=0n) return [from+delta*BigInt(tick)/12n,1n];
  const digits=to.toString().length-from.toString().length;
  if(digits>=3) {
    const shift=Math.ceil(digits*(12-tick)/12);
    const candidate=to/10n**BigInt(shift);
    return [candidate>from?candidate:from,1n];
  }
  return [from+delta*BigInt(tick)/12n,1n];
}
