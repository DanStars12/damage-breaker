import {random} from './cards.mjs';
import {Run} from './run.mjs';
import {relics} from './relics.mjs';
import {encounterName} from './enemies.mjs';

const checkpointVersion=1;
const resumablePhases=['map','battle','reward','facility','clear'];
const shopKinds=['shop','forge','fuse','relic','remove','event'];
const savedCardKinds=['add','mul','pct','pow','exp','clean','ward'];
const integerBetween=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const validCard=c=>c&&savedCardKinds.includes(c.kind)&&Number.isSafeInteger(c.value)&&
  integerBetween(c.cost,1,4)&&integerBetween(c.tier,0,4);
const validCards=cards=>Array.isArray(cards)&&cards.every(validCard);
const validRelic=id=>typeof id==='string'&&Object.hasOwn(relics,id);
const nonnegativeBigInt=n=>typeof n==='bigint'&&n>=0n;
const rewardDecisions=['pending','taken','skipped'];

export function writeCheckpoint({run,notice='',craftResult=null}) {
  const {rng,uncommittedCards,...state}=run;
  const returnableSlots=state.board?.flatMap((card,i)=>uncommittedCards.has(card)?[i]:[])??[];
  return JSON.stringify({version:checkpointVersion,state,randomState:rng.state(),notice,craftResult,returnableSlots},
    (_,value)=>typeof value==='bigint'?{$bigint:String(value)}:value);
}
export function readCheckpoint(serialized) {
  if(typeof serialized!=='string') return null;
  try {
    const data=JSON.parse(serialized,(_,value)=>{
      if(!value||typeof value!=='object'||!Object.hasOwn(value,'$bigint')) return value;
      if(typeof value.$bigint!=='string'||! /^-?\d+$/.test(value.$bigint)) throw new TypeError('Invalid BigInt');
      return BigInt(value.$bigint);
    });
    const {version,state,randomState,notice,craftResult,returnableSlots=[]}=data;
    if(version!==checkpointVersion||!state||!integerBetween(randomState,-2147483648,2147483647)||
      !resumablePhases.includes(state.phase)||typeof state.seed!=='string'||typeof notice!=='string'||
      !integerBetween(state.act,1,4)||!integerBetween(state.stage,0,30)||!integerBetween(state.hp,1,100)||
      !Number.isSafeInteger(state.gold)||state.gold<0||!validCards(state.deck)||!state.deck.length||
      !Array.isArray(state.owned)||!state.owned.every(validRelic)||!Array.isArray(state.map)||
      !Array.isArray(state.routes)||!Array.isArray(state.visited)||!Array.isArray(state.history)||
      !Array.isArray(state.recent)||!state.recent.every(nonnegativeBigInt)||!nonnegativeBigInt(state.stats?.max)) return null;
    if(state.phase==='battle'||state.phase==='reward') {
      const e=state.enemy;
      if(!nonnegativeBigInt(e?.hp)||!nonnegativeBigInt(e.max)||e.max===0n||
        !Array.isArray(e.gates)||!e.gates.every(nonnegativeBigInt)||!Array.isArray(e.cycle)||!e.cycle.length||
        !validCards(state.hand)||!validCards(state.board)||!validCards(state.deckDraw)||!validCards(state.discard)||
        !Array.isArray(state.deb)||!integerBetween(state.maxHp,1,100)) return null;
    }
    if(state.phase==='reward'&&(!validCards(state.offers)||
      ![...rewardDecisions,'none'].includes(state.cardDecision?.status)||
      (state.cardDecision.status==='taken'&&!validCard(state.cardDecision.card))||
      !rewardDecisions.includes(state.goldDecision)||
      (state.relicAlternative!=null&&(!validRelic(state.relicAlternative)||state.relicAlternative===state.relicDrop))||
      (state.relicDecision!==null&&(!rewardDecisions.includes(state.relicDecision)||!validRelic(state.relicDrop))))) return null;
    if(craftResult&&(!shopKinds.includes(craftResult.kind)||(craftResult.result&&!validCard(craftResult.result))||
      (craftResult.kind!=='event'&&!validCards(craftResult.sources))||
      (craftResult.relic&&!validRelic(craftResult.relic)))) return null;
    if(state.phase==='battle'||state.phase==='reward') {
      const variant=state.enemy.art?.palette%6;
      state.enemy.name=encounterName(state.act,state.enemy.kind,variant)??state.enemy.name;
    }
    if(!Array.isArray(returnableSlots)||returnableSlots.some(i=>state.phase!=='battle'||
      !integerBetween(i,0,state.board.length-1)||!state.stats.usage?.[state.board[i].kind])) return null;
    state.uncommittedCards=new Set(returnableSlots.map(i=>state.board[i]));
    Object.setPrototypeOf(state,Run.prototype);
    state.rng=random(state.seed,randomState);
    return {run:state,notice,craftResult};
  } catch {
    return null;
  }
}
