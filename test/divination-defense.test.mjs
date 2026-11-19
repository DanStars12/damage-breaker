import test from 'node:test';
import assert from 'node:assert/strict';
import {Run,prices} from '../src/run.mjs';
import {readDivination} from '../src/hint.mjs';
import {readCheckpoint,writeCheckpoint} from '../src/checkpoint.mjs';

function encounter(seed='turn-ledger') {
  const run=new Run(seed);
  run.route(run.routes[0]);
  return run;
}
const operation=(kind,value,upgraded=false)=>({kind,value,tier:0,cost:1,upgraded});
function solve(run) {
  const search=readDivination(run);
  for(let step=search.next();;step=search.next()) if(step.done) return step.value;
}

test('divination places the relic-optimal card without consuming support or existing cards',()=>{
  const run=encounter();
  const a=operation('add',120), low=operation('mul',12), high=operation('mul',90);
  run.board=[a];
  run.hand=[high,low,operation('ward',2)];
  run.energy=1;
  run.owned=['grimoire'];
  assert.deepEqual(solve(run),{order:[a,low],damage:2822400n,cost:1});
  assert.deepEqual(run.board,[a]);
  assert.equal(run.hand.length,3);
});
test('divination distinguishes upgraded copies for relic effects and keeps a page when no play helps',()=>{
  const run=encounter();
  const a=operation('add',10,true), basic=operation('mul',2), upgraded=operation('mul',2,true);
  run.board=[a];
  run.hand=[basic,upgraded];
  run.energy=1;
  run.owned=['anvil'];
  assert.deepEqual(solve(run).order,[a,upgraded]);
  run.deb=[{kind:'lock',target:'mul',at:0,value:0,enemy:true}];
  assert.equal(solve(run).cost,0);
});
test('hit ledger resolves interception, defense, overkill and curse separately',()=>{
  const run=encounter();
  run.hp=20;
  run.guard=12;
  const action={kind:'pursuit',value:10};
  assert.deepEqual(run.enemyOutcome(action,true).hitDetails,[
    {stopped:true,defended:0,lost:0,hp:20,guardLeft:12}, {stopped:false,defended:10,lost:0,hp:20,guardLeft:2},
    {stopped:false,defended:2,lost:8,hp:12,guardLeft:0}
  ]);
  run.hp=2;
  run.guard=0;
  assert.deepEqual(run.enemyOutcome(action).hitDetails.map(hit=>hit.lost),[2,0,0]);
});
test('ward breaker removes two ward layers, interception stops it, and the hammer removes two foe layers',()=>{
  const run=encounter();
  const action={kind:'shatter',value:8};
  run.ward=3;
  assert.equal(run.enemyOutcome(action).ward,1);
  assert.equal(run.enemyOutcome(action,true).ward,3);
  run.enemy.cycle=['shatter'];
  run.guard=48;
  run.board=[operation('add',4),operation('add',5)];
  assert.equal(run.interceptReason(),'');
  run.owned=['breach'];
  run.enemy.barrier=2;
  run.board=[4,5,6,7].map(v=>operation('add',v));
  assert.deepEqual(run.preview().impact,{kind:'barrier',dealt:0n,breaks:2,relic:'breach'});
  run.burst();
  assert.equal(run.enemy.barrier,0);
  assert.equal(run.enemy.hp,run.enemy.max);
});
test('rare pages persist through reward choice, shop sale and event saves',()=>{
  const run=encounter();
  run.enemy.hp=1n;
  run.burst();
  run.omenDecision='pending';
  run.skipCard();
  run.chooseGold(false);
  assert(run.rewardPending);
  assert(run.chooseOmen(true));
  assert(!run.chooseOmen(true));
  assert(!run.rewardPending);
  const copy=readCheckpoint(writeCheckpoint({run})).run;
  assert.equal(copy.omens,1);
  const node=copy.map.flat().find(n=>n.kind==='shop');
  copy.advance();
  copy.routes=[node.id];
  copy.route(node.id);
  copy.gold=prices.omen*2;
  copy.shopOmen=true;
  assert(copy.service({action:'omen'}));
  assert.equal(copy.service({action:'omen'}),null);
  assert.equal(copy.gold,prices.omen);
  const event=copy.map.flat().find(n=>n.kind==='event');
  copy.leaveNode();
  copy.routes=[event.id];
  copy.route(event.id);
  copy.event='oracle';
  assert.equal(copy.service({action:'event'}).omen,1);
  assert.equal(copy.omens,3);
});
