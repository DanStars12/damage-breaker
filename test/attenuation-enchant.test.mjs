import test from 'node:test';
import assert from 'node:assert/strict';
import {Run,prices} from '../src/run.mjs';
import {card,enchanted,fused,spellKinds,upgraded} from '../src/cards.mjs';
import {evaluate} from '../src/relics.mjs';
import {makeEnemy,encounterCount,attenuationPattern,intent} from '../src/enemies.mjs';
import {timeline} from '../src/presentation.mjs';
import {readCheckpoint,writeCheckpoint} from '../src/checkpoint.mjs';
import {readDivination} from '../src/hint.mjs';

function route(run,kind) {
  const node=run.map.flat().find(n=>n.kind===kind);
  run.routes=[node.id];
  assert(run.route(node.id));
}
function battle(cycle='attack') {
  const run=new Run('1.4-regression');
  route(run,'fight');
  run.enemy.cycle=[cycle];
  run.enemy.hp=run.enemy.max=9000n;
  run.enemy.armor=1;
  run.board=[card('add',10),card('mul',3)];
  return run;
}

test('every regular enemy, elite and boss has an attenuation condition for each intent, including EXTRA',()=>{
  for(let act=1;act<=4;act++) for(const kind of act===4?['extra']:['fight','elite','boss']) {
    for(let i=0;i<(act===4?1:encounterCount(act,kind));i++) {
      const enemy=makeEnemy(act,kind,i,0);
      for(let tick=0;tick<enemy.cycle.length;tick++) {
        const pattern=attenuationPattern(intent(enemy,tick,act));
        assert.equal(pattern.length,2);
        assert.deepEqual(new Set(pattern),new Set(['add','mul']));
      }
    }
  }
});

test('attenuation halves retaliation before guard, grants next-turn relic bonuses and persists once per battle',()=>{
  const run=battle();
  run.enemy.attack=19;
  run.hp=40;
  run.guard=3;
  run.owned=['furnaceRemainder','setComplement','cosineShield','differenceElixir'];
  const f=run.burstResponse(run.preview());
  assert.equal(f.status,'success');
  assert.equal(f.outcome.hp,33);
  assert.equal(f.outcome.hitDetails[0].lost,7);
  assert.deepEqual(run.burst().response,f);
  assert.equal(run.hp,37);
  assert.equal(run.energy,5);
  assert.equal(run.hand.length,7);
  assert.equal(run.guard,6);
  assert.equal(run.attenuationUsed,true);
  const saved=readCheckpoint(writeCheckpoint({run})).run;
  assert.equal(saved.energy,5);
  assert.equal(saved.drawCount,7);
  assert.equal(saved.burstResponse(saved.preview()).status,null);
  assert(saved.hold());
  assert.equal(saved.energy,3);
  assert.equal(saved.hand.length,5);
  assert.equal(saved.hp,24);
  assert.equal(saved.attenuationUsed,true);
  route(Object.assign(saved,{phase:'map'}),'fight');
  assert.equal(saved.attenuationUsed,false);
});

test('failure, obstruction and HOLD do not consume attenuation, and lethal BURST skips retaliation',()=>{
  const run=battle();
  run.deb=[{kind:'seal',value:0,at:1,enemy:true}];
  assert.equal(run.burstResponse(run.preview()).status,'failure');
  run.deb=[];
  run.board.reverse();
  const attack=run.next.value;
  assert.equal(run.burst().response.status,'failure');
  assert.equal(run.hp,100-attack);
  assert.equal(run.attenuationUsed,false);
  run.board=[card('add',10),card('mul',3)];
  assert(run.hold());
  assert.equal(run.hp,100-attack*2);
  assert.equal(run.attenuationUsed,false);
  run.enemy.hp=1n;
  assert.deepEqual(run.burst().response,{status:null,outcome:null});
  assert.equal(run.phase,'reward');
});

test('attenuation weakens numeric curses and cancels binary penalties without consuming the ward',()=>{
  const run=battle('sub');
  run.board.reverse();
  assert.equal(run.burst().response.status,'success');
  assert.equal(run.deb[0].value,10);
  const binary=battle('lock:add');
  binary.board.reverse();
  binary.ward=2;
  assert.equal(binary.burst().response.status,'success');
  assert.equal(binary.deb.length,0);
  assert.equal(binary.ward,2);
  const hybrid=battle('shatter');
  hybrid.ward=2;
  assert.equal(hybrid.burst().response.status,'success');
  assert.equal(hybrid.ward,1);
});

