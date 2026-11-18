import {CAP,label} from './math.mjs';
import {relics} from './relics.mjs';

const damageThresholds=[100n,10000n,10n**8n,10n**12n,10n**20n,10n**40n,CAP+1n];
export function magnitude([n,d]) {
  const abs=n<0n?-n:n;
  return damageThresholds.filter(value=>abs>=value*d).length;
}
function divisorRelic(step) {
  if(!step.card.enemy||step.card.kind!=='div') return null;
  if(!step.op) return 'key';
  return step.op.kind==='mul'?'prism':null;
}
export function relicActivations(result) {
  const ids=new Set();
  for(const step of result.steps) {
    const id=divisorRelic(step);
    if(id) ids.add(id);
  }
  for(const trigger of result.triggers) ids.add(trigger.id);
  return ids;
}
export function boardRelicStates(owned,preview,lastBurst) {
  const ready=relicActivations(preview);
  const fired=lastBurst?relicActivations(lastBurst):new Set();
  return owned.flatMap(id=>{
    const relic=relics[id];
    if(!relic) return [];
    const fixed=!relic.effect&&id!=='key'&&id!=='prism';
    return fixed||ready.has(id)||fired.has(id)?
      [{id,fixed,ready:ready.has(id),fired:fired.has(id)}]:[];
  });
}
export function timeline(result,armor) {
  let combo=0;
  const steps=result.steps.map((step,index)=>{
    if(!step.card.enemy && step.op) combo++;
    const type=step.card.enemy?'enemy':step.op?'card':'enemy';
    const operation=step.op?label(step.op):label(step.card)+' 無効';
    const relic=divisorRelic(step);
    const name=relic?relics[relic].name+' · '+operation:operation;
    return {index,type:relic?'relic':type,name,value:step.result,combo,...(relic?{relic}:{})};
  });
  for(const trigger of result.triggers) {
    steps.push({type:'relic',name:relics[trigger.id].name+' · '+label(trigger.op),value:trigger.result,combo,relic:trigger.id});
  }
  steps.push({type:'impact',name:armor>1?'装甲 ÷'+armor+' · ダメージ確定':'ダメージ確定',value:[result.final,1n],combo});
  return steps;
}
// For exact integer endpoints of a similar order, interpolate with integer arithmetic.
export function reelValue([from,fd],[to,td],tick,samples=12) {
  if(tick>=samples) return [to,td];
  if(tick<=0) return [from,fd];
  if(fd!==1n||td!==1n||from<0n||to<0n) return [from,fd];
  const delta=to-from;
  const digits=to.toString().length-from.toString().length;
  if(delta>0n&&digits>=3) {
    const shift=Math.ceil((digits+1)*(samples-tick)/samples);
    const candidate=to/10n**BigInt(shift);
    return [candidate>from?candidate:from,1n];
  }
  return [from+delta*BigInt(tick)/BigInt(samples),1n];
}

export function burstVisual(value,infinity=false) {
  const [n,d]=value;
  const digits=((n<0n?-n:n)/d).toString().length;
  return {
    digits,
    hue:infinity?174:(43+(digits-1)*39)%360,
    level:infinity?7:Math.min(6,magnitude(value))
  };
}

export function reelTiming(from,to,kind,fast) {
  const change=Math.max(0,burstVisual(to).digits-burstVisual(from).digits);
  const samples=Math.min(74,Math.max(12,change+2));
  const base=kind==='impact'?245:kind==='relic'?335:240;
  return {samples,duration:fast?Math.min(460,105+change*6):Math.min(1630,base+change*21)};
}

export function impactForce({final,impact}) {
  if(impact.kind==='miss') return 'none';
  if(impact.kind==='barrier') return 'ward';
  if(impact.kind==='gate') return 'break';
  const level=magnitude([final,1n]);
  if(level===7) return 'infinity';
  return level>=3?'great':'standard';
}
