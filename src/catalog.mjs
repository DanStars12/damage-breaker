import {encounterCount,makeEnemy,attackPatterns,operationNames} from './enemies.mjs';
import {relics,relicRanks} from './relics.mjs';

// IDs use ACT, encounter type, and variant, never the changing display name or palette.
const kinds=['fight','elite','boss'];
export const enemyCatalog=Object.freeze([
  ...[1,2,3].flatMap(act=>kinds.flatMap(kind=>Array.from({length:encounterCount(act,kind)},(_,variant)=>{
    const enemy=makeEnemy(act,kind,variant,2,0n);
    return {id:act+':'+kind+':'+variant,act,kind,variant,
      name:enemy.name,art:enemy.art,detail:enemy.detail,
      moves:enemy.cycle,barrier:enemy.barrier,gates:enemy.gates.length,armor:enemy.armor};
  }))),
  (()=>{const enemy=makeEnemy(4,'extra',0,1,0n);
    return {id:'4:extra:0',act:4,kind:'extra',variant:0,
      name:enemy.name,art:enemy.art,detail:enemy.detail,
      moves:enemy.cycle,barrier:enemy.barrier,gates:enemy.gates.length,armor:enemy.armor};})()
]);
export const relicCatalog=Object.freeze(Object.keys(relics).map(id=>({
  id,name:relics[id].name,description:relics[id].desc,rank:relics[id].rank,
  rankName:relicRanks[relics[id].rank].name
})));
const enemyKeys=new Set(enemyCatalog.map(entry=>entry.id));
const relicKeys=new Set(relicCatalog.map(entry=>entry.id));
const uniqueAllowed=(values,allowed)=>[...new Set((Array.isArray(values)?values:[])
  .filter(id=>typeof id==='string'&&allowed.has(id)))];
export const enemyKey=(act,kind,variant=0)=>act+':'+kind+':'+variant;
export function normalizeCodex(raw) {
  const acquired=uniqueAllowed(raw?.acquired,relicKeys);
  return {enemies:uniqueAllowed(raw?.enemies,enemyKeys),
    relics:uniqueAllowed([...(Array.isArray(raw?.relics)?raw.relics:[]),...acquired],relicKeys),
    acquired};
}
export function discoverEnemy(codex,act,kind,variant=0) {
  const id=enemyKey(act,kind,variant);
  if(!enemyKeys.has(id)||codex.enemies.includes(id)) return false;
  codex.enemies.push(id);
  return true;
}
export function discoverRelics(codex,ids) {
  let changed=false;
  for(const id of uniqueAllowed(ids,relicKeys)) if(!codex.relics.includes(id)) {
    codex.relics.push(id);changed=true;
  }
  return changed;
}
// A seen offer unlocks its description; acquisition is tracked independently.
export function acquireRelics(codex,ids) {
  let changed=discoverRelics(codex,ids);
  for(const id of uniqueAllowed(ids,relicKeys)) if(!codex.acquired.includes(id)) {
    codex.acquired.push(id);changed=true;
  }
  return changed;
}
// Backfill only provable information from old saves; never unlock all past encounters.
export function inheritCodex(raw,history=[],run=null) {
  const codex=normalizeCodex(raw);
  for(const record of Array.isArray(history)?history:[]) acquireRelics(codex,record?.relics);
  if(run) {
    acquireRelics(codex,run.owned);
    if(run.phase==='reward'&&run.relicDecision==='pending')
      discoverRelics(codex,[run.relicDrop,run.relicAlternative]);
    if(run.phase==='facility') discoverRelics(codex,run.stockRelics);
    if(['battle','reward','loss'].includes(run.phase)&&run.enemy)
      discoverEnemy(codex,run.act,run.enemy.kind,run.enemy.variant??0);
    if(Array.isArray(run.visited)&&Array.isArray(run.map))
      for(const node of run.map.flat()) if(run.visited.includes(node.id)&&
        (kinds.includes(node.kind)||node.kind==='extra'))
        discoverEnemy(codex,run.act,node.kind,node.variant??0);
  }
  return codex;
}
const moveLabels={
  sub:'減算妨害',pct:'割合妨害',div:'除算妨害',wither:'最大HP減少',
  drain:'基礎値低下',lock:'演算封印',barrier:'バリア'
};
export function catalogMoveName(move) {
  const [kind,target]=move.split(':');
  return attackPatterns[kind]?.name??(kind==='lock'&&target?
    (operationNames[target]??'演算')+'封印':moveLabels[kind]??'演算妨害');
}
