const normalSpecs=[
  [['アッシュランタン','lantern','attack','sub'],['ラストテンプラー','knight','attack','div'],['グレイヴハウンド','hound','double','attack'],
   ['エンバーウィスプ','wisp','sub','flare'],['ブラススカラベ','beetle','attack','fracture'],['ラビリンスレイス','specter','pct','attack'],
   ['コバルトレイヴン','wyrm','jam','double'],['ルーンバック','beetle','sub','cleave']],
  [['セヴラ・オラクル','specter','div','attack'],['ヴェイルガード','knight','lock:add','attack'],['ジオードスカラベ','beetle','attack','div'],
   ['ミストファング','hound','pursuit','pct'],['アズールウィスプ','wisp','drain','jam'],['ルクス・ライブラリアン','lantern','attack','sub'],
   ['ムーンシルフ','moth','dust','pct'],['フロストジャッカル','hound','drain','double']],
  [['アストラヴォア','specter','pct','attack'],['ファントムドラグーン','knight','attack','double'],['ノクスウィスプ','wisp','lock:pct','attack'],
   ['スターフラクチャー','beetle','div','fracture'],['アンブラハウンド','hound','double','sub'],['エーテルゲートキーパー','lantern','drain','tax'],
   ['ゼノフォージ','golem','tax','meteor'],['ヴェスパーラミア','specter','lock:exp','double']]
];
const monsterForms=[['golem','hydra','wyrm','mantis'],['behemoth','golem','mantis','leviathan'],['hydra','idol','wyrm','moth']];
const bossForms=[['titan','leviathan','behemoth'],['colossus','moth','hydra'],['dragon','eclipse','titan']];
const eliteSpecs=[
  [
    ['グラニト・タイタン',1,'衝撃波で三段追撃。','pursuit','attack','sub'],
    ['クリオヒュドラ',3,'加算を封じ、基礎値も冷却する。','lock:add','drain','attack'],
    ['サンドクロノス',0,'基礎値を半減し、除算を差し込む。','drain','attack','div'],
    ['カルサイト・レイパー',0,'局所封印と斬撃で術式を崩す。','fracture','cleave','double']
  ],[
    ['ヴォイドベヒモス',7,'BURSTを1回だけ無効化する。', 'attack','div','double','barrier'],
    ['シジルゴーレム',4,'乗算を封じ、基礎値を削ぐ。','lock:mul','drain','attack'],
    ['ルビーミラーマンティス',2,'割合妨害と三段追撃を使う。','pct','pursuit','attack'],
    ['グレイシャル・ナルヴァ',0,'魔力を徴収し、潮撃で追い詰める。','tax','wave','div','barrier']
  ],[
    ['アンチアストラ・ヒュドラ',6,'累乗を封じ、強い除算を差し込む。','lock:pow','div','double','attack'],
    ['デヴォーラ・イドル',5,'回復可能な範囲でHPを直接削り、基礎値を弱める。','wither','drain','double','attack'],
    ['ジェミニワーム',9,'BURSTを1回無効化し、指数を封じる。','lock:exp','pursuit','attack','barrier'],
    ['ネビュラ・モス',0,'割合を封じ、燐粉で次のドローを減らす。','lock:pct','dust','wither','double']
  ]
];
const bossSpecs=[
  [
    ['オブシディアン・デューク',2,'開幕バリアが攻撃を2回無効化する。','cleave','sub','pursuit','barrier2'],
    ['テラヴォア・リヴァイアサン',5,'基礎値を半減し、加算を封じる。','drain','wave','lock:add','double'],
    ['ヴァルグリム・ベヒモス',0,'HP半分で耐える。潮撃と三段追撃を使う。','wave','pursuit','sub','gate2']
  ],[
    ['リブラ・コロッサス',5,'HP半分で耐える。撃破には最低2回の有効BURSTが必要。','pct','meteor','drain','double','gate2'],
    ['ルナリア・モスクイーン',3,'乗算と割合を交互に封じ、基礎値も削ぐ。','lock:mul','dust','lock:pct','drain','double'],
    ['セレスティア・ヒュドラ',0,'開幕の無効バリアと割合妨害を使う。','pct','flare','meteor','barrier']
  ],[
    ['アエテル・ドラゴンロード',8,'HPの⅔と⅓で耐える。最低3回の有効BURSTが必要。','div','double','drain','flare','gate3'],
    ['エクリプス・エンペラー',9,'2回の無効バリアに加え、最大HPを削る吸命と累乗封印を使う。','wither','lock:pow','double','eclipse','barrier2'],
    ['アストラ・グラーヴェ',0,'HPの⅔と⅓で耐え、指数を封じて隕鉄を落とす。','lock:exp','meteor','tax','cleave','gate3']
  ]
];
const normalFloors=[330n,320000n,10n**11n];
const eliteFloors=[1800n,6000000n,10n**13n];
const bossFloors=[32000n,1500000000n];
const bossAttack=[12,18,25];
const finalBossBalance=[
  {floor:4n*10n**18n, scaleDivisor:3n, armor:2, attack:16},
  {floor:3n*10n**18n, scaleDivisor:4n, armor:2, attack:19},
  {floor:4n*10n**18n, scaleDivisor:3n, armor:2, attack:19}
];
export const operationNames={add:'加算',mul:'乗算',pct:'割合',pow:'累乗',exp:'指数'};
const extraEnemyName='エコー・オブ・インフィニティ';
const encounterSpecs={fight:normalSpecs,elite:eliteSpecs,boss:bossSpecs};
export const encounterCount=(act,kind)=>encounterSpecs[kind]?.[act-1]?.length??0;

