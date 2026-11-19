import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound} from '../src/sound.mjs';

test('sound waits for an interaction and applies volume, mute and cancellation',()=>{
  const voices=[];
  const gains=[];
  let resumed=0;
  const parameter=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  class TestAudio {
    state='suspended';
    destination={};
    currentTime=10;
    resume(){resumed++;this.state='running';return Promise.resolve();}
    createGain(){
      const node={gain:parameter(),connect(){},disconnect(){}};
      gains.push(node);
      return node;
    }
    createOscillator(){
      const voice={frequency:parameter(),stops:[],connect(){},disconnect(){},start(at){this.at=at;},stop(at){this.stops.push(at);}};
      voices.push(voice);
      return voice;
    }
  }
  const prefs={volume:40};
  const engine=createSound(TestAudio,()=>prefs);
  engine.play('draw');
  assert.equal(voices.length,0);
  engine.unlock();
  assert.equal(resumed,1);
  const control=new AbortController();
  engine.play('double',{signal:control.signal,fast:true});
  assert.equal(voices.length,2);
  assert.equal(voices[1].at,10+.22*.64);
  assert.equal(gains[0].gain.value,.40);
  control.abort();
  assert.deepEqual(voices.map(v=>v.stops.at(-1)),[undefined,undefined]);
  engine.play('draw',{signal:control.signal});
  assert.equal(voices.length,2);
  prefs.mute=true;
  engine.refresh();
  assert.equal(gains[0].gain.value,0);
  engine.play('draw');
  assert.equal(voices.length,2);
  prefs.mute=false;
  const fingerprints=['hit','relicSurge','impactNova','impactTitan','impactRelease','infinity','barrierCrack','barrierCascade','gate','victory','record'].map(id=>{
    const before=voices.length;
    engine.play(id);
    const added=voices.slice(before);
    assert(added.length>=2,id+' has no layered audio');
    return JSON.stringify(added.map(voice=>[voice.type,voice.at,voice.stops[0]]));
  });
  assert.equal(new Set(fingerprints).size,fingerprints.length);
  assert.doesNotThrow(()=>createSound(undefined,()=>prefs).unlock());
});
