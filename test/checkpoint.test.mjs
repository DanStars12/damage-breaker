import test from 'node:test';
import assert from 'node:assert/strict';
import {Run,prices} from '../src/run.mjs';
import {readCheckpoint,writeCheckpoint} from '../src/checkpoint.mjs';

const restore=(run,ui={})=>readCheckpoint(writeCheckpoint({run,...ui}));
const routeKind=(run,kind)=>{
  const node=run.map.flat().find(n=>n.kind===kind);
  run.routes=[node.id];
  assert(run.route(node.id));
};

test('battle resumes with exact values, board order, shuffle state and future hand',()=>{
  const run=new Run('checkpoint-battle');
  routeKind(run,'fight');
  run.enemy.hp=10n**80n;
  run.enemy.max=run.enemy.hp;
  run.enemy.cycle=['div','attack'];
  for(let i=0;i<2;i++) assert(run.play(run.hand.findIndex(c=>c.kind==='add'||c.kind==='mul')));
  assert(run.move(0,1));
  assert(run.hold());
  const copy=restore(run,{notice:'妨害'}).run;
  assert.equal(copy.enemy.hp,run.enemy.hp);
  assert.deepEqual(copy.preview(),run.preview());
  assert.deepEqual(copy.next,run.next);
  assert.deepEqual(copy.burst(),run.burst());
  assert(copy.hold()&&run.hold());
  assert.deepEqual(copy.hand,run.hand);
  assert.deepEqual(copy.lastBurst,run.lastBurst);
  assert.equal(copy.rng(),run.rng());
});

test('reward decisions survive reload independently without granting items twice',()=>{
  let run=new Run('checkpoint-reward');
  routeKind(run,'elite');
  run.enemy.hp=1n;
  run.enemy.barrier=0;
  run.burst();
  assert(run.takeCard(0));
  const card=run.cardDecision.card;
  const deckSize=run.deck.length;
  run=restore(run).run;
  assert.deepEqual(run.cardDecision.card,card);
  assert.equal(run.takeCard(1),false);
  assert.equal(run.deck.length,deckSize);
  assert(run.chooseGold(false));
  assert(run.chooseRelic(true));
  run=restore(run).run;
  assert.equal(run.chooseGold(true),false);
  assert.equal(run.chooseRelic(true),false);
  assert.deepEqual(run.owned,[run.relicDrop]);
  run.advance();
  assert.equal(run.phase,'map');
});

test('shop restores paid receipt, spent stock and the rest of the inventory',()=>{
  let run=new Run('checkpoint-shop');
  routeKind(run,'shop');
  run.gold=200;
  const craftResult=run.service({action:'buy',i:0});
  const reopened=restore(run,{craftResult});
  assert.deepEqual(reopened.craftResult,craftResult);
  run=reopened.run;
  assert.equal(run.gold,200-prices.buy);
  assert.equal(run.service({action:'buy',i:0}),null);
  assert(run.service({action:'buy',i:1}));
});

test('EXTRA is resumable, preserving the archive ID and exact record',()=>{
  const run=new Run('checkpoint-extra');
  run.phase='clear';
  run.act=3;
  run.archiveId='record-id';
  run.stats.max=10n**90n;
  const resumed=restore(run).run;
  assert.equal(resumed.archiveId,'record-id');
  assert.equal(resumed.stats.max,10n**90n);
  resumed.extra();
  assert.equal(resumed.phase,'battle');
  assert.equal(restore(resumed).run.act,4);
});

test('malformed, incompatible and finished checkpoints do not offer resume',()=>{
  const run=new Run('checkpoint-invalid');
  const baseline=JSON.parse(writeCheckpoint({run}));
  assert.equal(readCheckpoint('{'),null);
  assert.equal(readCheckpoint(JSON.stringify({...baseline,version:2})),null);
  assert.equal(readCheckpoint(JSON.stringify({...baseline,randomState:1.5})),null);
  baseline.state.stats.max={$bigint:'bad'};
  assert.equal(readCheckpoint(JSON.stringify(baseline)),null);
  run.phase='loss';
  assert.equal(restore(run),null);
});

