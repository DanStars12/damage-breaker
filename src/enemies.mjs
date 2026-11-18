const normalSpecs=[
  [['灰の番人','lantern','attack','sub'],['錆びた典礼騎士','knight','attack','div'],['煙墓の猟犬','hound','double','attack'],
   ['火花の精','wisp','sub','attack'],['黄銅の甲虫','beetle','attack','pct'],['迷路の甲冑霊','specter','pct','attack']],
  [['割算の巫女','specter','div','attack'],['禁書の近衛','knight','lock:add','attack'],['鉱脈の甲虫','beetle','attack','div'],
   ['霧裂きの牙獣','hound','double','pct'],['青焔の漂霊','wisp','drain','attack'],['書庫の灯守','lantern','attack','sub']],
  [['星喰いの司祭','specter','pct','attack'],['虚数の竜騎士','knight','attack','double'],['虚光の散霊','wisp','lock:pct','attack'],
   ['裂星の大甲虫','beetle','div','attack'],['影渡りの猟獣','hound','double','sub'],['無数灯の門番','lantern','drain','attack']]
];
const monsterForms=[['golem','hydra','wyrm'],['behemoth','golem','mantis'],['hydra','idol','wyrm']];
const bossForms=[['titan','leviathan'],['colossus','moth'],['dragon','eclipse']];
const eliteSpecs=[
  [
    ['鉄槌の巌巨人',1,'衝撃波で二連打。','double','attack','sub'],
    ['霜印の三頭竜',3,'加算を封じ、基礎値も冷却する。','lock:add','drain','attack'],
    ['砂刻の大蛇',0,'基礎値を半減し、除算を差し込む。','drain','attack','div']
  ],[
    ['欠数の獣',7,'BURSTを1回だけ無効化する。', 'attack','div','double','barrier'],
    ['虚算の封石巨人',4,'乗算を封じ、基礎値を削ぐ。','lock:mul','drain','attack'],
    ['赤鏡の大鎌蟷螂',2,'二連撃と割合妨害を交互に使う。','pct','double','attack']
  ],[
    ['逆星の三頭竜',6,'累乗を封じ、強い除算を差し込む。','lock:pow','div','double','attack'],
    ['無価の食人巨像',5,'回復可能な範囲でHPを直接削り、基礎値を弱める。','wither','drain','double','attack'],
    ['二重影の飛蛇',9,'BURSTを1回無効化し、指数を封じる。','lock:exp','double','attack','barrier']
  ]
];
const bossSpecs=[
  [
    ['黒曜の公爵・城喰',2,'開幕バリアが攻撃を2回無効化する。','attack','sub','double','barrier2'],
    ['喰算の地殻獣',5,'基礎値を半減し、加算を封じる。','drain','attack','lock:add','double']
  ],[
    ['天秤の終末巨像',5,'HP半分で耐える。撃破には最低2回の有効BURSTが必要。','pct','attack','drain','double','gate2'],
    ['白紙の月蛾女王',3,'乗算と割合を交互に封じ、基礎値も削ぐ。','lock:mul','attack','lock:pct','drain','double']
  ],[
    ['無量門の王竜',8,'HPの⅔と⅓で耐える。最低3回の有効BURSTが必要。','div','double','drain','attack','gate3'],
    ['星蝕の虚空皇帝',9,'2回の無効バリアに加え、最大HPを削る吸命と累乗封印を使う。','wither','lock:pow','double','attack','barrier2']
  ]
];
const normalFloors=[330n,320000n,10n**11n];
const eliteFloors=[1800n,6000000n,10n**13n];
const bossFloors=[32000n,1500000000n];
const bossAttack=[12,18,25];
const finalBossBalance=[
  {floor:8n*10n**18n, scaleDivisor:2n, armor:3},
  {floor:5n*10n**18n, scaleDivisor:3n, armor:2}
];
export const operationNames={add:'加算',mul:'乗算',pct:'割合',pow:'累乗',exp:'指数'};
export function makeEnemy(act,kind,variant,row,bench=0n) {
  if(act===4) return {name:'無限の残響',title:'EXTRA',detail:'耐久段階を越えて無限を破る。',art:{form:'eclipse',palette:17},kind:'extra',
    hp:10n**31n,max:10n**31n,attack:21,armor:5,barrier:0,gates:[5n*10n**30n],cycle:['div','attack','drain','double']};
  const a=act-1, elite=kind==='elite', boss=kind==='boss';
  const spec=elite?eliteSpecs[a][variant]:boss?bossSpecs[a][variant]:null;
  const [normalName,normalForm,...normalMoves]=normalSpecs[a][variant%6];
  const [name,,detail,...moves]=spec||[normalName,0,'',...normalMoves,'attack'];
  const form=boss?bossForms[a][variant]:elite?monsterForms[a][variant]:normalForm;
  const art={form,palette:a*6+variant};
  const trait=moves.at(-1);
  if(trait.startsWith('barrier')||trait.startsWith('gate')) moves.pop();
  const balance=boss&&act===3?finalBossBalance[variant]:null;
  const floor=elite?eliteFloors[a]*BigInt(Math.max(1,row-1)):boss?(balance?.floor??bossFloors[a]):normalFloors[a]*BigInt(1+row*2);
  const target=bench/(balance?.scaleDivisor??(boss?2n:elite?4n:7n));
  const max=target>floor?(target>floor*400n?floor*400n:target):floor;
  const gates=trait==='gate2'?[max/2n]:trait==='gate3'?[max*2n/3n,max/3n]:[];
  return {name,art,detail,kind,elite,title:boss?'ACT BOSS':elite?'DEFLATION ENEMY':'ENCOUNTER',
    hp:max,max,armor:balance?.armor??(1+a),attack:boss?bossAttack[a]:5+a*3+(elite?3:0),barrier:trait==='barrier2'?2:trait==='barrier'?1:0,gates,cycle:moves};
}
export function intent(enemy,turn,act) {
  const [kind,target]=enemy.cycle[turn%enemy.cycle.length].split(':');
  const values={attack:enemy.attack,double:Math.ceil(enemy.attack*.65),wither:8+act*2,drain:50,
    div:[2,4,8,10][act-1],pct:-20-act*5,sub:20*act};
  return {kind,...(target?{target}:{}),value:values[kind]??0,at:1+turn%2,enemy:true};
}
export function impact(enemy,damage) {
  if(damage<=0n) return {dealt:0n,kind:'miss'};
  if(enemy.barrier) return {dealt:0n,kind:'barrier'};
  const gate=enemy.gates[0];
  if(gate!==undefined&&enemy.hp-damage<=gate) return {dealt:enemy.hp-gate,kind:'gate'};
  return {dealt:damage>enemy.hp?enemy.hp:damage,kind:'hit'};
}
