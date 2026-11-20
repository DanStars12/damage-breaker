import {supportValue,supportKinds,canEnchant,enchantmentFor} from '../src/cards.mjs';
import {attackHits} from '../src/enemies.mjs';
import {Run} from '../src/run.mjs';
import {evaluate,cleanseDebuffs} from '../src/relics.mjs';
import {CAP,format} from '../src/math.mjs';

const strategies={
  grimoire:['grimoire','prism','tail','chain','star','order','short','key'],
  power:['prism','star','chain','short','tail','order','key','grimoire'],
  mixed:['mosaic','ratio','tail','order','short','chain','prism','star','key','grimoire'],
  additive:['sum','abacus','grimoire','tail','order','short','chain','key','prism']
};
const muryotaisu=10n**68n;
const additionRelics=['sum','abacus'];
const hasAdditionRelic=r=>additionRelics.some(key=>r.owned.includes(key));
const compare=(a,b)=>a.score>b.score?-1:a.score<b.score?1:0;
function plan(run) {
  const {board,hand,deb,owned,base,enemy,energy,slots,holds}=run;
  const score=(board,deb)=>evaluate({base,board,deb,owned,armor:enemy.armor,holds}).final;
  const bits=hand.map((_,i)=>1n<<BigInt(i));
  const first={board,deb,energy,used:0n,moves:[],score:score(board,deb)};
  let beam=[first],best=first;
  for(let depth=0;depth<4;depth++) {
    const candidates=[];
    const seen=new Set();
    for(const s of beam) for(let i=0;i<hand.length;i++) {
      const c=hand[i];
      if((s.used&bits[i])!==0n||c.cost>s.energy||['ward','guard'].includes(c.kind)) continue;
      const clean=c.kind==='clean';
      if(clean?!s.deb.length:s.board.length>=slots) continue;
      for(let at=0;at<=(clean?0:s.board.length);at++) {
        const b=clean?s.board:[...s.board.slice(0,at),c,...s.board.slice(at)];
        const d=clean?cleanseDebuffs(s.deb,s.board.length,supportValue(c)):s.deb;
        const used=s.used|bits[i];
        const key=used.toString()+':'+b.map(c=>c.kind+c.value+(c.enchant??'')).join(',')+':'+d.length;
        if(seen.has(key)) continue;
        seen.add(key);
        candidates.push({board:b,deb:d,used,energy:s.energy-c.cost+(enchantmentFor(c)?.energy??0),moves:[...s.moves,[c,at]],score:score(b,d)});
      }
    }
    beam=candidates.sort(compare).slice(0,6);
    if(!beam.length) break;
    if(beam[0].score>=best.score) best=beam[0];
  }
  for(const [c,at] of best.moves) run.play(run.hand.indexOf(c),at);
}
function preference(c,id) {
  if(supportKinds.includes(c.kind)) return {clean:6,ward:7,guard:9}[c.kind]+c.tier*2;
  const weight={pow:id==='power'?18:6,exp:13,mul:9,add:4,pct:3}[c.kind]||0;
  return c.tier*6+weight+(id==='additive'&&c.kind==='add'?24:0)+(id==='grimoire'&&String(c.value)[0]==='1'?11:0);
}
function play(seed,id) {
  const r=new Run(seed);
  const reached=new Map();
  let cleared=false, clearedWithAdditionRelic=false, exchanges=0, exchangeVisits=0;
  let attenuations=0, enchantments=0;
  const enchantTarget=enchant=>{
    const candidates=r.deck.filter(c=>canEnchant(c,enchant));
    const affinity=c=>enchant==='repeat'?{add:0,mul:14,pct:11,exp:18,pow:30}[c.kind]:7-c.cost*3;
    return r.deck.indexOf(candidates.sort((a,b)=>affinity(b)-affinity(a)||preference(b,id)-preference(a,id))[0]);
  };
  const rank=key=>{
    if(!key||['mantle','reserve'].includes(key)) return Infinity;
    const i=strategies[id].indexOf(key);
    return i===-1?strategies[id].length:i;
  };
  const reach={numericBursts:0,infinityBursts:0,landedBursts:0,firstAct:null};
  const fire=()=>{
    const burst=r.burst();
    if(burst?.response.status==='success') attenuations++;
    if(!burst||burst.final<muryotaisu) return;
    reach.firstAct??=r.act;
    if(burst.final>CAP) reach.infinityBursts++;
    else reach.numericBursts++;
    // Effective BURST after defenses. HP removed itself is capped at the enemy's HP.
    if(burst.impact.dealt>0n) reach.landedBursts++;
  };
  for(let guard=0;guard<500;guard++) {
    if(r.phase==='loss'||r.phase==='win') return {r,cleared,clearedWithAdditionRelic,reached,reach,exchanges,exchangeVisits,attenuations,enchantments};
    if(r.phase==='clear') {
      cleared=true;
      clearedWithAdditionRelic=hasAdditionRelic(r);
      r.extra();
    }
    if(r.phase==='reward') {
      if(r.relicDecision==='pending') {
        const index=rank(r.relicAlternative)<rank(r.relicDrop)?1:0;
        const relic=[r.relicDrop,r.relicAlternative][index];
        const target=relic==='echoEngraver'?enchantTarget('repeat'):-1;
        if(r.chooseRelic(rank(relic)<Infinity,index,target)&&target>=0) enchantments++;
      }
      r.chooseGold(true);
      r.chooseOmen(true);
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
      } else if(r.event==='exchange') {
        exchangeVisits++;
        const offers=r.owned.flatMap(mode=>r.eventExchanges(mode).map((key,i)=>({mode,i,rank:rank(key)})))
          .filter(offer=>offer.rank<rank(offer.mode)).sort((a,b)=>a.rank-b.rank);
        const offer=offers[0];
        const j=offer&&r.eventExchanges(offer.mode)[offer.i]==='echoEngraver'?enchantTarget('repeat'):-1;
        if(offer&&r.service({action:'exchange',...offer,j})) {exchanges++;if(j>=0) enchantments++;}
        else r.service({action:'decline'});
      } else if(r.eventOffer?.enchant) {
        const i=r.eventOffers[1]?.available&&r.gold>=45?1:0;
        const j=enchantTarget(r.eventOffers[i].enchant);
        if(r.service({action:'event',i,j})) enchantments++;
        else r.service({action:'decline'});
      } else if(!r.service({action:'event'})) r.service({action:'decline'});
      continue;
    }
    if(r.enemy.kind==='boss') reached.set(r.act,r.enemy);
    if(r.enemy.barrier&&r.preview().final>0n) {fire();continue;}
    plan(r);
    const p=r.preview();
    if(p.impact.dealt<r.enemy.hp) {
      const outcome=r.enemyOutcome();
      const hits=attackHits(r.next);
      const support=r.hand.findIndex(c=>r.canPlay(c)&&(
        (c.kind==='guard'&&hits>0&&r.guardPoints<r.next.value*hits)||
        (c.kind==='ward'&&!r.wardCharges&&(!hits||outcome.deb!==r.deb||outcome.drawPenalty||outcome.energyPenalty))));
      if(support>=0) r.play(support);
    }
    const survive=r.enemyOutcome().hp>0;
    const response=r.burstResponse(r.preview());
    const defendNow=response.status==='success'&&r.hp<=36&&r.enemyOutcome().hp<(response.outcome?.hp??0);
    if(!defendNow&&p.impact.kind!=='gate'&&p.final<r.enemy.hp&&r.holds<r.holdLimit&&survive&&r.board.length<r.slots) r.hold();
    else fire();
  }
  throw Error('Simulation exceeded turn budget for '+seed);
}
const total=Number(process.argv[2]||32);
const offset=Number(process.argv[3]||0);
const rows=[];
for(const id of Object.keys(strategies)) {
  const metric={policy:id,seeds:total,clear:0,extra:0,infinity:0,exchanges:0,exchangeVisits:0,attenuations:0,enchantments:0,bossAttempts:[0,0,0],bossWins:[0,0,0],bossesByName:{},turns:0,used:{},relics:{},lossesByEnemy:{},actReached:[0,0,0,0],additionRelic:{ownedAtEnd:0,clearWith:0,lossWithoutByAct:[0,0,0,0]}};
  metric.muryotaisu={runs:0,numericRuns:0,landedRuns:0,numericBursts:0,infinityBursts:0,landedBursts:0,firstByAct:[0,0,0,0]};
  let max=0n,bestSeed='',bestFormula='';
  for(let i=0;i<total;i++) {
    const {r,cleared,clearedWithAdditionRelic,reached,reach,exchanges,exchangeVisits,attenuations,enchantments}=play('db-'+(i+offset),id);
    metric.exchanges+=exchanges;
    metric.exchangeVisits+=exchangeVisits;
    metric.attenuations+=attenuations;
    metric.enchantments+=enchantments;
    for(const [stage,enemy] of reached) {
      metric.bossAttempts[stage-1]++;
      const boss=metric.bossesByName[enemy.name]??={attempts:0,wins:0,lossAtFullHp:0,remainingHpPctSum:0};
      boss.attempts++;
      if(enemy.hp===0n) boss.wins++;
      else {
        boss.lossAtFullHp+=Number(enemy.hp===enemy.max);
        boss.remainingHpPctSum+=Number(enemy.hp*100n/enemy.max);
      }
    }
    for(let j=0;j<r.stats.bosses;j++) metric.bossWins[j]++;
    const ownsAdditionRelic=hasAdditionRelic(r);
    metric.additionRelic.ownedAtEnd+=Number(ownsAdditionRelic);
    metric.additionRelic.clearWith+=Number(clearedWithAdditionRelic);
    for(let act=0;act<r.act;act++) metric.actReached[act]++;
    if(r.phase==='loss') {
      const group=r.act+':'+r.enemy.kind;
      metric.lossesByEnemy[group]=(metric.lossesByEnemy[group]||0)+1;
      if(!ownsAdditionRelic) metric.additionRelic.lossWithoutByAct[r.act-1]++;
    }
    metric.clear+=Number(cleared);
    metric.extra+=Number(r.phase==='win');
    metric.infinity+=Number(reach.infinityBursts>0);
    if(reach.firstAct!==null) {
      const result=metric.muryotaisu;
      result.runs++;
      result.numericRuns+=Number(reach.numericBursts>0);
      result.landedRuns+=Number(reach.landedBursts>0);
      result.numericBursts+=reach.numericBursts;
      result.infinityBursts+=reach.infinityBursts;
      result.landedBursts+=reach.landedBursts;
      result.firstByAct[reach.firstAct-1]++;
    }
    metric.turns+=r.stats.turns;
    for(const [k,n] of Object.entries(r.stats.usage)) metric.used[k]=(metric.used[k]||0)+n;
    for(const k of r.owned) metric.relics[k]=(metric.relics[k]||0)+1;
    if(r.stats.max>max) {max=r.stats.max;bestSeed=r.seed;bestFormula=r.stats.formula;}
  }
  metric.avgTurns=Number((metric.turns/total).toFixed(2));
  metric.max=format(max,true,false);metric.maxExact=String(max);metric.bestSeed=bestSeed;metric.bestFormula=bestFormula;
  rows.push(metric);
}
console.log(JSON.stringify(rows,null,2));
