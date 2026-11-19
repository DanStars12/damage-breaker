import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {events} from '../src/events.mjs';
import {eventArtIds,facilityArtIds,eventCanvasSize,paintEvent} from '../src/event-art.mjs';

test('every event has a distinct, deterministic pixel background',()=>{
  const [width,height]=eventCanvasSize;
  const draw=id=>{
    const pixels=Array(width*height);
    const ctx={fillStyle:null,fillRect(x,y,w,h){
      assert(Number.isInteger(x)&&Number.isInteger(y));
      assert.match(this.fillStyle,/^#[0-9a-f]{6}$/i);
      for(let row=Math.max(y,0);row<Math.min(y+h,height);row++) {
        pixels.fill(this.fillStyle,row*width+Math.min(width,Math.max(0,x)),row*width+Math.max(0,Math.min(width,x+w)));
      }
    }};
    assert(paintEvent({getContext:()=>ctx},id));
    assert(pixels.every(Boolean));
    assert(new Set(pixels).size>=5);
    return createHash('sha256').update(pixels.join('')).digest('hex');
  };
  assert.equal(Object.keys(events).length,34);
  assert.deepEqual([...eventArtIds].sort(),Object.keys(events).sort());
  const scenes=[...eventArtIds,...facilityArtIds];
  assert.deepEqual(facilityArtIds,['rest','shop']);
  const hashes=scenes.map(draw);
  assert.equal(new Set(hashes).size,36);
  assert.deepEqual(scenes.map(draw),hashes);
});