test('repetition uses one slot and one combo per card, and sealed cards never repeat',()=>{
  const add=enchanted(card('add',10),'repeat');
  const mul=card('mul',10);
  const result=evaluate({board:[add,mul],owned:['grimoire']});
  assert.equal(result.final,160000n);
  assert.equal(result.steps.length,2);
  assert.equal(result.triggers[0].op.value,2);
  assert.equal(evaluate({board:[add],owned:['grimoire']}).triggers.length,0);
  assert.deepEqual(timeline(result,1).slice(0,3).map(s=>[s.type,s.combo,s.value[0]]),[
    ['card',1,30n],['repeat',1,40n],['card',2,400n]
  ]);
  const seal=evaluate({board:[add,mul],deb:[{kind:'lock',value:0,target:'add',at:0,enemy:true}]});
  assert.equal(seal.final,200n);
  assert(!seal.steps.some(s=>s.firstResult));
});

test('placement runes grant energy or extra cards once and spells never take a board slot',()=>{
  const run=battle();
  run.hand=[enchanted(card('add',10),'energyPlus'),enchanted(card('mul',2),'drawPlus'),card('guard',6)];
  run.deckDraw=[card('add',21),card('add',22)];
  run.energy=3;
  assert(run.play(0));
  assert.equal(run.energy,4);
  assert(!run.returnToHand(2));
  assert(run.play(0));
  assert.equal(run.hand.length,3);
  assert.equal(run.energy,3);
  assert(!run.returnToHand(3));
  assert(run.play(0));
  assert.equal(run.board.length,4);
  assert.equal(run.guard,6);
  assert(spellKinds.every(kind=>enchanted(card(kind,1),'repeat')===null));
  assert.equal(upgraded(run.board[2],'power').enchant,'energyPlus');
  assert.equal(fused(run.board[2],card('add',3)).enchant,'energyPlus');
  assert.equal(fused(run.board[2],enchanted(card('add',3),'repeat')),null);
  assert.equal(readCheckpoint(writeCheckpoint({run})).run.board[3].enchant,'drawPlus');
});

test('divination distinguishes enchanted variants and uses energy gained from placement',()=>{
  const run=battle();
  run.board=[];
  run.energy=1;
  run.hand=[card('mul',9),enchanted(card('add',5),'energyPlus'),enchanted(card('mul',9),'repeat')];
  const search=readDivination(run);
  let answer=search.next();
  while(!answer.done) answer=search.next();
  const {order,damage}=answer.value;
  assert.deepEqual(order.map(c=>c.enchant??null),['energyPlus',null,'repeat']);
  assert.equal(damage,18225n);
});

test('event and relic enchantments apply to one eligible card atomically and never overwrite',()=>{
  const run=new Run('enchanted-acquisition');
  route(run,'event');
  run.event='echoShrine';
  const size=run.deck.length;
  assert.equal(run.service({action:'event'}),null);
  assert.equal(run.service({action:'event',j:size-1}),null);
  assert.equal(run.service({action:'event',j:0}).enchant,'repeat');
  assert.equal(run.deck[0].enchant,'repeat');
  assert.equal(run.deck.length,size);
  assert.equal(run.service({action:'event',j:1}),null);
  route(run,'shop');
  run.gold=200;
  run.stockRelics=['echoEngraver'];
  assert.equal(run.service({action:'relic',i:0,j:0}),null);
  assert.equal(run.gold,200);
  assert.deepEqual(run.owned,[]);
  assert.equal(run.service({action:'relic',i:0,j:1}).result.enchant,'repeat');
  assert.equal(run.gold,200-prices.relic);
  assert.equal(run.deck[1].enchant,'repeat');
  assert.deepEqual(run.owned,['echoEngraver']);

  const reward=battle();
  reward.enemy.hp=1n;
  reward.burst();
  reward.relicDrop='echoEngraver';
  reward.relicDecision='pending';
  assert(!reward.chooseRelic(true));
  assert(reward.chooseRelic(true,0,2));
  assert.equal(reward.deck[2].enchant,'repeat');
  assert.equal(reward.relicEnchantedCard.enchant,'repeat');
  assert(!reward.chooseRelic(true,0,3));
  assert.deepEqual(readCheckpoint(writeCheckpoint({run:reward})).run.relicEnchantedCard,reward.deck[2]);
});
