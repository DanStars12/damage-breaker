import {Run} from '../src/run.mjs';
import {evaluate} from '../src/relics.mjs';
import {CAP,format} from '../src/math.mjs';

const strategies={
  grimoire:['grimoire','prism','tail','chain','star','order','short','key'],
  power:['prism','star','chain','short','tail','order','key','grimoire'],
  mixed:['mosaic','ratio','tail','order','short','chain','prism','star','key','grimoire'],
  additive:['sum','abacus','grimoire','tail','order','short','chain','key','prism']
};
const compare=(a,b)=>a.score>b.score?-1:a.score<b.score?1:0;
function plan(run) {
  const {board,hand,deb,owned,base,enemy,energy,slots}=run;
  const score=(board,deb)=>evaluate({base,board,deb,owned,armor:enemy.armor}).final;
  const first={board,deb,energy,used:0,moves:[],score:score(board,deb)};
  let beam=[first],best=first;
  for(let depth=0;depth<4;depth++) {
    const candidates=[];
    const seen=new Set();
    for(const s of beam) for(let i=0;i<hand.length;i++) {
      const c=hand[i];
      if((s.used&(1<<i))||c.cost>s.energy||c.kind==='ward') continue;
      const clean=c.kind==='clean';
      if(clean?!s.deb.length:s.board.length>=slots) continue;
      for(let at=0;at<=(clean?0:s.board.length);at++) {
        const b=clean?s.board:[...s.board.slice(0,at),c,...s.board.slice(at)];
        const d=clean?s.deb.slice(1):s.deb;
        const used=s.used|(1<<i);
        const key=used+':'+b.map(c=>c.kind+c.value).join(',')+':'+d.length;
        if(seen.has(key)) continue;
        seen.add(key);
        candidates.push({board:b,deb:d,used,energy:s.energy-c.cost,moves:[...s.moves,[c,at]],score:score(b,d)});
      }
    }
    beam=candidates.sort(compare).slice(0,6);
    if(!beam.length) break;
    if(beam[0].score>=best.score) best=beam[0];
  }
  for(const [c,at] of best.moves) run.play(run.hand.indexOf(c),at);
}
function preference(c,id) {
  const weight={pow:id==='power'?18:6,exp:13,mul:9,add:4,pct:3}[c.kind]||0;
  return c.tier*6+weight+(id==='additive'&&c.kind==='add'?24:0)+(id==='grimoire'&&String(c.value)[0]==='1'?11:0);
}
function play(seed,id) {
  const r=new Run(seed);
  const reached=new Set();
  let cleared=false;
  for(let guard=0;guard<500;guard++) {
    if(r.phase==='loss'||r.phase==='win') return {r,cleared,reached};
    if(r.phase==='clear') {cleared=true;r.extra();}
    if(r.phase==='reward') {
      if(r.relicDecision==='pending') r.chooseRelic(!['mantle','reserve'].includes(r.relicDrop));
      r.chooseGold(true);
      if(r.offers.length) r.takeCard(r.offers.indexOf([...r.offers].sort((a,b)=>preference(b,id)-preference(a,id))[0]));
      r.advance();continue;
    }
    if(r.phase==='map') {
      const nodes=r.map.flat().filter(n=>r.routes.includes(n.id));
      const soonBoss=nodes[0].row===r.map.length-2;
      const priorities=r.hp<65?['rest','event','shop','fight','elite']:
        r.gold>=55?['shop','elite','rest','fight','event']:['elite','rest','fight','event','shop'];
      if(soonBoss&&r.hp<85) priorities.unshift('rest');
      r.route((priorities.map(k=>nodes.find(n=>n.kind===k)).find(Boolean)||nodes[0]).id);
    }
    if(r.phase==='facility') {
      if(r.facility==='shop') {
        const ranked=r.stockRelics.map((key,i)=>[i,[...strategies[id],'furnace','tithe','codex','spring','rack','lattice'].indexOf(key)]).filter(([,rank])=>rank>=0).sort((a,b)=>a[1]-b[1]);
        r.service({action:'relic',i:ranked[0]?.[0]});
        const cards=r.shop.map((c,i)=>[i,preference(c,id)]).sort((a,b)=>b[1]-a[1]);
        for(const [i,rating] of cards) if(rating>=15) r.service({action:'buy',i});
        r.leaveNode();
      } else if(r.facility==='rest') {
        if(r.hp<83) r.service({action:'heal'});
        else {
          const options=r.deck.filter(c=>!c.upgraded&&['add','mul','pct'].includes(c.kind)).sort((a,b)=>preference(b,id)-preference(a,id));
          if(!r.service({action:'forge',i:r.deck.indexOf(options[0]),mode:'power'})) r.leaveNode();
        }
      } else if(!r.service({action:'event'})) r.service({action:'decline'});
      continue;
    }
    if(r.enemy.kind==='boss') reached.add(r.act);
    if(r.enemy.barrier&&r.preview().final>0n) {r.burst();continue;}
    plan(r);
    const p=r.preview();
    const survive=r.next.kind==='double'?r.hp>r.next.value*2:r.next.kind!=='attack'||r.hp>r.next.value;
    if(p.impact.kind!=='gate'&&p.final<r.enemy.hp&&r.holds<2&&survive&&r.board.length<r.slots) r.hold();
    else r.burst();
  }
  throw Error('Simulation exceeded turn budget for '+seed);
}
const total=Number(process.argv[2]||32);
const rows=[];
for(const id of Object.keys(strategies)) {
  const metric={policy:id,seeds:total,clear:0,extra:0,infinity:0,bossAttempts:[0,0,0],bossWins:[0,0,0],turns:0,used:{},relics:{}};
  let max=0n,bestSeed='';
  for(let i=0;i<total;i++) {
    const {r,cleared,reached}=play('db-'+i,id);
    for(const stage of reached) metric.bossAttempts[stage-1]++;
    for(let j=0;j<r.stats.bosses;j++) metric.bossWins[j]++;
    metric.clear+=Number(cleared);
    metric.extra+=Number(r.phase==='win');
    metric.infinity+=Number(r.stats.max>CAP);
    metric.turns+=r.stats.turns;
    for(const [k,n] of Object.entries(r.stats.usage)) metric.used[k]=(metric.used[k]||0)+n;
    for(const k of r.owned) metric.relics[k]=(metric.relics[k]||0)+1;
    if(r.stats.max>max) {max=r.stats.max;bestSeed=r.seed;}
  }
  metric.avgTurns=Number((metric.turns/total).toFixed(2));
  metric.max=format(max,true,false);metric.maxExact=String(max);metric.bestSeed=bestSeed;
  rows.push(metric);
}
console.log(JSON.stringify(rows,null,2));
