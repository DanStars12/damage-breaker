import {random,shuffle,starter,generate,generateSupport,supportKinds,supportValue,supportCaps,upgraded,fused} from './cards.mjs';
import {evaluate,relics,drawRelic,cleanseDebuffs} from './relics.mjs';
import {makeEnemy,intent,impact,attackHits,attackPatterns} from './enemies.mjs';
import {CAP,label} from './math.mjs';
import {makeMap} from './map.mjs';
import {events} from './events.mjs';
const earlyRelicChoices=['sum','abacus','lattice','ratio','order','tail'];
export const prices={buy:30,relic:96,fuse:24,remove:30,omen:54};
export class Run {
  uncommittedCards=new Set();
  constructor(seed) {
    this.seed=seed;
    this.rng=random(seed);
    this.stage=0;
    this.hp=100;
    this.gold=20;
    this.omens=0;
    this.deck=starter();
    this.owned=[];
    this.history=[];
    this.stats={max:0n,combo:0,mul:0,pow:0,exp:0,infinity:0,turns:0,formula:'',usage:{},bosses:0,intercepts:0,prevented:0};
    this.act=1;
    this.recent=[];
    this.beginMap();
  }
  bonus(key){return this.owned.reduce((n,id)=>n+(relics[id][key]||0),0);}
  get base(){return this.baseAt(this.drain);}
  baseAt(drain=0){return Math.max(1,Math.floor((20+(this.act-1)*15)*(100+this.bonus('base')-drain)/100)+this.bonus('flatBase'));}
  get slots(){return Math.min(8,5+this.act)+this.bonus('slots');}
  get capacity(){return Math.max(1,(this.act>=3?4:3)+this.bonus('energy')-(this.energyPenalty??0)+(this.turn===0?this.bonus('firstEnergy'):0));}
  get drawCount(){return Math.max(2,5+this.bonus('draw')-(this.drawPenalty??0)+(this.turn===0?this.bonus('firstDraw'):0));}
  get wardCharges(){return Number(this.ward)||0;}
  get guardPoints(){return this.guard??0;}
  get next(){return intent(this.enemy,this.turn,this.act);}
  beginMap(){
    this.phase='map';
    this.map=makeMap(this.seed,this.act);
    this.node=null;
    this.visited=[];
    this.routes=this.map[0].map(node=>node.id);
  }
  start(node) {
    const samples=[...this.recent].sort((a,b)=>a<b?-1:a>b?1:0);
    const bench=samples[Math.floor((samples.length-1)/2)]??0n;
    this.phase='battle';
    this.relicDrop=null;
    this.relicAlternative=null;
    this.relicDecision=null;
    this.enemy=makeEnemy(this.act,node?.kind,node?.variant,node?.row,bench);
    this.hp=Math.max(1,this.hp-this.bonus('entry'));
    this.maxHp=100;
    this.drain=0;
    this.drawPenalty=0;
    this.energyPenalty=0;
    this.battlePeak=0n;
    this.lastBurst=null;
    this.deckDraw=shuffle(this.deck,this.rng);
    this.discard=[];
    this.hand=[];
    this.board=[];
    this.uncommittedCards.clear();
    this.deb=[];
    this.turn=0;
    this.holds=0;
    this.ward=this.bonus('ward')>0;
    this.guard=this.bonus('openingGuard');
    this.interceptUsed=false;
    this.refill();
  }
  refill() {
    this.discard.push(...this.hand);
    this.hand=[];
    this.energy=this.capacity;
    while(this.hand.length<this.drawCount) {
      if(!this.deckDraw.length) {
        this.deckDraw=shuffle(this.discard,this.rng);
        this.discard=[];
      }
      if(!this.deckDraw.length) break;
      this.hand.push(this.deckDraw.pop());
    }
  }
  canPlay(c) {
    if(this.phase!=='battle'||!c||c.cost>this.energy) return false;
    if(c.kind==='clean') return this.deb.length>0;
    if(c.kind==='ward') return this.wardCharges<supportCaps.ward;
    if(c.kind==='guard') return this.guardPoints<supportCaps.guard;
    return this.board.length<this.slots;
  }
  play(i,at=this.board.length) {
    const c=this.hand[i];
    if(!this.canPlay(c)) return false;
    this.energy-=c.cost;
    this.hand.splice(i,1);
    this.stats.usage[c.kind]=(this.stats.usage[c.kind]||0)+1;
    if(supportKinds.includes(c.kind)) {
      const power=supportValue(c);
      if(c.kind==='ward') this.ward=Math.min(supportCaps.ward,this.wardCharges+power);
      else if(c.kind==='guard') this.guard=Math.min(supportCaps.guard,this.guardPoints+power);
      else this.deb=cleanseDebuffs(this.deb,this.board.length,power);
      this.discard.push(c);
    } else {
      this.board.splice(at,0,c);
      this.uncommittedCards.add(c);
    }
    return true;
  }
  canReturn(i) {
    return this.phase==='battle'&&this.uncommittedCards.has(this.board[i]);
  }
  returnToHand(i) {
    if(!this.canReturn(i)) return false;
    const [card]=this.board.splice(i,1);
    this.uncommittedCards.delete(card);
    this.hand.push(card);
    this.energy+=card.cost;
    if(--this.stats.usage[card.kind]===0) delete this.stats.usage[card.kind];
    return true;
  }
  move(from,to) {
    if(!this.board[from]||to<0||to>=this.board.length) return false;
    this.board.splice(to,0,this.board.splice(from,1)[0]);
    return true;
  }
  preview(){
    const result=evaluate({base:this.base,board:this.board,deb:this.deb,owned:this.owned,armor:this.enemy.armor,holds:this.holds});
    const effect=impact(this.enemy,result.final);
    if(effect.kind==='barrier') {
      const count=result.steps.filter(step=>step.op&&!step.card.enemy).length;
      const threshold=this.bonus('barrierBreak');
      effect.breaks=threshold&&count>=threshold?Math.min(2,this.enemy.barrier):1;
      if(effect.breaks>1) effect.relic='breach';
    }
    return {...result,impact:effect};
  }
  interceptReason(p=this.preview()) {
    if(this.interceptUsed) return 'この戦闘では使用済み';
    if(this.energy<1) return 'エネルギーを1残す';
    if(!attackHits(this.next)) return '敵の攻撃予告が必要';
    if(p.impact.dealt===this.enemy.hp) return '通常BURSTで撃破できる';
    if(!p.impact.dealt) return '敵HPにダメージが通る盤が必要';
    if(p.steps.filter(step=>!step.card.enemy&&step.op).length<2) return '有効な演算が2枚以上必要';
    const before=this.enemyOutcome(),after=this.enemyOutcome(this.next,true);
    if(before.hp===after.hp&&before.ward===after.ward) return '防御だけで攻撃をしのげる';
    return '';
  }
  enemyOutcome(action=this.next,intercept=false) {
    let {hp,maxHp,drain,ward,deb}=this;
    let blocked=false,drawPenalty=0,energyPenalty=0;
    const hits=attackHits(action);
    const penalty=attackPatterns[action.kind]?.penalty;
    const intercepted=intercept&&hits>0?action.value:0;
    const attackDamage=action.value*hits-intercepted;
    const absorbed=Math.min(this.guardPoints,attackDamage);
    const guard=attackDamage>0?0:this.guardPoints;
    const hitDetails=[];
    let shield=this.guardPoints;
    for(let i=0;i<hits;i++) {
      const stopped=i===0&&intercepted>0;
      const defended=stopped?0:Math.min(shield,action.value);
      shield-=defended;
      const lost=stopped?0:Math.min(hp,action.value-defended);
      hp-=lost;
      hitDetails.push({stopped,defended,lost,hp,guardLeft:shield});
    }
    const broken=penalty==='shatter'&&!intercepted?Math.min(Number(ward)||0,2):0;
    if(!hits||penalty) {
      if(penalty==='shatter') {ward=Number(ward)-broken||false;}
      else if(ward) {ward=Number(ward)-1||false;blocked=true;}
      else if(penalty==='jam') drawPenalty=1;
      else if(penalty==='tax') energyPenalty=1;
      else if(penalty==='fracture') deb=[...deb,{...action,kind:'seal'}];
      else if(penalty==='scorch') deb=[...deb,{...action,kind:'sub',value:20*this.act}];
      else if(action.kind==='wither') {
        maxHp=Math.max(35,maxHp-action.value);
        hp=Math.min(hp,maxHp);
      } else if(action.kind==='drain') drain=Math.min(65,drain+action.value);
      else deb=[...deb,action];
    }
    return {hp,maxHp,drain,ward,guard,deb,blocked,absorbed,intercepted,drawPenalty,energyPenalty,hitDetails,broken};
  }
  holdPreview(outcome=this.enemyOutcome()) {
    if(this.holds>=2||!outcome.hp||!this.board.length) return null;
    const result=evaluate({base:this.baseAt(outcome.drain),board:this.board,deb:outcome.deb,owned:this.owned,armor:this.enemy.armor,holds:this.holds+1});
    return result.final;
  }
  enemyAction(intercept=false) {
    this.uncommittedCards.clear();
    const {hp,maxHp,drain,ward,guard,deb,drawPenalty,energyPenalty}=this.enemyOutcome(this.next,intercept);
    Object.assign(this,{hp,maxHp,drain,ward,guard,deb,drawPenalty,energyPenalty});
    this.turn++;
    if(!this.hp) this.phase='loss';
    else this.refill();
  }
  hold() {
    if(this.phase!=='battle'||this.holds>=2) return false;
    this.holds++;
    this.stats.turns++;
    this.enemyAction();
    return true;
  }
  burst(intercept=false) {
    if(this.phase!=='battle') return null;
    const p=this.preview();
    if(intercept) {
      if(this.interceptReason(p)) return null;
      const before=this.enemyOutcome(),after=this.enemyOutcome(this.next,true);
      this.energy--;
      this.interceptUsed=true;
      this.stats.intercepts=(this.stats.intercepts??0)+1;
      this.stats.prevented=(this.stats.prevented??0)+after.hp-before.hp;
    }
    this.stats.turns++;
    const formula=[String(this.base),...p.steps.map(s=>s.op?label(s.op):'無効'),...p.triggers.map(t=>relics[t.id].name),
      ...(this.enemy.armor>1?['装甲 ÷'+this.enemy.armor]:[])].join(' → ');
    this.lastBurst={...p,formula};
    this.history.unshift(this.lastBurst);
    this.history.length=Math.min(this.history.length,50);
    const s=this.stats;
    if(p.final>s.max) {s.max=p.final;s.formula=formula;}
    for(const c of p.factors) s[c.kind]=Math.max(s[c.kind],c.value);
    s.combo=Math.max(s.combo,this.board.length);
    s.infinity+=Number(p.final>CAP);
    if(p.impact.kind==='barrier') this.enemy.barrier-=p.impact.breaks;
    if(p.impact.kind==='gate') this.enemy.gates.shift();
    if(p.impact.dealt>0n&&p.final>this.battlePeak) this.battlePeak=p.final;
    this.enemy.hp-=p.impact.dealt;
    this.discard.push(...this.board);
    this.board=[];
    this.uncommittedCards.clear();
    this.deb=[];
    this.holds=0;
    if(!this.enemy.hp) {
      this.recent.push(this.battlePeak);
      if(this.recent.length>5) this.recent.shift();
      const boss=this.enemy.kind==='boss', elite=this.enemy.elite;
      if(boss) this.stats.bosses++;
      const hpBefore=this.hp;
      this.hp=Math.min(100,this.hp+(boss?28:elite?13:7)+this.bonus('victoryRecovery'));
      this.victoryHeal=this.hp-hpBefore;
      if(elite||boss||this.act===4) {
        this.relicDrop=drawRelic(this.rng,this.owned,this.act);
        if(this.relicDrop) {
          if(elite&&this.act<=2) {
            const alternatives=earlyRelicChoices.filter(id=>id!==this.relicDrop&&!this.owned.includes(id));
            const rewardRng=random(this.seed+'/relic/'+this.act+'/'+this.node.id);
            this.relicAlternative=alternatives[Math.floor(rewardRng()*alternatives.length)]??null;
          }
          this.relicDecision='pending';
        }
      }
      this.reward();
    } else this.enemyAction(intercept);
    return p;
  }
  reward() {
    this.phase='reward';
    this.omenDecision=this.act!==4&&random(this.seed+'/omen/reward/'+this.act+'/'+this.stage)()<(this.enemy.elite?.09:.025)?'pending':null;
    this.offers=this.act===4?[]:Array.from({length:3},()=>generate(this.rng,this.act,this.enemy.elite?17:5));
    if(this.offers.length) {
      const supportRng=random(this.seed+'/support/reward/'+this.stage);
      if(supportRng()<.34) this.offers[2]=generateSupport(supportRng,this.act,this.enemy.elite?17:5);
    }
    this.cardDecision={status:this.offers.length?'pending':'none'};
    this.goldReward=this.enemy.kind==='boss'?48:this.enemy.elite?40:24;
    this.goldDecision='pending';
  }
  get rewardPending(){
    return this.phase==='reward'&&(this.cardDecision.status==='pending'||this.goldDecision==='pending'||this.relicDecision==='pending'||this.omenDecision==='pending');
  }
  chooseOmen(take) {
    if(this.phase!=='reward'||this.omenDecision!=='pending') return false;
    this.omenDecision=take?'taken':'skipped';
    if(take) this.omens=(this.omens??0)+1;
    return true;
  }
  takeCard(i) {
    if(this.phase!=='reward'||this.cardDecision.status!=='pending'||!this.offers[i]) return false;
    const card=this.offers[i];
    this.deck.push(card);
    this.cardDecision={status:'taken',card};
    return true;
  }
  skipCard() {
    if(this.phase!=='reward'||this.cardDecision.status!=='pending') return false;
    this.cardDecision={status:'skipped'};
    return true;
  }
  chooseGold(take) {
    if(this.phase!=='reward'||this.goldDecision!=='pending') return false;
    if(take) this.gold+=this.goldReward;
    this.goldDecision=take?'taken':'skipped';
    return true;
  }
  chooseRelic(take,index=0) {
    if(this.phase!=='reward'||this.relicDecision!=='pending') return false;
    if(take) {
      const choice=[this.relicDrop,this.relicAlternative][index];
      if(!choice||this.owned.includes(choice)) return false;
      this.owned.push(choice);
      this.relicDrop=choice;
      this.relicAlternative=null;
    }
    this.relicDecision=take?'taken':'skipped';
    return true;
  }
  advance() {
    if(this.phase!=='reward'||this.rewardPending) return;
    if(this.act===4) {this.phase='win';return;}
    if(this.enemy.kind==='boss') {
      if(this.act===3) {this.phase='clear';return;}
      this.act++;
      this.beginMap();
    } else this.leaveNode();
  }
  extra(){
    if(this.phase!=='clear') return;
    this.act=4;
    this.start();
  }
  leaveNode(){
    this.phase='map';
    this.routes=this.node.next;
  }
  route(id) {
    if(this.phase!=='map'||!this.routes.includes(id)) return false;
    const node=this.map.flat().find(n=>n.id===id);
    this.node=node;
    this.visited.push(id);
    this.stage++;
    if(['fight','elite','boss'].includes(node.kind)) {this.start(node);return true;}
    this.phase='facility';
    this.facility=node.kind;
    if(node.kind==='shop') {
      this.shop=Array.from({length:4},()=>generate(this.rng,this.act,16));
      const supportRng=random(this.seed+'/support/shop/'+this.stage);
      this.shop[3]=generateSupport(supportRng,this.act,16);
      const first=drawRelic(this.rng,this.owned,this.act,{shop:true});
      const second=drawRelic(this.rng,[...this.owned,first],this.act,{shop:true});
      this.stockRelics=[first,second].filter(Boolean);
      this.shopUsed={relic:false,fuse:false,remove:false};
      this.shopOmen=random(this.seed+'/omen/shop/'+this.act+'/'+node.id)()<.14;
    }
    if(node.kind==='event') {
      const rng=random(this.seed+'/event-route');
      this.seenEvents??=[];
      const order=shuffle(Object.keys(events),rng);
      this.event=order.find(id=>!this.seenEvents.includes(id));
      if(!this.event) {
        this.seenEvents=[];
        this.event=order[0];
      }
      this.seenEvents.push(this.event);
    }
    return true;
  }
  get eventOffers(){
    const definition=events[this.event];
    if(!definition) return [];
    return [definition,...(definition.choices??[])].map((choice,index)=>{
      const hp=Math.min(100-this.hp,choice.hp||0);
      const gold=choice.gold||0;
      const key=this.seed+'/event/'+this.act+'/'+this.node.id;
      const rng=random(index?key+'/'+index:key);
      const result=choice.card?generate(rng,this.act,choice.card):
        choice.support?generateSupport(rng,this.act,choice.support,choice.kind):null;
      return {...choice,hp,gold,result,available:this.hp+hp>0&&this.gold+gold>=0};
    });
  }
  get eventOffer(){return this.eventOffers[0]??null;}
  service({action,i,j,mode,digit}={}) {
    if(this.phase!=='facility') return null;
    const facility=this.facility;
    if(facility==='event'&&['event','decline'].includes(action)) {
      if(action==='decline') {this.leaveNode();return {message:'イベントを見送った。'};}
      const offer=this.eventOffers[i??0];
      if(!offer?.available) return null;
      const {hp,gold,result,omen=0}=offer;
      this.hp+=hp;
      this.gold+=gold;
      if(omen) this.omens=(this.omens??0)+omen;
      if(result) this.deck.push(result);
      this.leaveNode();
      return {kind:'event',event:this.event,hp,gold,result,omen};
    }
    if(facility==='rest'&&action==='heal') {
      this.hp=Math.min(100,this.hp+35);this.leaveNode();return {message:'休息でHPを最大35回復。'};
    }
    if(facility==='rest'&&action==='forge') {
      const original=this.deck[i];
      const result=original&&upgraded(original,mode,digit);
      if(!result) return null;
      this.deck[i]=result;
      this.leaveNode();
      return {kind:'forge',sources:[original],result};
    }
    if(facility!=='shop'||!Object.hasOwn(prices,action)||this.gold<prices[action]||this.shopUsed[action]) return null;
    let transaction;
    if(action==='buy'&&this.shop[i]) {
      const result=this.shop[i];
      this.shop[i]=null;
      this.deck.push(result);
      transaction={kind:'shop',sources:[],result};
    } else if(action==='omen'&&this.shopOmen) {
      this.shopOmen=false;
      this.omens=(this.omens??0)+1;
      transaction={kind:'omen',sources:[]};
    } else if(action==='relic'&&this.stockRelics[i]) {
      const relic=this.stockRelics[i];
      this.owned.push(relic);
      transaction={kind:'relic',relic,sources:[]};
    } else if(action==='fuse'&&i!==j&&this.deck.length>12) {
      const sources=[this.deck[i],this.deck[j]];
      const result=fused(...sources);
      if(!result) return null;
      this.deck[Math.min(i,j)]=result;
      this.deck.splice(Math.max(i,j),1);
      transaction={kind:'fuse',sources,result};
    } else if(action==='remove'&&Number.isInteger(i)&&this.deck[i]&&this.deck.length>12) {
      transaction={kind:'remove',sources:this.deck.splice(i,1)};
    }
    if(!transaction) return null;
    this.gold-=prices[action];
    if(action!=='buy') this.shopUsed[action]=true;
    return {...transaction,price:prices[action]};
  }
  summary() {
    return {...this.stats,max:String(this.stats.max),stage:this.stage,seed:this.seed,
      outcome:this.phase,deck:[...this.deck],relics:[...this.owned]};
  }
}