test('a second elite relic can be chosen after reload and the other stays unowned',()=>{
  let run=new Run('checkpoint-elite-choice');
  routeKind(run,'elite');
  run.enemy.hp=1n;
  run.enemy.barrier=0;
  run.burst();
  const {relicDrop,relicAlternative}=run;
  assert(relicAlternative);
  assert.notEqual(relicDrop,relicAlternative);
  run=restore(run).run;
  assert.equal(run.chooseRelic(true,2),false);
  assert.equal(run.relicDecision,'pending');
  assert(run.chooseRelic(true,1));
  assert.deepEqual(run.owned,[relicAlternative]);
  assert.equal(run.relicDrop,relicAlternative);
  assert.equal(run.chooseRelic(true,0),false);
  run=restore(run).run;
  assert.deepEqual(run.owned,[relicAlternative]);

  // A pending reward saved in v0.5.2 has a single relic and no alternative field.
  const old=JSON.parse(writeCheckpoint({run}));
  old.state.owned=[];
  old.state.relicDrop=relicDrop;
  old.state.relicDecision='pending';
  delete old.state.relicAlternative;
  const migrated=readCheckpoint(JSON.stringify(old)).run;
  assert(migrated.chooseRelic(true));
  assert.deepEqual(migrated.owned,[relicDrop]);
});


test('loading an old enemy name updates the label while preserving battle state',()=>{
  const run=new Run('checkpoint-renamed-foe');
  run.act=3;
  run.start({kind:'boss',variant:1,row:9});
  run.enemy.hp-=1n;
  run.enemy.barrier=1;
  run.enemy.name='星蝕の虚空皇帝';
  const loaded=restore(run).run;
  assert.equal(loaded.enemy.name,'エクリプス・エンペラー');
  assert.equal(loaded.enemy.hp,run.enemy.hp);
  assert.equal(loaded.enemy.barrier,1);
  assert.deepEqual(loaded.enemy.gates,run.enemy.gates);
  assert.deepEqual(loaded.next,run.next);
});

test('return rights follow the exact card after reorder and checkpoint reload',()=>{
  const run=new Run('pending-board');
  routeKind(run,'fight');
  const pick=()=>run.hand.findIndex(c=>c.kind==='add'||c.kind==='mul');
  assert(run.play(pick()));
  assert(run.hold());
  assert(run.play(pick(),0));
  assert(run.move(0,1));
  const restored=restore(run).run;
  assert.equal(restored.canReturn(0),false);
  assert.equal(restored.canReturn(1),true);
  const energy=restored.energy, cost=restored.board[1].cost;
  assert(restored.returnToHand(1));
  assert.equal(restored.energy,energy+cost);
  assert.deepEqual(restored.board,[run.board[0]]);

  const old=JSON.parse(writeCheckpoint({run}));
  delete old.returnableSlots;
  const legacy=readCheckpoint(JSON.stringify(old)).run;
  assert.deepEqual(legacy.board,run.board);
  assert.equal(legacy.canReturn(1),false);
});

test('new boss moves, relics and one-turn penalties survive a reload',()=>{
  const run=new Run('new-encounter-save');
  run.act=2;
  run.owned=['chalk','vigil','lens'];
  run.beginMap();
  routeKind(run,'boss');
  run.enemy.cycle=['tax','dust'];
  assert(run.hold());
  const copy=restore(run).run;
  assert.equal(copy.base,40);
  assert.equal(copy.energyPenalty,1);
  assert.equal(copy.capacity,2);
  assert.deepEqual(copy.next,run.next);
  assert(copy.hold());
  assert.equal(copy.energyPenalty,0);
  assert.equal(copy.drawPenalty,1);
  assert.equal(copy.hand.length,4);
});

test('new support cards and defenses survive reload while legacy ward remains usable',()=>{
  const run=new Run('support-save');
  routeKind(run,'fight');
  run.hand=[{kind:'guard',value:14,cost:1,tier:2}];
  assert(run.play(0));
  run.ward=3;
  const copy=restore(run).run;
  assert.equal(copy.guardPoints,14);
  assert.equal(copy.wardCharges,3);
  assert.equal(copy.discard.at(-1).kind,'guard');
  const legacy=JSON.parse(writeCheckpoint({run}));
  delete legacy.state.guard;
  legacy.state.ward=true;
  const old=readCheckpoint(JSON.stringify(legacy)).run;
  assert.equal(old.guardPoints,0);
  assert.equal(old.wardCharges,1);
});