// Keep the original palette IDs stable for older checkpoints.
const expansionPalettes={fight:[[18,19],[22,23],[26,27]],elite:[[20],[24],[28]],boss:[[21],[25],[29]]};
const originalCounts={fight:6,elite:3,boss:2};

export function encounterName(act,kind,variant) {
  if(act===4&&kind==='extra') return extraEnemyName;
  return encounterSpecs[kind]?.[act-1]?.[variant]?.[0];
}
export function makeEnemy(act,kind,variant,row,bench=0n) {
  if(act===4) return {name:extraEnemyName,title:'EXTRA',detail:'耐久段階を越えて無限を破る。',art:{form:'eclipse',palette:17},kind:'extra',
    hp:10n**31n,max:10n**31n,attack:21,armor:5,barrier:0,gates:[5n*10n**30n],cycle:['div','attack','drain','double']};
  const a=act-1, elite=kind==='elite', boss=kind==='boss';
  const spec=elite?eliteSpecs[a][variant]:boss?bossSpecs[a][variant]:null;
  const [normalName,normalForm,...normalMoves]=normalSpecs[a][variant];
  const [name,,detail,...moves]=spec||[normalName,0,'',...normalMoves,'attack'];
  const form=boss?bossForms[a][variant]:elite?monsterForms[a][variant]:normalForm;
  const palette=expansionPalettes[kind][a][variant-originalCounts[kind]]??a*6+variant;
  const art={form,palette};
  const trait=moves.at(-1);
  if(trait.startsWith('barrier')||trait.startsWith('gate')) moves.pop();
  const balance=boss&&act===3?finalBossBalance[variant]:null;
  const floor=elite?eliteFloors[a]*BigInt(Math.max(1,row-1)):boss?(balance?.floor??bossFloors[a]):normalFloors[a]*BigInt(1+row*2);
  const target=bench/(balance?.scaleDivisor??(boss?2n:elite?4n:7n));
  const max=target>floor?(target>floor*400n?floor*400n:target):floor;
  const gates=trait==='gate2'?[max/2n]:trait==='gate3'?[max*2n/3n,max/3n]:[];
  return {name,art,detail,kind,variant,elite,title:boss?'ACT BOSS':elite?'DEFLATION ENEMY':'ENCOUNTER',
    hp:max,max,armor:balance?.armor??(1+a),attack:boss?(balance?.attack??bossAttack[a]):5+a*3+(elite?3:0),barrier:trait==='barrier2'?2:trait==='barrier'?1:0,gates,cycle:moves};
}
export const attackPatterns={
  attack:{name:'通常攻撃',hits:1},double:{name:'二連撃',hits:2},
  cleave:{name:'黒鉄の斬撃',hits:1},wave:{name:'深淵の潮撃',hits:1},
  meteor:{name:'天秤の隕鉄',hits:1},dust:{name:'月蛾の燐粉',hits:1,penalty:'jam'},
  flare:{name:'竜炎の刻印',hits:1,penalty:'scorch'},eclipse:{name:'日蝕の落雷',hits:1},
  pursuit:{name:'三段追撃',hits:3},jam:{name:'幻霧',penalty:'jam'},
  tax:{name:'魔力徴収',penalty:'tax'},fracture:{name:'局所封印',penalty:'fracture'}
};
export const attackHits=move=>attackPatterns[move.kind]?.hits??0;
export function intent(enemy,turn,act) {
  const [kind,target]=enemy.cycle[turn%enemy.cycle.length].split(':');
  const values={attack:enemy.attack,double:Math.ceil(enemy.attack*.65),wither:8+act*2,drain:50,
    div:[2,4,8,10][act-1],pct:-20-act*5,sub:20*act,
    cleave:enemy.attack,wave:enemy.attack,meteor:enemy.attack,eclipse:enemy.attack,
    dust:Math.floor(enemy.attack*.67),flare:Math.floor(enemy.attack*.88),pursuit:Math.round(enemy.attack*.42)};
  return {kind,...(target?{target}:{}),value:values[kind]??0,at:1+turn%2,enemy:true};
}
export function impact(enemy,damage) {
  if(damage<=0n) return {dealt:0n,kind:'miss'};
  if(enemy.barrier) return {dealt:0n,kind:'barrier'};
  const gate=enemy.gates[0];
  if(gate!==undefined&&enemy.hp-damage<=gate) return {dealt:enemy.hp-gate,kind:'gate'};
  return {dealt:damage>enemy.hp?enemy.hp:damage,kind:'hit'};
}
