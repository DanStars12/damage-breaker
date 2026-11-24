import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMotionMode,motionChoices,motionSettings} from '../src/motion.mjs';
import {reelTiming} from '../src/presentation.mjs';

test('OS reduced-motion never becomes skip without explicit player permission',()=>{
  assert.equal(resolveMotionMode(undefined,false),'full');
  assert.equal(resolveMotionMode(undefined,true),'calm');
  assert.equal(resolveMotionMode(null,true),'calm');
  assert.equal(resolveMotionMode('bogus',true),'calm');
  assert.equal(resolveMotionMode('bogus',false),'full');
  assert.equal(resolveMotionMode('off',true),'off');
  assert.equal(resolveMotionMode('off',false),'off');
});

test('explicit player motion choice takes precedence over OS preference',()=>{
  for(const mode of motionChoices) {
    assert.equal(resolveMotionMode(mode,true),mode);
    assert.equal(resolveMotionMode(mode,false),mode);
  }
  assert.deepEqual(motionSettings.map(([key])=>key),motionChoices);
  assert.match(motionSettings.find(([key])=>key==='calm')[1],/穏やか/);
});

test('fast reel frames remain perceivable on common low refresh rates',()=>{
  for(const [from,to] of [[[20n,1n],[30n,1n]],[[20n,1n],[999999n,1n]],
    [[1000000n,1n],[10000000000000000n,1n]]]) {
    const step=reelTiming(from,to,'card',true);
    assert(step.duration>=170,'reel animation should last several 30Hz frames');
    assert(step.duration<=460,'lightweight mode should remain fast');
    const full=reelTiming(from,to,'card',false);
    assert(full.duration>=step.duration);
  }
});
