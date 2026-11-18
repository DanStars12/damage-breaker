import {readFileSync,writeFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const game=['math','relics','cards','events','map','enemies','run','storage','checkpoint','art','sprites','faces','bestiary','presentation','ui']
  .map(name=>read('./src/'+name+'.mjs').replace(/^import .*;\n/gm,'')
    .replace(/^export /gm,'')).join('\n');
const page=read('./index.template.html').replace('/* STYLES */',()=>read('./style.css'))
  .replace('/* GAME */',()=>"'use strict';\n(()=>{\n"+game+'\n})();');
writeFileSync(new URL('./index.html',import.meta.url),page);
