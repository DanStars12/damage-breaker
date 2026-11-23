import test from 'node:test';
import assert from 'node:assert/strict';
import {Run} from '../src/run.mjs';
import {card} from '../src/cards.mjs';
import {CAP} from '../src/math.mjs';

function battle(seed) {
  const run=new Run('v153-forecast-'+seed);
  assert(run.route(run.routes[0]));
  run.enemy.hp=run.enemy.max=1000n;
  run.enemy.barrier=0;
  run.enemy.gates=[];
  run.enemy.originalGates=[];
  run.enemy.armor=1;
  run.hp=30;
  run.guard=6;
  run.ward=2;
  run.board=[card('add',12),card('mul',5)];
  return run;
}

test('HOLD forecast exactly matches executed enemy status across direct, multi-hit and debuff intents',()=>{
  for(const kind of ['attack','double','pursuit','shatter','flare','wither','drain','lock:add','div','pct','fracture','tax']) {
    const run=battle(kind);
    run.enemy.cycle=[kind];
    const boardBefore=[...run.board];
    const predicted=run.enemyOutcome(run.next);
    assert(run.hold(),kind);
    for(const property of ['hp','maxHp','drain','ward','guard','deb'])
      assert.deepEqual(run[property],predicted[property],kind+' '+property);
    assert.deepEqual(run.board,boardBefore,kind+' preserves board');
  }
});

test('BURST HP, barrier and durability predictions resolve identically to the real attack',()=>{
  for(const scenario of ['hit','barrier','gate','win','attenuated-fatal']) {
    const run=battle(scenario);
    run.enemy.cycle=['attack'];
    run.ward=0;
    if(scenario==='barrier') run.enemy.barrier=2;
    if(scenario==='gate') {
      run.enemy.hp=run.enemy.max=200n;
      run.enemy.gates=[100n];
      run.enemy.originalGates=[100n];
    }
    if(scenario==='win') run.enemy.hp=1n;
    if(scenario==='attenuated-fatal') {run.hp=1;run.guard=0;}
    const hpBefore=run.hp;
    const enemyBefore=run.enemy.hp;
    const preview=run.preview();
    const response=run.burstResponse(preview);
    const beforeGates=run.enemy.gates.length,barrierBefore=run.enemy.barrier;
    const actual=run.burst();
    assert.deepEqual(actual.response,response,scenario+' response');
    assert.deepEqual(actual.impact,preview.impact,scenario+' impact');
    assert.equal(run.enemy.hp,enemyBefore-preview.impact.dealt,scenario+' damage');
    if(scenario==='barrier') assert.equal(run.enemy.barrier,barrierBefore-preview.impact.breaks);
    if(scenario==='gate') assert.equal(run.enemy.gates.length,beforeGates-1);
    if(response.outcome) {
      const healing=response.status==='success'&&response.outcome.hp>0?run.bonus('attenuationHeal'):0;
      assert.equal(run.hp,Math.min(response.outcome.maxHp,response.outcome.hp+healing),scenario+' post-retaliation HP');
    } else assert.equal(run.hp,Math.min(100,hpBefore+7+run.bonus('victoryRecovery')),scenario+' victory heal');
  }
});

test('huge BigInt damage keeps barrier and durability limits before HP reduction',()=>{
  const run=battle('infinite-defenses');
  run.board=[card('exp',70),card('pow',2)];
  run.enemy.hp=run.enemy.max=10n**30n;
  run.enemy.barrier=2;
  run.enemy.gates=[5n*10n**29n];
  run.enemy.originalGates=[5n*10n**29n];
  const barrier=run.preview();
  assert(barrier.final>CAP);
  assert.equal(barrier.impact.kind,'barrier');
  assert.equal(barrier.impact.dealt,0n);
  run.enemy.barrier=0;
  const gate=run.preview();
  assert.equal(gate.impact.kind,'gate');
  assert.equal(gate.impact.dealt,5n*10n**29n);
  run.enemy.gates=[];
  const hit=run.preview();
  assert.equal(hit.impact.kind,'hit');
  assert.equal(hit.impact.dealt,run.enemy.hp);
});
