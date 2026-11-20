import {evaluate} from './relics.mjs';
import {supportKinds,enchantmentFor} from './cards.mjs';

// Search interleavings without changing the relative order of cards already on the board.
export function* readDivination(run,{maxVisited=60000}={}) {
  const {board,hand,energy,slots,base,deb,owned,holds}=run;
  const input={base,deb,owned,holds,armor:run.enemy.armor};
  const choices=hand.filter(card=>!supportKinds.includes(card.kind));
  // BigInt bits avoid hand-index collisions beyond the 32-bit bitwise limit.
  const bits=choices.map((_,i)=>1n<<BigInt(i));
  const order=[];
  let limited=false;
  let best={order:[...board],damage:run.preview().final,cost:0};
  let visited=0;
  function* step(existing,spent,bonus,used) {
    if(limited) return;
    if(visited>=maxVisited) {limited=true;return;}
    if((++visited%400)===0) yield;
    if(existing===board.length) {
      const damage=evaluate({...input,board:order}).final;
      if(damage>best.damage||(damage===best.damage&&spent<best.cost))
        best={order:[...order],damage,cost:spent};
    } else {
      order.push(board[existing]);
      yield* step(existing+1,spent,bonus,used);
      order.pop();
    }
    if(order.length+board.length-existing>=slots) return;
    const seen=new Set();
    for(const [i,card] of choices.entries()) {
      if(limited) break;
      if((used&bits[i])!==0n||spent+card.cost>energy+bonus) continue;
      const key=card.kind+'/'+card.value+'/'+card.cost+'/'+Boolean(card.upgraded)+'/'+card.enchant;
      if(seen.has(key)) continue;
      seen.add(key);
      order.push(card);
      yield* step(existing,spent+card.cost,bonus+(enchantmentFor(card)?.energy??0),used|bits[i]);
      order.pop();
    }
  }
  yield* step(0,0,0,0n);
  return {...best,limited,visited};
}
