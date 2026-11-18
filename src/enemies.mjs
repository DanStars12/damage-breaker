const normalSpecs=[
  [['アッシュランタン','lantern','attack','sub'],['ラストテンプラー','knight','attack','div'],['グレイヴハウンド','hound','double','attack'],
   ['エンバーウィスプ','wisp','sub','attack'],['ブラススカラベ','beetle','attack','pct'],['ラビリンスレイス','specter','pct','attack']],
  [['セヴラ・オラクル','specter','div','attack'],['ヴェイルガード','knight','lock:add','attack'],['ジオードスカラベ','beetle','attack','div'],
   ['ミストファング','hound','double','pct'],['アズールウィスプ','wisp','drain','attack'],['ルクス・ライブラリアン','lantern','attack','sub']],
  [['アストラヴォア','specter','pct','attack'],['ファントムドラグーン','knight','attack','double'],['ノクスウィスプ','wisp','lock:pct','attack'],
   ['スターフラクチャー','beetle','div','attack'],['アンブラハウンド','hound','double','sub'],['エーテルゲートキーパー','lantern','drain','attack']]
];
const monsterForms=[['golem','hydra','wyrm'],['behemoth','golem','mantis'],['hydra','idol','wyrm']];
const bossForms=[['titan','leviathan'],['colossus','moth'],['dragon','eclipse']];
const eliteSpecs=[
  [
    ['グラニト・タイタン',1,'衝撃波で二連打。','double','attack','sub'],
    ['クリオヒュドラ',3,'加算を封じ、基礎値も冷却する。','lock:add','drain','attack'],
    ['サンドクロノス',0,'基礎値を半減し、除算を差し込む。','drain','attack','div']
  ],[
    ['ヴォイドベヒモス',7,'BURSTを1回だけ無効化する。', 'attack','div','double','barrier'],
    ['シジルゴーレム',4,'乗算を封じ、基礎値を削ぐ。','lock:mul','drain','attack'],
    ['ルビーミラーマンティス',2,'二連撃と割合妨害を交互に使う。','pct','double','attack']
  ],[
    ['アンチアストラ・ヒュドラ',6,'累乗を封じ、強い除算を差し込む。','lock:pow','div','double','attack'],
    ['デヴォーラ・イドル',5,'回復可能な範囲でHPを直接削り、基礎値を弱める。','wither','drain','double','attack'],
    ['ジェミニワーム',9,'BURSTを1回無効化し、指数を封じる。','lock:exp','double','attack','barrier']
  ]
];
const bossSpecs=[
  [
    ['オブシディアン・デューク',2,'開幕バリアが攻撃を2回無効化する。','attack','sub','double','barrier2'],
    ['テラヴォア・リヴァイアサン',5,'基礎値を半減し、加算を封じる。','drain','attack','lock:add','double']
  ],[
    ['リブラ・コロッサス',5,'HP半分で耐える。撃破には最低2回の有効BURSTが必要。','pct','attack','drain','double','gate2'],
    ['ルナリア・モスクイーン',3,'乗算と割合を交互に封じ、基礎値も削ぐ。','lock:mul','attack','lock:pct','drain','double']
  ],[
    ['アエテル・ドラゴンロード',8,'HPの⅔と⅓で耐える。最低3回の有効BURSTが必要。','div','double','drain','attack','gate3'],
    ['エクリプス・エンペラー',9,'2回の無効バリアに加え、最大HPを削る吸命と累乗封印を使う。','wither','lock:pow','double','attack','barrier2']
  ]
];
const normalFloors=[330n,320000n,10n**11n];
const eliteFloors=[1800n,6000000n,10n**13n];
const bossFloors=[32000n,1500000000n];
const bossAttack=[12,18,25];
const finalBossBalance=[
  {floor:8n*10n**18n, scaleDivisor:2n, armor:3, attack:24},
  {floor:5n*10n**18n, scaleDivisor:3n, armor:2}
];
export const operationNames={add:'加算',mul:'乗算',pct:'割合',pow:'累乗',exp:'指数'};
const extraEnemyName='エコー・オブ・インフィニティ';
export function encounterName(act,kind,variant) {
  if(act===4&&kind==='extra') return extraEnemyName;
  const specs={fight:normalSpecs,elite:eliteSpecs,boss:bossSpecs};
  return specs[kind]?.[act-1]?.[variant]?.[0];
}
export function makeEnemy(act,kind,variant,row,bench=0n) {
  if(act===4) return {name:extraEnemyName,title:'EXTRA',detail:'耐久段階を越えて無限を破る。',art:{form:'eclipse',palette:17},kind:'extra',
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
    hp:max,max,armor:balance?.armor??(1+a),attack:boss?(balance?.attack??bossAttack[a]):5+a*3+(elite?3:0),barrier:trait==='barrier2'?2:trait==='barrier'?1:0,gates,cycle:moves};
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
