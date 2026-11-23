import {enemyCatalog,relicCatalog,catalogMoveName} from './catalog.mjs';
import {relicIcon} from './relic-art.mjs';
import {paintEnemy} from './bestiary.mjs';

export const codexPageSize=12;
const escapeCodex=value=>String(value).replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);
const kindNames={fight:'通常',elite:'強敵',boss:'ボス',extra:'EXTRA'};
export function codexContents(codex,{tab='enemies',filter='all',page=0,selected=null}={}) {
  const enemies=tab==='enemies',source=enemies?enemyCatalog:relicCatalog;
  const known=new Set(enemies?codex.enemies:codex.relics);
  const found=id=>known.has(id);
  const available=source.filter(entry=>{
    if(filter==='known') return found(entry.id);
    if(filter==='unknown') return !found(entry.id);
    if(enemies&&['fight','elite','boss','extra'].includes(filter)) return entry.kind===filter;
    if(!enemies&&/^rank[0-3]$/.test(filter)) return entry.rank===Number(filter[4]);
    return true;
  });
  const pages=Math.max(1,Math.ceil(available.length/codexPageSize));
  const activePage=Math.max(0,Math.min(pages-1,page));
  const visible=available.slice(activePage*codexPageSize,(activePage+1)*codexPageSize);
  const filterOptions=enemies?[
    ['all','すべて'],['known','遭遇済み'],['unknown','未遭遇'],
    ['fight','通常'],['elite','強敵'],['boss','ボス'],['extra','EXTRA']
  ]:[['all','すべて'],['known','取得済み'],['unknown','未取得'],
    ['rank0','コモン'],['rank1','レア'],['rank2','エピック'],['rank3','レジェンド']];
  const tiles=visible.map(entry=>{
    if(!found(entry.id)) return `<div class="codex-entry is-locked" aria-label="${enemies?'未遭遇の敵':'未取得のレリック'}">
      <div class="codex-art codex-placeholder" aria-hidden="true">?</div>
      <b>？？？</b><small>${enemies?'未遭遇':'未取得'}</small></div>`;
    const portrait=enemies?
      `<canvas data-codex-art="${entry.id}" width="88" height="64" aria-hidden="true"></canvas>`:
      relicIcon(entry.id);
    const category=enemies?`ACT ${entry.act===4?'EXTRA':entry.act} · ${kindNames[entry.kind]}`:entry.rankName;
    return `<button type="button" class="codex-entry is-known" data-codex-entry="${entry.id}"
      aria-pressed="${selected===entry.id}" aria-label="${escapeCodex(entry.name)}の詳細">
      <span class="codex-art">${portrait}</span><b>${escapeCodex(entry.name)}</b>
      <small>${escapeCodex(category)}</small></button>`;
  }).join('');
  const chosen=source.find(entry=>entry.id===selected&&known.has(entry.id));
  const detail=chosen?`<section class="codex-detail" role="region" aria-label="図鑑の詳細">
    <h3>${enemies?'敵':'レリック'} · ${escapeCodex(chosen.name)}</h3>
    ${enemies?`<p>${escapeCodex(chosen.detail||'演算を妨害する敵。予告された攻撃に注意。')}</p>
      <p><b>主な行動</b>　${escapeCodex([...new Set(chosen.moves.map(catalogMoveName))].join(' / '))}</p>
      <small>ACT ${chosen.act} · ${kindNames[chosen.kind]} · 装甲 ÷${chosen.armor}${chosen.barrier?' · 開幕バリア '+chosen.barrier+'層':''}${chosen.gates?' · 耐久ライン '+chosen.gates+'本':''}</small>`:
      `<p>${escapeCodex(chosen.description)}</p><small>${escapeCodex(chosen.rankName)} · 取得済み</small>`}
  </section>`:'';
  return `<div class="codex-shell">
    <div class="codex-tabs" role="tablist" aria-label="図鑑の種類">
      <button type="button" role="tab" data-codex-tab="enemies" aria-selected="${enemies}">敵図鑑　${codex.enemies.length}/${enemyCatalog.length}</button>
      <button type="button" role="tab" data-codex-tab="relics" aria-selected="${!enemies}">レリック図鑑　${codex.relics.length}/${relicCatalog.length}</button>
    </div>
    <div class="codex-toolbar">
      <label>表示 <select data-codex-filter aria-label="図鑑の絞り込み">${filterOptions.map(([value,name])=>
        `<option value="${value}" ${filter===value?'selected':''}>${name}</option>`).join('')}</select></label>
      <span>${enemies?'遭遇':'取得'} ${known.size} / ${source.length} · ${available.length}件表示</span>
    </div>
    <div class="codex-grid" role="tabpanel" aria-label="${enemies?'敵の一覧':'レリックの一覧'}">
      ${tiles||'<p class="muted">該当する記録はまだありません。</p>'}
    </div>
    ${detail}
    <div class="codex-pager">
      <button type="button" data-codex-page="${activePage-1}" ${activePage===0?'disabled':''} aria-label="図鑑の前のページ">‹ 前へ</button>
      <small>${activePage+1} / ${pages}</small>
      <button type="button" data-codex-page="${activePage+1}" ${activePage===pages-1?'disabled':''} aria-label="図鑑の次のページ">次へ ›</button>
    </div>
    <p class="codex-note">未発見の内容は隠されています。遭遇した敵、実際に入手したレリックが探索をまたいで記録されます。</p>
  </div>`;
}
export function paintCodexEntries(root) {
  for(const canvas of root.querySelectorAll('canvas[data-codex-art]')) {
    const entry=enemyCatalog.find(enemy=>enemy.id===canvas.dataset.codexArt);
    if(entry) paintEnemy(canvas,entry.art);
  }
}
