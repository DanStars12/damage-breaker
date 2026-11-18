const key='damage-breaker.v01';
export function load() {
  try {
    const data=JSON.parse(localStorage.getItem(key));
    if(data&&/^\d+$/.test(data.best?.max??'')&&Array.isArray(data.runs))
      return {...data,prefs:data.prefs||{}};
  } catch {}
  return {best:{max:'0'},runs:[],prefs:{}};
}
export function save(data) {
  try {localStorage.setItem(key,JSON.stringify(data));return true;}
  catch {return false;}
}
