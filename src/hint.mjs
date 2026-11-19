import {evaluate} from './relics.mjs';
import {supportKinds,enchantmentFor} from './cards.mjs';

// Search interleavings without changing the relative order of cards already on the board.
export function* readDivination(run) {
  const {board,hand,energy,slots,base,deb,owned,holds}=run;
  const input={base,deb,owned,holds,armor:run.enemy.armor};
  const choices=hand.filter(card=>!supportKinds.includes(card.kind));
  const order=[];
  let best={order:[...board],damage:run.preview().final,cost:0};
  let visited=0;
  function* step(existing,spent,bonus,used) {
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
      if((used&(1<<i))||spent+card.cost>energy+bonus) continue;
      const key=card.kind+'/'+card.value+'/'+card.cost+'/'+Boolean(card.upgraded)+'/'+card.enchant;
      if(seen.has(key)) continue;
      seen.add(key);
      order.push(card);
      yield* step(existing,spent+card.cost,bonus+(enchantmentFor(card)?.energy??0),used|(1<<i));
      order.pop();
    }
  }
  yield* step(0,0,0,0);
  return best;
}
