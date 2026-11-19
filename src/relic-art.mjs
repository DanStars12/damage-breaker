import {relics} from './relics.mjs';

// Sixteen-pixel frames with individually drawn eight-pixel relic silhouettes.
const relicPixels=[
'3c 7e 5a 7e 5a 7e 3c 00', '3c 66 42 5a 5a 42 66 3c',
'18 3c 76 ff 6e 3c 18 00', '00 3c 66 c3 c3 66 3c 00',
'18 3c 7e ff 7e 3c 18 00', '30 78 78 3e 0e 0a 00 00',
'7e 42 3c 18 18 3c 42 7e', '18 34 3a 76 7e 66 3c 00',
'7e 5a 5a 7e 5a 5a 7e 00', '3c 7e ff c3 db db ff 7e',
'18 5a 18 7e 18 3c 66 00', '42 66 7e 3c 3c 18 18 00',
'18 3c 66 c3 ff 81 ff 00', '7e 42 7e 5a 7e 5a 42 7e',
'3c 66 db 99 db 66 3c 00', '66 ff bd 7e 3c 7e 66 00',
'3c 7e db ff 66 3c 18 00', '7e 42 5a 5a 42 7e 00 00',
'24 24 66 7e 3c 18 18 7e', '42 24 18 ff 18 24 42 00',
'03 07 0e 1c 38 70 e0 c0', '18 3c 3c 7e 42 7e 18 00',
'3c 7e 7e 3c 18 0c 06 00', '80 c0 e0 ff 3e 1c 08 00',
'06 0f 1e 3c 78 30 60 80', '18 3c 24 24 66 ff 18 00',
'7e 7c 78 70 38 1c 0e 06', '0c 18 38 3c 7e 7e 3c 00',
'00 fc 7e 3c 18 7e 7e 00', '18 3c 66 3c 18 30 60 00',
'38 44 9e a1 85 79 22 1c', '18 18 3c 66 66 7e 18 7e',
'18 18 18 3c 7e 7e 3c 00', '00 07 1e 3c 70 e0 c0 00',
'81 c3 e7 ff 7e 7e 00 00', '18 3c 3c 3c 7e ff 18 00',
'18 3c 7e db ff 7e 3c 18', '3c 66 db ff db 66 3c 00',
'3c 3c 7e ff db 18 18 00', '18 5a 7e 3c 3c 7e 5a 18',
'7e 66 7e 3c 3c 18 18 00','66 ff ff 7e 3c 18 00 00',
'81 c3 66 3c 18 3c 5a 00','18 18 7e 5a 5a ff 18 00',
'3c 7e e7 c3 db 7e 18 00','e7 c3 c3 c3 c3 7e 3c 00',
'7c c6 9e 82 ba c6 7c 08','42 67 7e 99 ff 76 3c 00',
'70 f8 70 18 0c 06 03 00','7e c3 a5 bd a5 7e 18 00',
'03 4e dc f8 18 3c 60 00','06 1a 32 64 fc 78 30 00',
'18 76 c3 a5 99 c3 6e 18','c3 66 3c 66 c3 66 3c 00',
'ff 81 42 24 18 24 42 ff','20 70 18 0c 1e 33 61 00',
'c0 e0 f0 78 3c 1e 0f 07','81 a5 a5 99 99 a5 a5 81',
'18 18 3c 66 5a 42 3c 00','e7 81 89 99 99 89 81 e7',
'76 54 7c 18 38 2a 6e 00','92 b6 fe 54 38 38 7c 00',
'18 3c 7e db 24 66 ff 00','81 43 27 1e 78 38 18 00',
'03 07 0e 5c 38 75 e0 00','18 3c 66 5a a5 66 3c 18',
'7c c6 ca 82 92 9a 7c 00','7e 42 5a 66 66 5a 42 7e',
'18 3c 66 18 00 66 ff 66','3c 7e 42 99 a5 c3 7e 3c',
'18 7e 42 5a 66 7e 3c 00','7e 62 4e 46 72 42 7e 00',
'66 ff c3 a5 99 42 3c 18','18 3c 18 18 3c 66 7e 3c','0e 12 36 6c d8 70 20 00'
];
const rankInk=['#90d3ad','#85c9ff','#df9df5','#ffd379'];
const relicIds=Object.keys(relics);
export function relicIcon(id) {
  const index=relicIds.indexOf(id);
  if(index<0) return '';
  const color=rankInk[relics[id].rank];
  const pixels=relicPixels[index].split(' ').flatMap((row,y)=>Array.from({length:8},(_,x)=>
    Number.parseInt(row,16)&(128>>x)?'M'+(x+4)+' '+(y+4)+'h1v1h-1z':'')).join('');
  return `<svg class="relic-icon" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">
    <path fill="#121622" d="M2 0h12v2h2v12h-2v2H2v-2H0V2h2z"/>
    <path fill="${color}" opacity=".52" d="M2 1h12v1H2zm0 13h12v1H2zM1 2h1v12H1zm13 0h1v12h-1z"/>
    <path fill="#050810" transform="translate(1 1)" d="${pixels}"/>
    <path fill="${color}" d="${pixels}"/>
    <path fill="#fff5d5" d="M3 3h1v1H3zm9 9h1v1h-1z"/></svg>`;
}
