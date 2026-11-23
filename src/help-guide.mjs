// Compact, self-contained help copy. Rules are synchronized with Run, cards and enemies.
// No event listeners or game-state mutations: native <details> keeps the guide accessible.
const section=(title,body,open=false)=>`<details class="guide-section" ${open?'open':''}>
  <summary>${title}</summary><div class="guide-section-body">${body}</div></details>`;

export function helpGuide() {
  return `<div class="guide">
    <p class="guide-lead">演算カードを<strong>左から順に計算</strong>し、大きなダメージを作るターン制ローグライトです。敵の予告を見ながらカードを組み、ACT IIIのボス、その先のEXTRAを目指します。</p>
    <div class="guide-quick" aria-label="まず覚える3つのこと">
      <div><b>① 置く</b><small>手札を選び、演算盤に配置</small></div>
      <div><b>② 比べる</b><small>HOLDとBURST、敵の次の行動を確認</small></div>
      <div><b>③ 発動</b><small>BURSTで攻撃。報酬で強化</small></div>
    </div>
    ${section('01 · まずは1戦をプレイする',`
      <ol class="guide-steps">
        <li><b>地図で次のマスを選ぶ</b><span>光っているマスを選択。戦闘、強敵、店、休息、イベント、ボスなどがあります。</span></li>
        <li><b>手札を演算盤に並べる</b><span>カードを押すと右端に配置。並び順を変えると、同じカードでも火力が変わります。置ける枚数とエネルギーに注意。</span></li>
        <li><b>画面の予測を見る</b><span>「最終ダメージ予測」「敵HP −○○」と「敵の次の行動」を確認。敵のバリアなどがある場合、計算上のダメージがそのまま敵HPに通るとは限りません。</span></li>
        <li><b>HOLDかBURSTを決める</b><span><strong>HOLD</strong>は盤を残して次の手札へ。<strong>BURST</strong>は今の盤で攻撃します。どちらでも、敵が生き残れば予告どおり行動します。</span></li>
        <li><b>勝利したら報酬を選ぶ</b><span>カード・金貨・レリックなどでデッキを強くします。地図の先へ進み、ボスに備えましょう。</span></li>
      </ol>
      <p class="guide-tip"><b>最初のコツ：</b>まずは「＋」を置いてから「×」を置いてBURSTしてみましょう。序盤は1回のBURSTで倒すか、安全にHOLDできるかを見比べるのがおすすめです。</p>
    `,true)}
    ${section('02 · 演算の順番とカードの種類',`
      <p>戦闘開始時の基本は<strong>基礎値20・手札5枚・エネルギー3・盤6枠</strong>（ACT I、強化なし）。カードには消費エネルギーがあり、盤に並べられる枚数にも上限があります。</p>
      <div class="guide-equation" aria-label="演算例：20に10を足して3倍すると90">
        <span class="guide-base">基礎 20</span><span class="guide-arrow">→</span>
        <span class="guide-add">＋10</span><span class="guide-arrow">→</span>
        <span class="guide-mul">×3</span><span class="guide-arrow">＝</span>
        <strong>90</strong>
      </div>
      <p><b>順番が重要：</b>20 → ×3 → ＋10 なら <strong>70</strong>。同じ2枚でも置く順序で変化します。</p>
      <dl class="guide-terms">
        <div><dt>＋10（加算）</dt><dd>今の値に10を足す。乗算や累乗の前に置くと効果を伸ばせます。</dd></div>
        <div><dt>×3（乗算）</dt><dd>今の値を3倍。加算の後に置くと加算分もまとめて増えます。</dd></div>
        <div><dt>＋50% / −25%（割合）</dt><dd>その時点の値を1.5倍 / 0.75倍。90 → ＋50% なら135。</dd></div>
        <div><dt>x² / x³（累乗）</dt><dd>今の値を2乗 / 3乗。たとえば10 → x² なら100。</dd></div>
        <div><dt>×10²（指数）</dt><dd>今の値を100倍。たとえば90 → ×10² なら9000。</dd></div>
      </dl>
      <p class="guide-tip">演算の途中ではマイナスや小数も正確に扱います。最終的なダメージは装甲の除算後に小数点以下を切り捨て、負の値なら0です。</p>
    `)}
    ${section('03 · HOLDとBURSTの違い',`
      <div class="guide-pair">
        <div><h3>HOLD · ためる</h3><p>今の演算盤を<strong>そのまま残す</strong>。敵の予告行動を受けてからエネルギーと新しい手札を補充します。</p><small>通常はBURSTまでに2回まで。レリックで上限が増えることもあります。</small></div>
        <div><h3>BURST · 攻撃する</h3><p>左からすべて演算し、レリック・装甲を反映して攻撃。<strong>盤のカードは消費</strong>され、HOLD回数はリセットされます。</p><small>敵を倒せば反撃なし。倒せなければ予告行動を受けて次の手札へ。</small></div>
      </div>
      <p><b>迷ったら：</b>手札の下の「HOLD / BURST 比較」を見ましょう。予測残HPや撃破可否が表示されます。「行動後の詳細予測」を開くと、バリア・耐久ライン・反撃後のHPも確認できます。</p>
      <p class="guide-warning">敵の攻撃で倒される状況では、火力が足りなくてもHOLDが安全とは限りません。予測欄の赤い表示を確認しましょう。</p>
    `)}
    ${section('04 · 敵の予告、減衰、防御の使い方',`
      <p>敵は次の攻撃・妨害を先に表示します。<strong>HOLD後</strong>、または<strong>BURSTで敵が残った後</strong>に発動します。敵の予告を見て、守るか倒し切るかを決めましょう。</p>
      <dl class="guide-terms">
        <div><dt>防御カード</dt><dd>その次に受ける攻撃ダメージを数値分軽減。多段攻撃ではヒット順に使われます。</dd></div>
        <div><dt>結界カード</dt><dd>敵の妨害を1回分（強化後は複数回）防ぎます。破界攻撃では結界が壊される場合があります。HPへの攻撃自体を無効にするものではありません。</dd></div>
        <div><dt>浄化カード</dt><dd>演算盤に入った妨害を先頭側から取り除きます。妨害がなければ使えません。</dd></div>
        <div><dt>反撃減衰</dt><dd>敵の予告欄で指定される順序の<strong>有効な演算2枚を隣接</strong>させてBURSTすると、敵が生き残ったときの攻撃・妨害を弱めます。</dd></div>
      </dl>
      <div class="guide-pair guide-pair-examples">
        <div><b>攻撃する敵</b><span>＋（加算）→ ×（乗算）</span></div>
        <div><b>妨害だけの敵</b><span>×（乗算）→ ＋（加算）</span></div>
      </div>
      <p class="guide-tip">反撃減衰は通常、1戦で1回だけ成立します。封印されたカードや敵が挿入した妨害カードは、成立条件の「有効な2枚」として数えません。</p>
    `)}
    ${section('05 · バリア、耐久ライン、妨害',`
      <dl class="guide-terms">
        <div><dt>敵のバリア</dt><dd>正のダメージを出すBURSTでも敵HPは減りません。まずバリアを削り、次のBURSTで本体へ攻撃。特定のレリックで複数層を壊せます。</dd></div>
        <div><dt>耐久ライン</dt><dd>ボスなどのHPが一定位置で止まる仕組み。強力なBURSTでも<strong>1回で突破できるラインは1本</strong>です。次のBURSTで続けましょう。</dd></div>
        <div><dt>演算妨害</dt><dd>敵は「−」「÷」「−%」を指定位置に挿入したり、カードの種類を封印したりします。演算盤の赤い表示や次の予告を確認。</dd></div>
        <div><dt>吸命・弱体</dt><dd>戦闘中の最大HPや基礎値を減らします。長引く戦闘ほど危険なので、素早く倒すか防御を活用。</dd></div>
      </dl>
      <p>「最終ダメージ予測」は式から求めた値、「敵HP −○○」はバリアや耐久ラインを考慮して実際に減るHPです。数字が違っても不具合ではありません。</p>
    `)}
    ${section('06 · レリック・エンチャント・育成',`
      <p><b>レリック</b>は持っているだけで条件に応じて発動する特殊能力です。連続する演算、合計、カードの順番、HOLD回数などで大きな倍率が得られます。戦闘中のレリック一覧と報酬の相性表示がビルド作りのヒントです。</p>
      <p><b>エンチャント</b>は演算カード1枚につける追加効果です。「再現」はそのカードの演算を2回行いますが、コンボは1枚として数えます。「蓄力」「招札」は配置時にエネルギー・ドローを増やし、配置が確定します。</p>
      <p><b>報酬</b>ではカードを追加するか見送り、金貨やレリックを獲得できます。<b>店・休息・工房</b>で強化、同系統カードの合成、不要カードの削除などを行いましょう。レリックの発見・取得状況は「図鑑」に保存されます。</p>
      <p><b>星詠みの頁</b>は今の手札・空き枠・エネルギーで高火力が狙える配置を提案します。自動でスペルを使うことはありません。改善が見つからなければ頁を消費しません。</p>
    `)}
    ${section('07 · PC・スマホでの操作と便利な機能',`
      <dl class="guide-terms">
        <div><dt>スマホ・タッチ操作</dt><dd>手札のカードをタップして配置。盤のカードをタップし「← 左へ」「右へ →」で順番変更。仮置き中なら「手札に戻す」も使えます。</dd></div>
        <div><dt>PC・マウス操作</dt><dd>手札をクリックして配置。ドラッグ＆ドロップで位置を指定したり、盤のカードを入れ替えたり、仮置きのカードを手札に戻したりできます。</dd></div>
        <div><dt>PC・キーボード操作</dt><dd>盤のカードにフォーカスして<strong>← / →</strong>で位置を変更、<strong>Delete</strong>で仮置きを手札に戻せます。</dd></div>
        <div><dt>仮置きと確定</dt><dd>通常の演算カードはHOLD / BURST前ならやり直せて、エネルギーも返却。防御などのスペル、蓄力・招札付きの配置、行動後のカードは取り消せません。</dd></div>
        <div><dt>保存・演出設定</dt><dd>探索は中断して続きから再開できます。設定で効果音の音量や演出速度を変更でき、BURST演出中はスキップも可能です。</dd></div>
      </dl>
    `)}
    ${section('08 · 大ダメージと∞について',`
      <p>高火力を目指すには、加算で数値を育て、乗算や割合で伸ばし、強力な累乗・指数・レリックを組み合わせます。ただし、理想の式を追いすぎて敵の攻撃を受け切れないと負けてしまいます。</p>
      <p>最大の数値表示は<strong>9999無量大数（9999 × 10<sup>68</sup>）</strong>。これを超える最終ダメージは<strong>∞</strong>と表示します。∞でも敵のバリア・耐久ラインは有効です。</p>
      <p>記録帳には最大ダメージや探索履歴、図鑑には出会った敵とレリックが残ります。「数字の単位・読み方」で大きな数の読み方も確認できます。</p>
    `)}
    <p class="guide-foot">読みたい見出しを押すと説明を開閉できます。最初は「01 → 02 → 03」の順に読めば十分です。</p>
  </div>`;
}
