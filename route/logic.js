/* Week Router logic. Runs entirely on the device; no network calls here. */
(function(root){
"use strict";

/* ---------------- dates ---------------- */
const pad = n => String(n).padStart(2,"0");
const isoDay = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fromISO = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (iso,n) => { const d = fromISO(iso); d.setDate(d.getDate()+n); return isoDay(d); };
function mondayOf(iso){ const d = fromISO(iso); const k = (d.getDay()+6)%7; d.setDate(d.getDate()-k); return isoDay(d); }
const weekDays = mon => [0,1,2,3,4].map(i => addDays(mon,i));
const dow = iso => fromISO(iso).getDay(); // 1..5 Mon..Fri

/* ---------------- geography (approximate city centers) ---------------- */
/* City and ZIP locations are not built in: the page loads one file per state from the app's geo/ folder
   (see the shared places code) and hands each to loadGeo. The first state loaded wins a city name shared by two states. */
const CITIES = {}, ZIPS = {};
function loadGeo(d){
  if (!d) return;
  for (const k in (d.c || {})) if (!(k in CITIES)) CITIES[k] = d.c[k];
  for (const z in (d.z || {})) if (!(z in ZIPS)) ZIPS[z] = d.z[z];
}
const cityKey = s => String(s||"").toLowerCase().replace(/[^a-z ]+/g," ").replace(/\s+/g," ").trim();
function cityCoords(city, address, zip){
  // a ZIP places an office more closely than its town's centre
  const z = String(zip || "").match(/\b(\d{5})\b/) || String(address || "").match(/\b(\d{5})(?:-\d{4})?\s*$/);
  if (z && ZIPS[z[1]]) return ZIPS[z[1]];
  const k = cityKey(city);
  if (CITIES[k]) return CITIES[k];
  const hay = " " + cityKey((address||"") + " " + (city||"")) + " ";
  let best = null;
  for (const name in CITIES) if (hay.includes(" "+name+" ") && (!best || name.length > best.length)) best = name;
  return best ? CITIES[best] : null;
}
function km(a,b){
  if (!a || !b) return 0;
  const R=6371, r=Math.PI/180, dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r;
  const h = Math.sin(dLa/2)**2 + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
const ROAD = 1.3; // straight line to road distance
const miles = k => k*ROAD/1.609;

/* ---------------- spreadsheet rows -> offices ---------------- */
const DAYS = {mon:1,tue:2,wed:3,thu:4,fri:5};
function parseAvailability(s){
  s = String(s||"").trim();
  if (!s || /^none$/i.test(s)) return null;
  const out = {days:{}, appt:/appt|appointment/i.test(s), nth:[]};
  const nth = s.match(/\b([1-5])(st|nd|rd|th)\b/gi); if (nth) out.nth = nth.map(x => parseInt(x,10));
  const re = /\b(mon|tue|wed|thu|fri)(?:day|sday|nesday|rsday|s|r|rs)?\b\.?\s*(a\.?m\b\.?|p\.?m\b\.?|\d{1,2}(?::\d\d)?\s*(?:-|–|to)\s*\d{1,2}(?::\d\d)?)?/gi;
  let m;
  while ((m = re.exec(s))){
    const d = DAYS[m[1].toLowerCase()]; let am = true, pm = true; const q = (m[2]||"").toLowerCase().replace(/\./g,"");
    if (q === "am") pm = false;
    else if (q === "pm") am = false;
    else if (q){ const [a,b] = q.split(/-|–|to/).map(x => parseInt(x,10)); const st = a < 7 ? a+12 : a; const en = b < 7 ? b+12 : b; am = st < 12; pm = en > 12 || st >= 12; }
    const cur = out.days[d];
    if (!cur) out.days[d] = {am, pm, q:!!q};
    else if (q) out.days[d] = cur.q ? {am: cur.am || am, pm: cur.pm || pm, q:true} : {am, pm, q:true};
  }
  if (!Object.keys(out.days).length) return null;
  for (const k in out.days) delete out.days[k].q;
  return out;
}
function splitSheetName(raw){
  let s = String(raw||"").replace(/\([^)]*\)?/g," ").replace(/["“”]/g," ").replace(/\b(dr|md|np|pa|do)\b\.?/gi," ").replace(/\s+/g," ").trim();
  let last, first = "";
  if (s.includes(",")){ const [a,b] = s.split(","); last = a.trim(); first = (b||"").trim(); }
  else { const t = s.split(" "); if (t.length > 1){ first = t[0]; last = t.slice(1).join(" "); } else last = s; }
  const U = x => x.toUpperCase().replace(/[^A-Z\- ]+/g,"").trim();
  return {last:U(last), first:U(first).split(" ")[0]||"", display:s};
}
function addressKey(addr, city){
  let a = String(addr||"").toLowerCase().split(",")[0];
  a = a.replace(/\b(ste|suite|unit|bldg|building|fl|floor|rm|room)\b.*$/,"").replace(/#.*$/,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
  const t = a.split(" "); let key = a;
  if (/^\d+$/.test(t[0]||"")){ let i = 1; while (i < t.length && /^(n|s|e|w|north|south|east|west)$/.test(t[i])) i++; key = t[0] + " " + (t[i]||""); }
  return key + "|" + cityKey(city);
}
function zipOf(cell, address){
  const c = String(cell||"").match(/\b(\d{5})(?:-\d{4})?\b/); if (c) return c[1];
  const m = String(address||"").match(/(?:,|\b[A-Z]{2}\b|\b[A-Za-z]+\b)\s*(\d{5})(?:-\d{4})?\s*$/); return m ? m[1] : "";
}
function officeInZone(o, zone){
  if (!zone) return true;
  if (o.zip && (zone.zips||[]).includes(o.zip)) return true;
  return (zone.cities||[]).includes(cityKey(o.city));
}
/* availability helpers: {days:{1:{am,pm}..5}, appt, nth:[]} */
const ANYTIME = () => ({days:{1:{am:true,pm:true},2:{am:true,pm:true},3:{am:true,pm:true},4:{am:true,pm:true},5:{am:true,pm:true}}, appt:false, nth:[], unknown:true});
const DAY_SHORT = ["","Mon","Tue","Wed","Thu","Fri"];
function availText(av){
  if (!av) return "";
  if (av.unknown) return "Days not set" + (av.nth && av.nth.length ? " · " + av.nth.map(n => ["","1st","2nd","3rd","4th","5th"][n]).join(" & ") + " week" : "");
  const parts = [];
  for (let d = 1; d <= 5; d++){ const x = av.days[d]; if (!x || !(x.am || x.pm)) continue; parts.push(DAY_SHORT[d] + (x.am && x.pm ? "" : x.am ? " AM" : " PM")); }
  const ord = ["","1st","2nd","3rd","4th","5th"];
  return (parts.join(", ") || "No days") + (av.alt ? " · every other week" : "") + (av.nth && av.nth.length ? " · " + av.nth.map(n => ord[n]).join(" & ") + " week" : "") + (av.appt ? " · appointment only" : "");
}

/* where the city is inside the address: "123 Main St, Ste 4, Walnut Creek, CA 94596" */
function splitCity(address){
  const s = String(address||"").replace(/\s+/g," ").trim(); if (!s) return {street:"", city:""};
  const parts = s.split(",").map(x => x.trim()).filter(Boolean);
  const stateZip = x => /^(ca|calif|california|usa|us|united states)?\.?\s*(\d{5}(-\d{4})?)?$/i.test(x) && x.length;
  while (parts.length > 1 && stateZip(parts[parts.length-1])) parts.pop();
  // "Walnut Creek CA 94596" as the last part
  if (parts.length > 1){ const last = parts[parts.length-1].replace(/\s+(ca|calif|california)\.?(\s+\d{5}(-\d{4})?)?$/i,"").replace(/\s+\d{5}(-\d{4})?$/,"").trim();
    if (last && !/\d/.test(last)) return {street: parts.slice(0,-1).join(", "), city: last}; }
  // no commas: look for a known city name near the end
  const k = " " + cityKey(s) + " "; let best = null;
  for (const name in CITIES) if (k.includes(" " + name + " ") && (!best || name.length > best.length)) best = name;
  if (best){ const i = s.toLowerCase().lastIndexOf(best); if (i > 0) return {street: s.slice(0, i).replace(/[,\s]+$/,""), city: s.slice(i, i + best.length)}; }
  return {street:s, city:""};
}

/* Which column is which. Works out the header row and columns by their names. */
const DAYCOL = /^(mon|tue|wed|thu|fri)[a-z]*\.?\s*(am|pm|a\.m\.|p\.m\.|morning|afternoon)?$/i;
const HEADER_WORDS = /name|location|note|office|doctor|provider|physician|hcp|prescriber|address|street|city|town|avail|best time|days|schedule|hours|zip|postal|specialty|practice|clinic|group|^(mon|tue|wed|thu|fri)/i;
function detectColumns(rows){
  let hi = -1, best = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++){
    const r = rows[i] || []; const n = r.filter(c => HEADER_WORDS.test(String(c||"").trim()) && String(c||"").length < 40).length;
    if (n > best){ best = n; hi = i; }
  }
  if (hi < 0 || best < 2) return {hi:-1, headers:[], map:{}, missing:["Name","Address"]};
  const H = (rows[hi] || []).map(c => String(c||"").trim());
  const col = (re, not) => H.findIndex(h => h && re.test(h) && !(not && not.test(h)));
  const map = {};
  map.first = col(/^first(\s*name)?$|^given/i);
  map.last = col(/^(last|sur)\s*name$|^last$|^surname/i);
  map.name = col(/^(name|doctor|provider|physician|hcp|prescriber|target|full\s*name|hcp\s*name|doctor\s*name|provider\s*name|physician\s*name)/i, /practice|office|org|clinic|group|first|last|account/i);
  if (map.name < 0 && !(map.first >= 0 && map.last >= 0)) map.name = col(/name/i, /practice|office|org|clinic|group|first|last|account|street/i);
  map.addr = H.map((h,i) => /address|street/i.test(h) && !/e-?mail|web/i.test(h) ? i : -1).filter(i => i >= 0);
  if (!map.addr.length){ const l = col(/location|office/i, /name|manager|phone/i); if (l >= 0) map.addr = [l]; }
  map.city = col(/city|town/i);
  map.avail = col(/avail|best time|days|schedule|hours|when/i, DAYCOL);
  map.dayCols = []; H.forEach((h,i) => { const m = h.match(DAYCOL); if (m) map.dayCols.push(i); });
  if (map.dayCols.length < 2) map.dayCols = [];
  map.notes = col(/note|contact|comment/i); map.org = col(/org|group|practice|clinic|company|account/i); map.spec = col(/special/i); map.zip = col(/zip|postal/i);
  const missing = [];
  if (map.name < 0 && !(map.first >= 0 && map.last >= 0)) missing.push("Name");
  if (!map.addr.length && map.city < 0) missing.push("Address");
  return {hi, headers:H, map, missing};
}
const FALSEY = /^(no|n|-+|—|0|none|off|out|closed|false|x?\s*no|n\/a|na)$/i;
function dayCell(v, slot){
  v = String(v ?? "").trim(); if (!v || FALSEY.test(v)) return null;
  if (slot) return {am: slot === "am", pm: slot === "pm"};
  if (/all\s*day|both|full/i.test(v)) return {am:true, pm:true};
  const a = parseAvailability("Mon " + v.replace(/morning/i,"AM").replace(/afternoon/i,"PM"));
  if (a && a.days[1] && /am|pm|\d/i.test(v)) return a.days[1];
  return {am:true, pm:true};
}
function officesFromRows(rows, given){
  const det = given || detectColumns(rows);
  if (det.hi < 0) throw Object.assign(new Error("Couldn't find the column headings in that spreadsheet."), {needsMap:true});
  if (det.missing && det.missing.length) throw Object.assign(new Error("The spreadsheet is missing a column for: " + det.missing.join(", ") + "."), {needsMap:true});
  const {hi, map} = det; const H = det.headers || (rows[hi] || []).map(c => String(c||"").trim());
  const cell = (r, i) => i != null && i >= 0 ? String(r[i] ?? "").trim() : "";
  const body = Array.from(rows.slice(hi+1), r => r || []);
  const goodAddr = v => { v = String(v||"").trim(); return v && !/^=|https?:|hyperlink/i.test(v); };
  const score = i => body.reduce((n,r) => n + (goodAddr(r[i]) && /^\d/.test(String(r[i]).trim()) ? 1 : 0), 0);
  const order = (map.addr || []).slice().sort((a,b) => score(b)-score(a));
  const hasDays = (map.dayCols || []).length >= 2, hasAvail = map.avail != null && map.avail >= 0;
  const offices = [];
  body.forEach((r, idx) => {
    if (!r) return;
    let name = cell(r, map.name);
    if (!name && map.first >= 0 && map.last >= 0){ const l = cell(r, map.last), f = cell(r, map.first); name = l ? (f ? l + ", " + f : l) : ""; }
    else if (name && map.name === map.last && map.first >= 0 && cell(r, map.first)) name = name + ", " + cell(r, map.first);
    if (!name || name.length > 80) return;
    let address = ""; for (const i of order) if (goodAddr(r[i])) { address = String(r[i]).trim(); break; }
    let city = cell(r, map.city).replace(/\s+/g," ");
    if (city) address = address.replace(new RegExp("[,\\s]+" + city.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "(,?\\s*(CA|California)\\.?)?(\\s*\\d{5}(-\\d{4})?)?\\s*$", "i"), "").trim();
    else { const sp = splitCity(address); address = sp.street; city = sp.city; }
    if (!address && !city) return;
    const notes = cell(r, map.notes);
    let avail = null, aText = "";
    if (hasDays){
      const days = {};
      map.dayCols.forEach(i => { const m = H[i].match(DAYCOL); const d = DAYS[m[1].toLowerCase()]; const slot = m[2] ? (/^a/i.test(m[2]) || /morning/i.test(m[2]) ? "am" : "pm") : null;
        const x = dayCell(r[i], slot); if (!x) return; const cur = days[d] || {am:false, pm:false}; days[d] = {am: cur.am || x.am, pm: cur.pm || x.pm}; });
      if (Object.keys(days).length) avail = {days, appt: /appt|appointment/i.test(notes + " " + cell(r, map.avail)), nth:[]};
      aText = availText(avail);
    }
    if (!avail && hasAvail){ aText = cell(r, map.avail); avail = parseAvailability(aText); }
    if (!hasDays && !hasAvail){ avail = ANYTIME(); aText = "Days not set"; }
    offices.push({
      row: hi + idx + 2, rawName: name, ...splitSheetName(name),
      specialty: cell(r, map.spec), address, city, availText: aText, avail,
      notes, org: cell(r, map.org),
      zip: zipOf(cell(r, map.zip), address),
      onLeave: /maternity leave|on leave|leave of absence|retired|no longer (here|with|at)/i.test(notes),
      coords: cityCoords(city, address, zipOf(cell(r, map.zip), address)), addrKey: addressKey(address || city, city)
    });
  });
  return offices;
}

/* ---------------- matching plan doctors to spreadsheet ---------------- */
const normName = s => String(s||"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
function osa(a,b){ // optimal string alignment distance
  const d = Array.from({length:a.length+1}, (_,i) => [i, ...Array(b.length).fill(0)]);
  for (let j=1;j<=b.length;j++) d[0][j]=j;
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++){
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1]===b[j-1]?0:1));
    if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
function firstOk(sheetFirst, tokens){
  if (!sheetFirst) return true;
  return tokens.some(t => t.startsWith(sheetFirst) || (sheetFirst.length > 1 && sheetFirst.startsWith(t) && t.length > 1));
}
function matchDoctors(planDocs, offices, overrides){
  // returns {byDoc: {docId: [officeIdx...]}, unmatched:[docId], how:{docId:"auto"|"manual"|"close"}}
  overrides = overrides || {};
  const byDoc = {}, how = {}, unmatched = [];
  for (const d of planDocs){
    const id = d.id;
    if (overrides[id] !== undefined){
      const want = overrides[id]; // sheet display name or "" for none
      byDoc[id] = want ? offices.map((o,i) => o.rawName === want ? i : -1).filter(i => i >= 0) : [];
      how[id] = "manual"; if (!byDoc[id].length) unmatched.push(id); continue;
    }
    const T = normName(d.name).split(" ").filter(Boolean);
    const lastTok = T[T.length-1];
    const cand = (pred) => offices.map((o,i) => pred(o) ? i : -1).filter(i => i >= 0);
    let hits = cand(o => o.last && o.last.split(/[ -]/).every(p => T.includes(p)) && firstOk(o.first, T) && (o.first || o.last === lastTok || T.indexOf(o.last.split(" ")[0]) >= 0));
    if (hits.length){
      // several different spreadsheet people: keep the ones in the plan's city if that narrows it
      const people = [...new Set(hits.map(i => offices[i].rawName))];
      if (people.length > 1 && d.city){
        const inCity = hits.filter(i => cityKey(offices[i].city) === cityKey(d.city));
        if (inCity.length){ const keep = new Set(inCity.map(i => offices[i].rawName)); hits = hits.filter(i => keep.has(offices[i].rawName)); }
      }
      byDoc[id] = hits; how[id] = "auto"; continue;
    }
    hits = cand(o => o.last && o.last.length >= 4 && osa(o.last, lastTok) === 1 && o.first && firstOk(o.first, T));
    if (!hits.length) hits = cand(o => o.last === lastTok && o.first && o.first.length >= 4 && osa(o.first, T[0]) <= 1 && (!d.city || cityKey(o.city) === cityKey(d.city)));
    if (hits.length){ byDoc[id] = hits; how[id] = "close"; continue; }
    byDoc[id] = []; unmatched.push(id);
  }
  return {byDoc, how, unmatched};
}

/* ---------------- finding doctor names in free text (calendar, screenshots) ---------------- */
// last names that are also everyday words, street names or common first names, or very common surnames: need a first name, "Dr." or a city nearby
const NEEDS_CONTEXT = new Set(["PARK","LONG","YOUNG","HILL","KING","WOOD","BROWN","WHITE","GREEN","GRAY","BELL","HALL","LANE","HEAL","BAKER","CROSS","CHURCH","ROSE","WELLS",
  "JUAN","JOSE","JOHN","JAMES","MARK","PAUL","GEORGE","KONG","WONG","LIANG","HUANG","CHAN","CHEN","WANG","ZHANG","LIN","LIM","NGUYEN","TRAN","KIM","PATEL","SHAH","SINGH","LOWE"]);
function buildNameIndex(planDocs, offices, match){
  const idx = []; // {id, last, first, cities:[...]}
  for (const d of planDocs){
    const T = normName(d.name).split(" ");
    const lasts = new Set([T[T.length-1]]);
    const cities = new Set([cityKey(d.city)].filter(Boolean));
    (match && match.byDoc[d.id] || []).forEach(i => { const L = offices[i].last; if (L) lasts.add(L.split(" ")[0]); if (offices[i].city) cities.add(cityKey(offices[i].city)); });
    for (const L of lasts) idx.push({id:d.id, last:L, first:T[0], cities:[...cities]});
  }
  const byLast = {}; idx.forEach(e => { (byLast[e.last] = byLast[e.last] || []).push(e); });
  return {idx, byLast};
}
// common short names, so "Mike Balduzzi" means Michael and not Jeffrey
const NICK = {MIKE:["MICHAEL"],MICK:["MICHAEL"],JEFF:["JEFFREY","JEFFERY"],BOB:["ROBERT"],BOBBY:["ROBERT"],ROB:["ROBERT","ROBIN"],BILL:["WILLIAM"],WILL:["WILLIAM"],LIAM:["WILLIAM"],
  JIM:["JAMES"],JIMMY:["JAMES"],JAMIE:["JAMES"],TOM:["THOMAS"],DAVE:["DAVID"],STEVE:["STEVEN","STEPHEN"],CHRIS:["CHRISTOPHER","CHRISTINE","CHRISTINA"],JOE:["JOSEPH"],
  DAN:["DANIEL"],DANNY:["DANIEL"],MATT:["MATTHEW"],NICK:["NICHOLAS"],TONY:["ANTHONY","ANTONIO"],RICK:["RICHARD","RICARDO"],RICH:["RICHARD"],DICK:["RICHARD"],
  BEN:["BENJAMIN"],SAM:["SAMUEL","SAMANTHA"],ED:["EDWARD"],TED:["EDWARD","THEODORE"],ANDY:["ANDREW"],DREW:["ANDREW"],GREG:["GREGORY"],PAT:["PATRICK","PATRICIA"],
  KATE:["KATHERINE","KATHRYN","CATHERINE"],KATIE:["KATHERINE","KATHRYN","CATHERINE"],CATHY:["CATHERINE"],KATHY:["KATHERINE","KATHLEEN"],LIZ:["ELIZABETH"],BETH:["ELIZABETH"],
  SUE:["SUSAN","SUZANNE"],JEN:["JENNIFER"],JENNY:["JENNIFER"],JESS:["JESSICA"],BECKY:["REBECCA"],MEG:["MARGARET","MEGAN"],PEGGY:["MARGARET"],ABBY:["ABIGAIL"],
  VICKY:["VICTORIA"],TINA:["CHRISTINA","KRISTINA"],ALEX:["ALEXANDER","ALEXANDRA","ALEJANDRO"],LARRY:["LAWRENCE"],JERRY:["GERALD","JEROME"],HANK:["HENRY"],
  CHUCK:["CHARLES"],CHARLIE:["CHARLES"],FRANK:["FRANCIS","FRANKLIN"],KEN:["KENNETH"],RON:["RONALD"],DON:["DONALD"],TIM:["TIMOTHY"],ZACH:["ZACHARY"],JON:["JONATHAN"],
  NATE:["NATHAN","NATHANIEL"],PHIL:["PHILIP","PHILLIP"],RAY:["RAYMOND"],GENE:["EUGENE"],FRED:["FREDERICK"],VINCE:["VINCENT"],MANNY:["MANUEL"],PETE:["PETER"],
  SANDY:["SANDRA"],DEB:["DEBORAH","DEBRA"],DEBBIE:["DEBORAH","DEBRA"],BARB:["BARBARA"],TERRY:["TERRENCE","TERESA"]};
function findDoctorsInText(text, nameIndex){
  const W = normName(text).split(" ").filter(Boolean);
  const found = new Map(); // id -> true (sure) | false (probably)
  const put = (id, sure) => { if (sure) found.set(id, true); else if (!found.has(id)) found.set(id, false); };
  for (let i=0;i<W.length;i++){
    const group = nameIndex.byLast[W[i]]; if (!group) continue;
    const near = W.slice(Math.max(0,i-3), i+4), nearText = " " + W.slice(Math.max(0,i-3), i+8).join(" ").toLowerCase() + " ";
    const drHit = W[i-1] === "DR" || W[i-2] === "DR";
    const full = group.filter(e => near.some(w => w.length > 1 && (w === e.first || (w.length >= 3 && e.first.startsWith(w)) || (NICK[w] || []).includes(e.first))));
    const initial = group.filter(e => near.some(w => w.length === 1 && w === e.first[0]));
    const byCity = group.filter(e => e.cities.some(c => c && nearText.includes(" " + c + " ")));
    if (full.length){ full.forEach(e => put(e.id, true)); continue; }
    if (group.length === 1){
      const e = group[0];
      const risky = NEEDS_CONTEXT.has(e.last) || e.last.length <= 3;
      put(e.id, !risky || drHit || initial.length === 1 || byCity.length === 1);
      continue;
    }
    // several plan doctors share this last name
    if (initial.length === 1){ put(initial[0].id, true); continue; }
    if (byCity.length === 1){ put(byCity[0].id, true); continue; }
    (initial.length ? initial : byCity.length ? byCity : group).forEach(e => put(e.id, false));
  }
  return [...found.entries()].map(([id,sure]) => ({id, sure}));
}

/* ---------------- calendar (.ics) ---------------- */
function icsUnescape(s){ return String(s||"").replace(/\\n/gi,"\n").replace(/\\([,;\\])/g,"$1"); }
function icsDate(v, params){
  v = String(v||"").trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  if (!m[4] || /VALUE=DATE(?!-)/i.test(params||"")) return {allDay:true, date:new Date(+m[1], +m[2]-1, +m[3])};
  const dt = m[7] ? new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0))) : new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0));
  return {allDay:false, date:dt};
}
function parseICS(text){
  const lines = String(text).replace(/\r\n?/g,"\n").replace(/\n[ \t]/g,"").split("\n");
  const evs = []; let cur = null, depth = 0;
  for (const ln of lines){
    if (/^BEGIN:VEVENT/i.test(ln)){ cur = {attendees:[], exdates:[]}; depth = 0; continue; }
    if (!cur) continue;
    if (/^BEGIN:/i.test(ln)){ depth++; continue; }
    if (/^END:VEVENT/i.test(ln)){ evs.push(cur); cur = null; continue; }
    if (/^END:/i.test(ln)){ depth--; continue; }
    if (depth > 0) continue;
    const ci = ln.indexOf(":"); if (ci < 0) continue;
    const head = ln.slice(0,ci), val = ln.slice(ci+1);
    const [name, ...ps] = head.split(";"); const params = ps.join(";"); const N = name.toUpperCase();
    if (N === "DTSTART") cur.start = icsDate(val, params);
    else if (N === "DTEND") cur.end = icsDate(val, params);
    else if (N === "DURATION") cur.duration = val;
    else if (N === "SUMMARY") cur.summary = icsUnescape(val);
    else if (N === "LOCATION") cur.location = icsUnescape(val);
    else if (N === "DESCRIPTION") cur.description = icsUnescape(val).slice(0,600);
    else if (N === "UID") cur.uid = val;
    else if (N === "RRULE") cur.rrule = val;
    else if (N === "EXDATE") val.split(",").forEach(x => { const d = icsDate(x, params); if (d) cur.exdates.push(d.date); });
    else if (N === "RECURRENCE-ID") cur.recurrenceId = icsDate(val, params);
    else if (N === "STATUS") cur.status = val.toUpperCase();
    else if (N === "TRANSP") cur.transp = val.toUpperCase();
    else if (N === "ORGANIZER" || N === "ATTENDEE"){ if (N === "ORGANIZER"){ const cn0 = params.match(/CN="?([^";:]+)"?/i); cur.organizer = (cn0 ? cn0[1] + " " : "") + val.replace(/^mailto:/i,""); } const cn = params.match(/CN="?([^";:]+)"?/i); cur.attendees.push(cn ? cn[1] : val.replace(/^mailto:/i,"")); }
  }
  return evs.filter(e => e.start && e.status !== "CANCELLED");
}
function durMs(d){ const m = String(d||"").match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/); if (!m) return 0; return (((+m[1]||0)*7 + (+m[2]||0))*86400 + (+m[3]||0)*3600 + (+m[4]||0)*60 + (+m[5]||0))*1000; }
function expandEvents(evs, fromISO_, toISO_){
  // returns occurrences overlapping [from, to] (dates inclusive): {start:Date,end:Date,allDay,summary,location,description,attendees,transp,uid}
  const from = fromISO(fromISO_), to = fromISO(addDays(toISO_,1));
  const overrides = new Set(evs.filter(e => e.recurrenceId).map(e => e.uid + "|" + e.recurrenceId.date.getTime()));
  const out = [];
  const push = (e, s) => {
    const len = e.end ? e.end.date - e.start.date : (e.duration ? durMs(e.duration) : (e.start.allDay ? 864e5 : 36e5));
    const en = new Date(s.getTime() + Math.max(len, 0));
    if (en > from && s < to) out.push({start:s, end:en, allDay:e.start.allDay, summary:e.summary||"", location:e.location||"", description:e.description||"", attendees:e.attendees, organizer:e.organizer||"", transp:e.transp, uid:e.uid});
  };
  for (const e of evs){
    if (!e.rrule || e.recurrenceId){ push(e, e.start.date); continue; }
    const R = Object.fromEntries(e.rrule.split(";").map(p => p.split("=")).map(([k,v]) => [k.toUpperCase(), v]));
    const freq = R.FREQ, interval = +(R.INTERVAL||1), count = R.COUNT ? +R.COUNT : Infinity;
    const until = R.UNTIL ? icsDate(R.UNTIL).date : null;
    const byday = R.BYDAY ? R.BYDAY.split(",").map(x => ["SU","MO","TU","WE","TH","FR","SA"].indexOf(x.slice(-2))) : null;
    const s0 = e.start.date; const ex = new Set(e.exdates.map(d => d.getTime()));
    let n = 0;
    const consider = d => {
      if (until && d > until) return false;
      n++; if (n > count) return false;
      if (!ex.has(d.getTime()) && !overrides.has(e.uid + "|" + d.getTime())) push(e, d);
      return d < to;
    };
    if (freq === "DAILY"){ for (let i=0, d=new Date(s0); i<4000; i++, d=new Date(s0.getFullYear(), s0.getMonth(), s0.getDate()+i*interval, s0.getHours(), s0.getMinutes())){ if (!consider(d)) break; } }
    else if (freq === "WEEKLY"){
      const days = byday || [s0.getDay()];
      const wk0 = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() - s0.getDay());
      let stop = false;
      for (let w=0; w<800 && !stop; w+=interval){
        for (const dd of days.slice().sort()){
          const d = new Date(wk0.getFullYear(), wk0.getMonth(), wk0.getDate() + w*7 + dd, s0.getHours(), s0.getMinutes());
          if (d < s0) continue;
          if (!consider(d)){ stop = true; break; }
        }
      }
    }
    else if (freq === "MONTHLY" || freq === "YEARLY"){
      for (let i=0;i<400;i++){
        const d = freq === "MONTHLY" ? new Date(s0.getFullYear(), s0.getMonth()+i*interval, s0.getDate(), s0.getHours(), s0.getMinutes())
                                     : new Date(s0.getFullYear()+i*interval, s0.getMonth(), s0.getDate(), s0.getHours(), s0.getMinutes());
        if (!consider(d)) break;
      }
    }
    else push(e, s0);
  }
  return out.sort((a,b) => a.start - b.start);
}
function wordIn(text, w){ return new RegExp("(^|[^A-Za-z])" + w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "([^A-Za-z]|$)", "i").test(text); }
const MEAL = /\b(lunch|lunches|breakfast|coffee|snacks?|dinner|in-?service|program|bagels?|donuts?|pizza|treats?)\b/i;
// does an organizer line ("Jordan Smith jordan.smith@...") belong to this person?
function isPerson(text, person){
  const t = String(text||"").toLowerCase(), w = String(person||"").toLowerCase().split(/[^a-z]+/).filter(x => x.length > 1);
  if (!t || !w.length) return false;
  if (w.every(x => new RegExp("(^|[^a-z])" + x + "([^a-z]|$)").test(t))) return true;
  return w.length > 1 && (t.includes(w[0] + "." + w[w.length-1]) || t.includes(w[0] + w[w.length-1]) || t.includes(w[0][0] + w[w.length-1] + "@"));
}
const TIME_OFF = /\b(pto|vacation|holiday|out of (the )?office|ooo|day off|off today|sick|leave|personal day|jury|bereavement|conference|convention|national (sales )?meeting|nsm|poa|plan of action|offsite|off-site|training|travel)\b/i;
// "Lien/Yunji Lunch": a first name in a lunch or coffee title, when only one doctor has it
function firstNameHits(text, nameIndex, skip){
  if (!nameIndex.byFirst){ const m = {}; nameIndex.idx.forEach(e => { if (e.first && e.first.length >= 3) (m[e.first] = m[e.first] || new Set()).add(e.id); }); nameIndex.byFirst = m; }
  const out = [];
  normName(text).split(" ").forEach(w => { const g = nameIndex.byFirst[w]; if (g && g.size === 1 && !nameIndex.byLast[w] && !skip.includes(w)) out.push([...g][0]); });
  return out;
}
function classifyEvent(ev, counterparts, nameIndex, myName){
  const own = [ev.summary, ev.location, ev.description].join(" \n ");
  const text = own + " \n " + (ev.attendees||[]).join(" ");
  let who = counterparts.filter(c => c && wordIn(text, c));
  const docs = findDoctorsInText(own, nameIndex);
  // "Lunch - Lee" or "Coffee w/ Lee": a meal word next to a single name is enough to be sure
  if (docs.length === 1 && docs[0].sure === false && MEAL.test(ev.summary || "")) docs[0].sure = true;
  if (MEAL.test(ev.summary || "")){
    const skip = [String(myName || "").trim().split(/\s+/)[0]].concat(counterparts).filter(Boolean).map(x => normName(x));
    firstNameHits(ev.summary, nameIndex, skip).forEach(id => { const d = docs.find(x => x.id === id); if (d) d.sure = true; else docs.push({id, sure:true}); });
  }
  const mine = !!(myName && ev.organizer && isPerson(ev.organizer, myName));
  // your own event: a counterpart who is only on the invite list is a guest, not their visit
  if (mine) who = who.filter(c => wordIn(own, c));
  else if (ev.organizer){ const orgCp = counterparts.filter(c => c && wordIn(ev.organizer, c)); if (orgCp.length) who = [...new Set(orgCp.concat(who))]; }
  let kind;
  if (who.length && docs.length) kind = "counterpart";
  else if (who.length) kind = "ignore";
  else if (docs.length) kind = "mine";
  else kind = ev.transp === "TRANSPARENT" || (ev.allDay && !TIME_OFF.test(own)) ? "ignore" : "busy";
  // your own lunch or coffee with someone who isn't on your list ("Matthys Lunch - Torre")
  const first = String(myName || "").trim().split(/\s+/)[0] || "";
  const myMeal = kind === "busy" && !ev.allDay && MEAL.test(ev.summary || "") && (mine || (first.length > 1 && wordIn(ev.summary || "", first)));
  return {kind, who, docs, mine, myMeal};
}

/* ---------------- a counterpart's "Share my week" text, pasted from a text or email ----------------
   "Sam's week, Oct 19 – Oct 23" / "Monday, Oct 19 · Springfield" / "Morning: Pat Doe (Springfield) – lunch 12:00 PM, ..." */
const WDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function parseSharedWeek(text, weekMon, nameIndex){
  const lines = String(text||"").replace(/\r/g,"").split("\n").map(s => s.trim()).filter(Boolean);
  const head = lines[0] || ""; const hm = head.match(/^([A-Za-z][A-Za-z'\- ]{0,30}?)['’]s week\b/i);
  const who = hm ? hm[1].trim() : null;
  const byDate = {}; let cur = null; const ref = fromISO(weekMon);
  for (const ln of lines){
    const m = ln.match(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*(?:([A-Za-z]{3,})\.?\s+(\d{1,2}))?/i);
    if (m && !/^(morning|afternoon)/i.test(ln) && (m[2] || /^(mon|tues|wednes|thurs|fri)day\b/i.test(ln))){
      if (m[2] && MONTHS.includes(m[2].slice(0,3).toLowerCase())){
        const mo = MONTHS.indexOf(m[2].slice(0,3).toLowerCase()), dd = +m[3];
        let best = null; for (const y of [ref.getFullYear()-1, ref.getFullYear(), ref.getFullYear()+1]){ const d = new Date(y, mo, dd); if (!best || Math.abs(d - ref) < Math.abs(best - ref)) best = d; }
        cur = isoDay(best);
      } else { const k = WDAYS.findIndex(w => w.startsWith(m[1].toLowerCase())); cur = addDays(weekMon, (k + 6) % 7); }
      byDate[cur] = byDate[cur] || []; continue;
    }
    if (!cur) continue;
    const body = ln.replace(/^(morning|afternoon|am|pm)\s*:\s*/i, "");
    for (const part of body.split(/,(?![^(]*\))/)){
      const nm = part.replace(/\([^)]*\)/g, " ").replace(/\s[–-]\s.*$/, "");
      for (const x of findDoctorsInText(nm, nameIndex)) if (!byDate[cur].some(y => y.id === x.id)) byDate[cur].push(x);
    }
  }
  const dates = Object.keys(byDate).filter(d => byDate[d].length).sort();
  return {who, byDate, weekOf: dates.length ? mondayOf(dates[0]) : null};
}

/* ---------------- counterpart schedule screenshots (OCR TSV) ---------------- */
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function parseTSV(tsv){
  return String(tsv||"").split("\n").slice(1).map(l => l.split("\t")).filter(c => c.length >= 12 && c[0] === "5" && c[11].trim())
    .map(c => ({block:+c[2], par:+c[3], line:+c[4], left:+c[6], top:+c[7], w:+c[8], h:+c[9], conf:+c[10], text:c[11].trim()}));
}
function scheduleFromWords(words, weekMon, nameIndex){
  const week = weekDays(weekMon);
  const dayOf = (w, next) => {
    const t = w.text.toLowerCase().replace(/[^a-z0-9/]/g,"");
    const nm = t.match(/^(mon|tue|wed|thu|fri)/);
    const dm = t.match(/^(\d{1,2})\/(\d{1,2})/);
    if (dm){ const hit = week.find(d => fromISO(d).getMonth()+1 === +dm[1] && fromISO(d).getDate() === +dm[2]); if (hit) return hit; }
    const mi = MONTHS.indexOf(t.slice(0,3));
    if (mi >= 0 && next && /^\d{1,2}/.test(next.text)){ const dd = parseInt(next.text,10); const hit = week.find(d => fromISO(d).getMonth() === mi && fromISO(d).getDate() === dd); if (hit) return hit; }
    if (nm && (t.length <= 3 || /^(mon|tues?|wed|weds|wednes|thur?s?|fri)(day)?$/.test(t) || /^(monday|tuesday|wednesday|thursday|friday)/.test(t))) return week[DAYS[nm[1]]-1];
    return null;
  };
  const anchors = [];
  words.forEach((w,i) => { const d = dayOf(w, words[i+1]); if (d) anchors.push({...w, date:d, cx:w.left+w.w/2}); });
  // one anchor per date: keep the top-most occurrence
  const firstPer = {}; anchors.forEach(a => { if (!firstPer[a.date] || a.top < firstPer[a.date].top) firstPer[a.date] = a; });
  const A = Object.values(firstPer);
  const out = {}; week.forEach(d => out[d] = []);
  if (!A.length) return {byDate:out, layout:"none"};
  const medH = A.map(a => a.h).sort((x,y)=>x-y)[Math.floor(A.length/2)] || 20;
  const sameRow = A.filter(a => Math.abs(a.top - A[0].top) < medH*1.5).length;
  const layout = A.length >= 2 && sameRow >= Math.min(A.length, 2) && sameRow === A.length ? "columns" : "rows";
  const buckets = {}; A.forEach(a => buckets[a.date] = []);
  if (layout === "columns"){
    const cols = A.slice().sort((a,b) => a.cx - b.cx);
    const headerBottom = Math.max(...A.map(a => a.top + a.h));
    words.forEach(w => {
      if (w.top + w.h <= headerBottom - 2) return;
      const cx = w.left + w.w/2; let best = cols[0], bd = Infinity;
      cols.forEach(c => { const d = Math.abs(c.cx - cx); if (d < bd){ bd = d; best = c; } });
      buckets[best.date].push(w);
    });
  } else {
    const rows = A.slice().sort((a,b) => a.top - b.top);
    words.forEach(w => {
      let owner = null; for (const r of rows) if (w.top >= r.top - 2) owner = r;
      if (owner) buckets[owner.date].push(w);
    });
  }
  for (const d in buckets){
    const ws = buckets[d].sort((a,b) => (a.top - b.top) || (a.left - b.left));
    // rebuild lines so first + last names stay together
    const lines = []; ws.forEach(w => { const L = lines.find(l => Math.abs(l.top - w.top) < Math.max(8, w.h*0.6)); if (L){ L.ws.push(w); } else lines.push({top:w.top, ws:[w]}); });
    const text = lines.map(l => l.ws.sort((a,b)=>a.left-b.left).map(w => w.text).join(" ")).join("\n");
    out[d] = findDoctorsInText(text, nameIndex);
  }
  return {byDate:out, layout};
}

/* ---------------- priority ---------------- */
/* Pacing through the quarter. Each doctor has a rhythm: the quarter divided by their assigned calls
   (2 assigned: about every 6 weeks, 3: monthly, 6: every 2 weeks, 12: weekly).
   - Due: calls left and their turn has come (or never called), or behind pace for that doctor, or the last 3 weeks of the quarter.
   - Early: calls left but not their turn yet. Used to fill a day, the least-ahead first; twice-a-month doctors last.
   - Extra: quota met. Can still fill a day after their full rhythm has passed, up to a couple over quota (relative to the quota).
   Calendar visits, anchors and blitzes are separate and always win. */
const quarterEnd = iso => { const d = fromISO(iso); const m = Math.floor(d.getMonth() / 3) * 3 + 3; return isoDay(new Date(d.getFullYear(), m, 0)); };
const quarterStart = iso => { const d = fromISO(iso); return isoDay(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)); };
const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 864e5);
// common US holidays (a weekend date moves to the Friday or Monday off)
function holidaysOf(y){
  const nth = (m, wd, n) => { const d = new Date(y, m, 1); const off = (wd - d.getDay() + 7) % 7; return new Date(y, m, 1 + off + 7 * (n - 1)); };
  const last = (m, wd) => { const d = new Date(y, m + 1, 0); return new Date(y, m, d.getDate() - ((d.getDay() - wd + 7) % 7)); };
  const obs = d => { const w = d.getDay(); return w === 6 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1) : w === 0 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) : d; };
  const tg = nth(10, 4, 4);
  return [obs(new Date(y,0,1)), nth(0,1,3), nth(1,1,3), last(4,1), obs(new Date(y,5,19)), obs(new Date(y,6,4)), nth(8,1,1), tg, new Date(y,10,tg.getDate()+1),
    obs(new Date(y,11,24)), obs(new Date(y,11,25)), obs(new Date(y,11,31))].map(isoDay);
}
// field days in [a, b]: work days that aren't time off
function fieldDaysIn(a, b, o){
  let n = 0; for (let d = a; d <= b; d = addDays(d, 1)){ const w = fromISO(d).getDay(); if ((o.workDays || [1,2,3,4,5]).includes(w) && !(o.isOff && o.isOff(d))) n++; }
  return n;
}
// your goal (say 90%) as a number of calls per doctor: everyone keeps at least one call (reach), and the cuts come
// mostly from the doctors with the fewest assigned calls, so the high-call doctors stay close to their full quota
function goalTargets(docs, goal){
  const list = docs.filter(d => !d.added && +d.assigned > 0);
  list.forEach(d => { d.target = +d.assigned; });
  const A = list.reduce((t,d) => t + d.target, 0);
  let cut = A - Math.round(A * Math.max(0.3, Math.min(1, goal || 1)));
  const floor = d => Math.max(1, d.completed != null ? +d.completed : d.assigned - d.remaining);
  while (cut > 0){
    let best = null, bv = -Infinity;
    for (const d of list){ if (d.target <= floor(d)) continue; const v = d.target / d.assigned - 0.05 * d.assigned; if (v > bv){ bv = v; best = d; } }
    if (!best) break; best.target--; cut--;
  }
  return list.reduce((t,d) => t + d.target, 0);
}
function scoreDoctors(docs, refISO, qEnd, opts){
  opts = opts || {};
  const ref = refISO || isoDay(new Date());
  const end = qEnd && qEnd >= ref ? qEnd : quarterEnd(ref), start = quarterStart(end);
  const qDays = Math.max(28, daysBetween(start, end) + 1);
  const fTotal = Math.max(1, fieldDaysIn(start, end, opts)), fDone = fieldDaysIn(start, addDays(ref, -1), opts);
  const f = Math.max(0, Math.min(1, (fDone + 0.5) / fTotal));
  const lastWeeks = daysBetween(ref, end) <= 21;
  goalTargets(docs, opts.goal || 1);
  const need = d => d.callsPerWeekNeeded != null ? d.callsPerWeekNeeded : (d.assigned ? d.remaining / d.assigned : 0);
  const maxNeed = Math.max(0.0001, ...docs.map(need));
  docs.forEach(d => {
    d.due = d.early = d.extra = d.behind = false; d.pace = null;
    const since = d.lastCall ? daysBetween(d.lastCall, ref) : d.daysSinceLastCall;
    const stale = since == null ? 1 : Math.min(Math.max(0, since), 60) / 60;
    if (d.added){ d.score = 0.1 * stale; return; }
    const a = +d.assigned || 0;
    if (!a){ d.score = 0.8 * need(d) / maxNeed + 0.2 * stale; return; }   // no quota known: the old way
    const t = d.target || a, done = d.completed != null ? +d.completed : a - d.remaining;
    const rhythm = qDays / t, turn = since == null || since >= 0.8 * rhythm;
    // catching up never means seeing someone too often: at least about 2 weeks apart (5 days for weekly doctors)
    const gapOk = since == null || since >= (t >= 12 ? 5 : 12);
    d.pace = done - t * f;                       // + ahead of pace toward your goal for this doctor, - behind
    if (done < t){
      d.behind = (d.pace <= -0.75 || lastWeeks) && gapOk;
      if (d.behind || turn){ d.due = true; d.score = 1 + 0.25 * Math.min(2, Math.max(0, -d.pace)) + (d.behind ? 0.25 : 0) + 0.02 * a + 0.1 * stale; }
      else { d.early = true; d.score = 0.45 - 0.2 * Math.min(1, Math.max(0, d.pace)) - (t >= 6 ? 0.15 : 0); }
    } else if (d.remaining > 0){
      // your goal for them is met but the full quota isn't: an early call when their turn comes
      if (turn){ d.early = true; d.score = 0.2 + 0.01 * a; } else { d.noAuto = true; d.score = 0; }
    } else {
      const over = done - a, cap = Math.max(2, Math.round(a / 3));
      if (over < cap && turn){ d.extra = true; d.noAuto = false; d.score = 0.12 - 0.03 * over; }
      else { d.noAuto = true; d.score = 0; }
    }
  });
  return docs;
}
// the whole plan against your goal: calls ahead of an even pace (counting field days only), and whether the goal still fits
function paceSummary(docs, refISO, qEnd, opts){
  opts = opts || {};
  const ref = refISO || isoDay(new Date());
  const end = qEnd && qEnd >= ref ? qEnd : quarterEnd(ref), start = quarterStart(end);
  const fTotal = Math.max(1, fieldDaysIn(start, end, opts)), fDone = fieldDaysIn(start, addDays(ref, -1), opts), fLeft = fTotal - fDone;
  const f = Math.max(0, Math.min(1, (fDone + 0.5) / fTotal));
  let done = 0, T = 0, A = 0;
  docs.forEach(d => { if (d.added || !d.assigned) return; A += +d.assigned; T += d.target || +d.assigned; done += d.completed != null ? +d.completed : d.assigned - d.remaining; });
  if (!A) return null;
  const possible = Math.floor(fLeft * (opts.perDay || 6) * 0.85), needed = Math.max(0, T - done);
  return {goal: Math.round(T / A * 100), target: T, assigned: A, done, ahead: Math.round(done - T * f), fieldLeft: fLeft,
    fits: possible >= needed, reach: Math.min(100, Math.round((done + possible) / A * 100)), pct: Math.round(f * 100)};
}

/* ---------------- scheduling ---------------- */
function availableOn(office, iso){
  if (!office.avail || office.onLeave || !office.coords) return null;
  const a = office.avail.days[dow(iso)]; if (!a) return null;
  if (office.avail.nth.length && !office.avail.nth.includes(Math.ceil(fromISO(iso).getDate()/7))) return null;
  // every other week: in on the weeks an even number of weeks from the week they were last known to be in
  if (office.avail.alt && Math.abs(Math.round((fromISO(mondayOf(iso)) - fromISO(office.avail.alt)) / (7*864e5))) % 2 === 1) return null;
  return a;
}
function slotCaps(perDay){ return {am: Math.ceil(perDay/2), pm: Math.floor(perDay/2)}; }
function minutesOverlap(ev, iso, h1, h2){
  const d = fromISO(iso); const s = new Date(d); s.setHours(h1,0,0,0); const e = new Date(d); e.setHours(h2,0,0,0);
  return Math.max(0, (Math.min(e, ev.end) - Math.max(s, ev.start)) / 60000);
}

function buildContext(input){
  // input: {weekMon, days:[iso], docs:[{id,name,city,remaining,assigned,...,score}], offices, match, home:[lat,lon], perDay,
  //         counterpartVisits:[{date,id,who}], calendar:[{start,end,allDay,kind,docs:[{id}],summary}], today}
  const C = {...input};
  C.docById = Object.fromEntries(input.docs.map(d => [d.id, d]));
  // doctors with no calls left are still known (for calendar visits and adding by hand) but aren't planned on their own
  C.allDocs = input.docs; C.docs = input.docs.filter(d => !d.noAuto);
  C.blocked = new Set(input.counterpartVisits.map(v => v.date + "|" + v.id));
  for (const iso in (input.skip || {})) input.skip[iso].forEach(s => C.blocked.add(iso + "|" + s.id));
  // doctors out of office: blocked like a counterpart day, but remembered separately for the reasons shown
  C.away = new Set();
  for (const id in (input.away || {})) for (const r of input.away[id]) for (const iso of input.days.concat(input.weekMon ? weekDays(input.weekMon) : [])) if (iso >= r.from && iso <= r.to){ C.away.add(iso + "|" + id); C.blocked.add(iso + "|" + id); }
  // never the third of you on three days in a row: a day between two counterpart visits, or right before or after two back-to-back ones, is blocked too
  C.streak = new Set(); const cpd = {};
  input.counterpartVisits.forEach(v => (cpd[v.id] = cpd[v.id] || new Set()).add(v.date));
  for (const id in cpd){ const s = cpd[id];
    for (const iso of input.days.concat(input.weekMon ? weekDays(input.weekMon) : [])){
      if (s.has(iso) || C.streak.has(iso + "|" + id)) continue;
      const p1 = s.has(addDays(iso, -1)), p2 = s.has(addDays(iso, -2)), n1 = s.has(addDays(iso, 1)), n2 = s.has(addDays(iso, 2));
      if ((p1 && p2) || (p1 && n1) || (n1 && n2)){ C.streak.add(iso + "|" + id); C.blocked.add(iso + "|" + id); }
    }
  }
  // doctors already called this week (logged in the tracker or shown in the call plan report) aren't planned again
  const wkEnd = addDays(input.weekMon, 6);
  C.seen = {}; input.docs.forEach(d => { if (d.lastCall && d.lastCall >= input.weekMon && d.lastCall <= wkEnd) C.seen[d.id] = d.lastCall; });
  C.caps = {}; C.fixed = {}; C.busyNotes = {}; C.addrRule = input.addrRule || "week";
  C.allowed = input.zone ? new Set(input.offices.map((o,i) => officeInZone(o, input.zone) ? i : -1).filter(i => i >= 0)) : null;
  for (const iso of input.days){
    let busyA = 0, busyP = 0, off = false; const notes = [];
    for (const ev of input.calendar){
      const covers = ev.allDay ? (ev.start <= fromISO(iso) && ev.end > fromISO(iso)) : isoDay(ev.start) === iso;
      if (!covers) continue;
      // an all-day item that isn't time off (a training series, say) is shown on the day but leaves it open
      if (ev.kind === "ignore" && ev.allDay && !(ev.who || []).length){ notes.push({label:"All day", text:ev.summary + " (day left open)"}); continue; }
      if (ev.kind !== "busy" && ev.kind !== "mine") continue;
      if (ev.kind === "busy"){
        if (ev.allDay){ off = true; notes.push({label:"All day", text:ev.summary}); continue; }
        const mA = minutesOverlap(ev, iso, 8, 12), mP = minutesOverlap(ev, iso, 12, 17);
        busyA += mA; busyP += mP;
        if (mA || mP) notes.push({label: ev.start.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}), text:ev.summary});
      } else {
        (ev.docs||[]).filter(x => x.sure !== false).forEach(x => {
          if (!C.docById[x.id]) return;
          const slot = ev.allDay ? "am" : (ev.start.getHours() < 12 ? "am" : "pm");
          (C.fixed[iso] = C.fixed[iso] || []).push({id:x.id, slot, from:"calendar", note:ev.summary, where:[ev.summary, ev.location].join(" "), hour: ev.allDay ? null : ev.start.getHours() + ev.start.getMinutes()/60, time:ev.allDay ? "" : ev.start.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})});
        });
      }
    }
    // about an hour per visit including the drive; mornings 8-12, afternoons 12-5
    const am = off ? 0 : Math.max(0, Math.min(4, Math.floor((240 - busyA) / 60)));
    const pm = off ? 0 : Math.max(0, Math.min(5, Math.floor((300 - busyP) / 60)));
    C.caps[iso] = {am, pm, total: Math.min(input.perDay, am + pm)};
    C.busyNotes[iso] = notes;
  }
  return C;
}
function optionsFor(C, id, iso){
  const res = [];
  (C.match.byDoc[id] || []).forEach(i => {
    if (C.allowed && !C.allowed.has(i)) return;
    const o = C.offices[i]; const a = availableOn(o, iso);
    if (a) res.push({id, office:i, am:a.am, pm:a.pm, coords:o.coords, addrKey:o.addrKey});
  });
  return res;
}
function feasibleDays(C, id){ return C.days.filter(d => !C.blocked.has(d + "|" + id) && optionsFor(C, id, d).length); }

function tourLength(seq, home){ let d = 0, at = home; seq.forEach(s => { d += km(at, s.coords); at = s.coords; }); return d + km(at, home); }
function bestTour(stops, home){
  // nearest neighbour from home, then 2-opt on the loop home -> stops -> home
  const left = stops.slice(), seq = []; let at = home;
  while (left.length){ let bi = 0, bd = Infinity; left.forEach((s,i) => { const d = km(at, s.coords); if (d < bd - 1e-9){ bd = d; bi = i; } }); const s = left.splice(bi,1)[0]; seq.push(s); at = s.coords; }
  let improved = true, guard = 0;
  while (improved && guard++ < 50){
    improved = false;
    for (let i=0;i<seq.length-1;i++) for (let j=i+1;j<seq.length;j++){
      const cand = seq.slice(0,i).concat(seq.slice(i,j+1).reverse(), seq.slice(j+1));
      if (tourLength(cand, home) < tourLength(seq, home) - 1e-6){ seq.splice(0, seq.length, ...cand); improved = true; }
    }
  }
  return seq;
}
function orderDay(stops, home, capAM, capPM){
  // Morning = the first part of the loop, afternoon = the rest, so each half-day stays in one area.
  const n = stops.length; if (!n) return {stops:[], miles:0};
  const curAM = stops.filter(s => s.slot === "am").length;
  capAM = capAM == null ? n : capAM; capPM = capPM == null ? n : capPM;
  const tour = bestTour(stops, home);
  // a visit at a set time around midday (a lunch): everything before it in the loop is the morning
  const noon = stops.find(s => s.fixed && s.hour != null && s.hour >= 11 && s.hour < 14);
  if (noon){
    // roughly one visit an hour from 8:30 until the lunch (3 before a noon lunch), the rest after it.
    // The loop is cut around the lunch: the k stops just before it in the loop are the morning, the rest follow the lunch.
    const target = Math.max(0, Math.min(capAM, Math.floor(noon.hour - 8.5)));
    let best = null;
    for (const dir of [tour, tour.slice().reverse()]){
      const j = dir.indexOf(noon), cyc = dir.slice(j + 1).concat(dir.slice(0, j));
      for (let k = 0; k <= n - 1; k++){
        const pm = cyc.slice(0, n - 1 - k), am = cyc.slice(n - 1 - k), seq = am.concat([noon], pm);
        const ok = am.every(s => s.am) && pm.every(s => s.pm) && k <= capAM && pm.length <= capPM;
        const score = (ok ? 0 : 100) + 3 * Math.abs(k - target) + miles(tourLength(seq, home)) / 10;
        if (!best || score < best.score) best = {seq, k, score};
      }
    }
    if (best.score < 100){
      best.seq.forEach((s,i) => s.slot = i < best.k ? "am" : "pm");
      return {stops: best.seq, miles: Math.round(miles(tourLength(best.seq, home)))};
    }
    // otherwise: the morning stops as a path from home, then the midday visit, then the afternoon from there
    const amS = bestTour(stops.filter(s => s !== noon && s.slot === "am"), home), pmS = bestTour(stops.filter(s => s !== noon && s.slot !== "am"), noon.coords);
    noon.slot = "pm"; const seq = amS.concat([noon], pmS);
    return {stops: seq, miles: Math.round(miles(tourLength(seq, home)))};
  }
  const ks = []; for (let k = Math.max(0, n - capPM); k <= Math.min(n, capAM); k++) ks.push(k);
  ks.sort((a,b) => Math.abs(a-curAM) - Math.abs(b-curAM));
  for (const k of ks) for (const seq of [tour, tour.slice().reverse()]){
    if (seq.every((s,i) => i < k ? s.am : s.pm)){
      seq.forEach((s,i) => s.slot = i < k ? "am" : "pm");
      return {stops: seq, miles: Math.round(miles(tourLength(seq, home)))};
    }
  }
  // fall back: keep slots, order each half by distance
  const am = bestTour(stops.filter(s => s.slot === "am"), home);
  const pmStart = am.length ? am[am.length-1].coords : home;
  const pm = bestTour(stops.filter(s => s.slot === "pm"), pmStart);
  const seq = am.concat(pm);
  return {stops: seq, miles: Math.round(miles(tourLength(seq, home)))};
}

function makeFixedStop(C, f, iso){
  const t = " " + String(f.where || f.note || "").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
  const named = i => { const c = String(C.offices[i].city || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); return c && t.includes(" " + c + " "); };
  const opts = optionsFor(C, f.id, iso);
  let o = opts.find(x => named(x.office)) || opts[0] || null;
  if (o && !named(o.office)){ const i = (C.match.byDoc[f.id] || []).find(named); if (i != null) o = {office:i}; }
  const off = o ? C.offices[o.office] : (C.match.byDoc[f.id]||[]).map(i => C.offices[i])[0];
  return {id:f.id, office: o ? o.office : ((C.match.byDoc[f.id]||[])[0] ?? null), slot:f.slot, coords: off ? off.coords : null, addrKey: off ? off.addrKey : "cal|"+f.id, fixed:true, am:f.slot === "am", pm:f.slot === "pm", note:f.note, time:f.time, hour:f.hour, history:[]};
}
function fillDay(C, plan, iso, opts){
  // Plans the open spots of one day. opts: {variant: n (0 = best area, 1 = next best...), avoid: Set of ids to leave out if possible}
  opts = opts || {};
  const day = plan.days[iso];
  const usedDoc = new Set(), usedAddr = new Set(), cityDays = {};
  for (const k in plan.days){
    plan.days[k].stops.forEach(s => { usedDoc.add(s.id); if (!s.manual && (C.addrRule !== "day" || k === iso)) usedAddr.add(s.addrKey); });
    if (k !== iso) new Set(plan.days[k].stops.map(s => s.office != null ? C.offices[s.office].city : "")).forEach(c => { if (c) cityDays[c] = (cityDays[c]||0) + 1; });
  }
  const feas = C.feas || (C.feas = Object.fromEntries(C.docs.map(d => [d.id, feasibleDays(C, d.id).length])));
  const fixedAM = day.stops.filter(s => s.slot === "am").length, fixedPM = day.stops.filter(s => s.slot === "pm").length;
  day.capAM = C.caps[iso].am; day.capPM = C.caps[iso].pm;
  let capAM = Math.max(0, C.caps[iso].am - fixedAM), capPM = Math.max(0, C.caps[iso].pm - fixedPM);
  const total = Math.max(0, Math.min(C.caps[iso].total - day.stops.length, capAM + capPM));
  day.short = 0;
  if (!total) return;
  const avoid = opts.avoid || new Set();
  const all = [];
  for (const d of C.docs){
    if (usedDoc.has(d.id) || C.blocked.has(iso + "|" + d.id) || C.seen[d.id]) continue;
    for (const o of optionsFor(C, d.id, iso)) if (!usedAddr.has(o.addrKey)) all.push({...o, w: d.score * (1 + 0.6 / Math.max(1, feas[d.id])) - (avoid.has(d.id) ? 0.5 : 0)});
  }
  if (!all.length){ day.short = total; return; }
  // center may be one point or several (e.g. the chosen area plus a fixed lunch); distance is to the nearest one
  const dist = (p, center) => Array.isArray(center[0]) ? Math.min(...center.map(c => km(p, c))) : km(p, center);
  const adj = (o, center) => o.w - 0.02 * dist(o.coords, center) - 0.12 * (cityDays[C.offices[o.office].city] || 0);
  const fill = (center, radius, extra) => {
    const P = all.filter(o => dist(o.coords, center) <= radius || (extra && extra(o))).sort((a,b) => adj(b, center) - adj(a, center));
    const picked = [], dU = new Set(), aU = new Set(); let am = capAM, pm = capPM, n = 0, val = 0;
    for (const o of P){
      if (n >= total || am + pm === 0) break;
      if (dU.has(o.id) || aU.has(o.addrKey)) continue;
      let slot = null;
      if (o.am && o.pm) slot = am >= pm ? (am ? "am" : "pm") : "pm";
      else if (o.am && am) slot = "am"; else if (o.pm && pm) slot = "pm";
      if (!slot || (slot === "am" ? am : pm) <= 0) continue;
      if (slot === "am") am--; else pm--;
      n++; dU.add(o.id); aU.add(o.addrKey); val += adj(o, center); picked.push({...o, slot});
    }
    return {picked, val, left: total - n};
  };
  let centers;
  const fixedC = day.stops.filter(s => s.coords).map(s => s.coords);
  const fc = fixedC.length ? [fixedC.reduce((a,c)=>a+c[0],0)/fixedC.length, fixedC.reduce((a,c)=>a+c[1],0)/fixedC.length] : null;
  const seenC = new Set(); centers = fc ? [fc] : [];
  // with a visit already fixed (a calendar lunch, say), the rest of the day may lean into a neighbouring area, but stays within reach of it
  all.forEach(o => { const k = o.coords.join(","); if (!seenC.has(k) && (!fc || km(o.coords, fc) <= 40)){ seenC.add(k); centers.push(o.coords); } });
  // fixed visits far apart (e.g. a Turlock anchor and an Alameda lunch): fill around each of them, not the midpoint
  let spread = 0; fixedC.forEach(a => fixedC.forEach(b => { spread = Math.max(spread, km(a, b)); }));
  if (spread > 45){
    // with a midday visit (lunch) on one side, the other side gets one half of the day and the lunch side the other
    const fixedS = day.stops.filter(s => s.coords);
    const noon = fixedS.find(s => s.hour != null && s.hour >= 11 && s.hour < 14);
    if (noon){
      const far = fixedS.filter(s => s !== noon && km(s.coords, noon.coords) > 45);
      const nearFar = o => Math.min(...far.map(s => km(s.coords, o.coords))) < km(noon.coords, o.coords);
      let half = far.some(s => s.anchor && s.am && !s.pm) ? "am" : far.some(s => s.anchor && s.pm && !s.am) ? "pm" : null;
      if (!half){ const cnt = h => all.filter(o => nearFar(o) && o[h]).length + (far.every(s => s[h]) ? 3 : 0); half = cnt("am") >= cnt("pm") ? "am" : "pm"; }
      const other = half === "am" ? "pm" : "am";
      far.forEach(s => { s.slot = half; s.am = half === "am"; s.pm = half === "pm"; });
      for (let i = all.length - 1; i >= 0; i--){ const o = all[i], h = nearFar(o) ? half : other; if (!o[h]) all.splice(i, 1); else all[i] = {...o, am: h === "am", pm: h === "pm"}; }
      // the half-day caps now count what's already fixed on each side
      const fa = day.stops.filter(s => s.slot === "am").length, fp = day.stops.filter(s => s.slot === "pm").length;
      capAM = Math.max(0, C.caps[iso].am - fa); capPM = Math.max(0, C.caps[iso].pm - fp);
    }
    let res = fill(fixedC, 20); if (res.left > 0){ const r2 = fill(fixedC, 32); if (r2.left < res.left) res = r2; }
    if (res.left > 0){ const base = fixedC.map(c => km(c, C.home)); const r4 = fill(fixedC, 32, o => fixedC.some((c,i) => km(c, o.coords) + km(o.coords, C.home) - base[i] <= 20)); if (r4.left < res.left) res = r4; }
    res.picked.forEach(o => day.stops.push({id:o.id, office:o.office, slot:o.slot, am:o.am, pm:o.pm, coords:o.coords, addrKey:o.addrKey, history:[]}));
    day.short = res.left; day.center = fc; day.variants = 1; return;
  }
  const ranked = centers.map(c => { const r = fill(c, 20); return {c, r, v: r.val - 0.0025 * km(C.home, c) - 0.4 * r.left - (fc ? 0.012 * km(fc, c) : 0)}; }).sort((a,b) => b.v - a.v);
  // alternatives: distinct areas (skip centres within 8 km of a better one)
  const distinct = []; ranked.forEach(x => { if (!distinct.some(y => km(y.c, x.c) < 8)) distinct.push(x); });
  const pickI = (opts.variant || 0) % Math.max(1, distinct.length);
  const best = distinct[pickI] || ranked[0];
  let res = best.r;
  if (res.left > 0){ const r2 = fill(best.c, 32); if (r2.left < res.left) res = r2; }
  if (res.left > 0 && fc){ const r3 = fill([best.c, fc], 25); if (r3.left < res.left) res = r3; }
  // still short: top up with doctors on the way out or back (a small detour from the drive between home and the day's area)
  if (res.left > 0){
    const c0 = best.c, base = km(c0, C.home);
    const onTheWay = o => km(c0, o.coords) + km(o.coords, C.home) - base <= 20;
    const r4 = fill(fc ? [c0, fc] : c0, 32, onTheWay); if (r4.left < res.left) res = r4;
  }
  res.picked.forEach(o => day.stops.push({id:o.id, office:o.office, slot:o.slot, am:o.am, pm:o.pm, coords:o.coords, addrKey:o.addrKey, history:[]}));
  day.short = res.left; day.center = best.c; day.variants = distinct.length;
}
function planWeek(input){
  const C = buildContext(input);
  const plan = {days:{}};
  const used = new Set();
  for (const iso of C.days){
    plan.days[iso] = {stops:[], area:"", miles:0, short:0, notes:C.busyNotes[iso], variant:0};
    for (const k of ((input.keep || {})[iso] || [])){ if (used.has(k.id)) continue; plan.days[iso].stops.push(JSON.parse(JSON.stringify(k))); used.add(k.id); }
    // anchors: doctors the rep has pinned to this day; they count toward the day and the day is planned around them
    for (const a of (input.anchors || []).filter(a => a.iso === iso)){
      if (used.has(a.id)) continue;
      const opts = optionsFor(C, a.id, iso); let o = opts.find(x => a.addrKey && x.addrKey === a.addrKey) || opts[0];
      if (a.addrKey && (!o || o.addrKey !== a.addrKey)){ const i = (C.match.byDoc[a.id] || []).find(j => C.offices[j].addrKey === a.addrKey); if (i != null){ const of = C.offices[i]; o = {office:i, coords:of.coords, addrKey:of.addrKey, am:true, pm:true}; } }
      if (!o){ const i = (C.match.byDoc[a.id] || [])[0]; if (i == null) continue; const of = C.offices[i]; o = {office:i, coords:of.coords, addrKey:of.addrKey, am:true, pm:true}; }
      const slot = a.slot || (o.am ? "am" : "pm");
      plan.days[iso].stops.push({id:a.id, office:o.office, slot, am: a.slot ? a.slot === "am" : !!o.am, pm: a.slot ? a.slot === "pm" : !!o.pm, coords:o.coords, addrKey:o.addrKey, fixed:true, anchor:true, history:[]});
      used.add(a.id);
    }
    for (const f of (C.fixed[iso] || [])){ if (used.has(f.id)) continue; plan.days[iso].stops.push(makeFixedStop(C, f, iso)); used.add(f.id); }
  }
  // days anchored by a visit already on the calendar get first pick of the doctors around it
  const order = C.days.slice().sort((a,b) => (plan.days[b].stops.length > 0) - (plan.days[a].stops.length > 0) || a.localeCompare(b));
  for (const iso of order) fillDay(C, plan, iso);
  // a day that came up short: try re-planning it together with each other day (short day first) and keep the swap if more visits fit overall
  const auto = s => !s.fixed && !s.done && !s.manual;
  for (const iso of C.days){
    if (!(plan.days[iso].short > 0)) continue;
    for (const other of C.days){
      if (other === iso || !(plan.days[iso].short > 0)) continue;
      const A = plan.days[iso], B = plan.days[other];
      const before = A.stops.length + B.stops.length, saveA = JSON.stringify(A), saveB = JSON.stringify(B);
      A.stops = A.stops.filter(s => !auto(s)); B.stops = B.stops.filter(s => !auto(s));
      fillDay(C, plan, iso); fillDay(C, plan, other);
      if (A.stops.length + B.stops.length > before) continue;
      plan.days[iso] = JSON.parse(saveA); plan.days[other] = JSON.parse(saveB);
    }
  }
  if (!input.noRescue) rescueStranded(C, plan);
  for (const iso of C.days) finishDay(C, plan, iso);
  plan.unscheduled = explainUnscheduled(C, plan);
  return {plan, C};
}
function rebuildDay(C, plan, iso){
  // keep calendar visits and calls already marked done; try the next-best area with different doctors
  const day = plan.days[iso];
  const before = new Set(day.stops.filter(s => !s.fixed && !s.done && !s.manual).map(s => s.id));
  day.stops = day.stops.filter(s => s.fixed || s.done || s.manual);
  day.variant = (day.variant || 0) + 1;
  fillDay(C, plan, iso, {variant: day.variant, avoid: before});
  finishDay(C, plan, iso);
  plan.unscheduled = explainUnscheduled(C, plan);
  return day;
}
// a calendar visit that wasn't in the plan yet (someone just added): put it in and re-plan the rest of that day around it
function placeFixed(C, plan, iso){
  const day = plan.days[iso]; if (!day) return [];
  const added = [];
  for (const f of (C.fixed[iso] || [])){
    if (day.stops.some(s => s.id === f.id)) continue;
    for (const k in plan.days) if (k !== iso) plan.days[k].stops = plan.days[k].stops.filter(s => !(s.id === f.id && !s.fixed && !s.done && !s.manual));
    day.stops.push(makeFixedStop(C, f, iso)); added.push(f.id);
  }
  if (!added.length) return added;
  day.stops = day.stops.filter(s => s.fixed || s.done || s.manual);
  fillDay(C, plan, iso, {variant: day.variant || 0});
  finishDay(C, plan, iso);
  plan.unscheduled = explainUnscheduled(C, plan);
  return added;
}
// A doctor can be left out only because their area landed on a day they aren't in (Patel in Turlock is in Mon/Tue/Thu,
// but the valley day came out as Friday).
function rescueStranded(C, plan){
  const auto = s => !s.fixed && !s.done && !s.manual;
  // value of a visit: the doctor's priority, a bit more when they're in on only a few days (the same weighting the day planner uses)
  const feas = C.feas || (C.feas = Object.fromEntries(C.docs.map(d => [d.id, feasibleDays(C, d.id).length])));
  const val = id => { const d = C.docById[id]; return d ? (d.score || 0) * (1 + 0.6 / Math.max(1, feas[id] || 5)) : 0; };
  const tally = () => { let n = 0, v = 0; for (const k in plan.days) plan.days[k].stops.forEach(s => { n++; v += val(s.id); }); return [n, v]; };
  // the most valuable doctor near one day's area who is in on the other day (and not planned on a third day)
  const seedFor = (fromIso, toIso) => {
    const c = plan.days[fromIso].center; if (!c) return null;
    const elsewhere = new Set(); for (const k in plan.days) if (k !== fromIso && k !== toIso) plan.days[k].stops.forEach(s => elsewhere.add(s.id));
    const taken = new Set(); for (const k in plan.days) if (k !== fromIso && k !== toIso && C.addrRule !== "day") plan.days[k].stops.forEach(s => { if (!s.manual) taken.add(s.addrKey); });
    plan.days[toIso].stops.filter(s => !auto(s)).forEach(s => taken.add(s.addrKey));
    let best = null;
    for (const d of C.docs){
      if (elsewhere.has(d.id) || C.seen[d.id] || C.blocked.has(toIso + "|" + d.id)) continue;
      for (const o of optionsFor(C, d.id, toIso)){
        if (!o.coords || taken.has(o.addrKey) || km(o.coords, c) > 25) continue;
        const v = val(d.id); if (!best || v > best.v) best = {v, o};
      }
    }
    return best && best.o;
  };
  const place = (iso, o) => {
    const day = plan.days[iso]; if (!o || day.stops.length >= C.caps[iso].total) return;
    const amUsed = day.stops.filter(s => s.slot === "am").length;
    const slot = o.am && amUsed < C.caps[iso].am ? "am" : o.pm ? "pm" : "am";
    day.stops.push({id:o.id, office:o.office, slot, am:o.am, pm:o.pm, coords:o.coords, addrKey:o.addrKey, history:[]});
  };
  // Swap two days' areas: plan each day around the other day's area, and keep it only if the week ends up with
  // as many visits and more valuable ones. This is what puts the valley on a day Patel is in.
  for (let pass = 0; pass < 2; pass++){
    let changed = false;
    for (let i = 0; i < C.days.length; i++) for (let j = i + 1; j < C.days.length; j++){
      const A = C.days[i], B = C.days[j];
      if (!plan.days[A].center || !plan.days[B].center || km(plan.days[A].center, plan.days[B].center) < 15) continue;
      const before = tally(), saveA = JSON.stringify(plan.days[A]), saveB = JSON.stringify(plan.days[B]);
      const toB = seedFor(A, B), toA = seedFor(B, A);
      if (!toB && !toA) continue;
      plan.days[A].stops = plan.days[A].stops.filter(s => !auto(s)); plan.days[B].stops = plan.days[B].stops.filter(s => !auto(s));
      place(B, toB); if (!(toA && toB && toA.id === toB.id)) place(A, toA);
      fillDay(C, plan, B); fillDay(C, plan, A);
      const now = tally();
      // and neither day may end up thinner, or stretched across two far-apart areas
      const spread = stops => { let m = 0; const p = stops.filter(s => s.coords); p.forEach(a => p.forEach(b => { m = Math.max(m, km(a.coords, b.coords)); })); return m; };
      const oA = JSON.parse(saveA).stops, oB = JSON.parse(saveB).stops, lim = Math.max(70, spread(oA), spread(oB));
      const tidy = Math.min(plan.days[A].stops.length, plan.days[B].stops.length) >= Math.min(oA.length, oB.length) && spread(plan.days[A].stops) <= lim && spread(plan.days[B].stops) <= lim;
      if (tidy && now[0] >= before[0] && now[1] > before[1] + 1e-6) changed = true;
      else { plan.days[A] = JSON.parse(saveA); plan.days[B] = JSON.parse(saveB); }
    }
    if (!changed) break;
  }
}
function finishDay(C, plan, iso){
  const day = plan.days[iso];
  const pr = s => s.done ? 3 : s.fixed ? 2 : s.manual ? 1 : 0, keepAt = {};
  day.stops.forEach((s,i) => { const k = keepAt[s.id]; if (k == null || pr(s) > pr(day.stops[k])) keepAt[s.id] = i; });
  day.stops = day.stops.filter((s,i) => keepAt[s.id] === i);
  const extra = day.stops.filter(s => s.manual).length;
  const o = orderDay(day.stops.filter(s => s.coords), C.home, (day.capAM ?? 4) + extra, (day.capPM ?? 5) + extra);
  day.stops = o.stops.concat(day.stops.filter(s => !s.coords)); day.miles = o.miles;
  const cities = []; day.stops.forEach(s => { const of = s.office != null ? C.offices[s.office] : null; const c = of ? of.city : ""; if (c && !cities.includes(c)) cities.push(c); });
  const fx = day.stops.filter(s => s.fixed && s.coords); day.farApart = null;
  for (let i = 0; i < fx.length; i++) for (let j = i+1; j < fx.length; j++){ const m = miles(km(fx[i].coords, fx[j].coords)); if (m > 40 && (!day.farApart || m > day.farApart.mi)) day.farApart = {a:fx[i].id, b:fx[j].id, mi: Math.round(m)}; }
  day.area = cities.slice(0,3).join(" · ") + (cities.length > 3 ? " +" + (cities.length-3) : "");
}
function weekUse(plan, exceptIso, exceptIdx, addrRule){
  // doctors used anywhere this week; addresses used this week (or only that day when the rule is "day")
  const d = new Set(), a = new Set();
  for (const iso in plan.days) plan.days[iso].stops.forEach((s,i) => { if (iso === exceptIso && i === exceptIdx) return; d.add(s.id); if (!s.manual && (addrRule !== "day" || iso === exceptIso)) a.add(s.addrKey); });
  return {d, a};
}
function substitutes(C, plan, iso, idx, limit){
  const day = plan.days[iso], cur = day.stops[idx];
  const {d:usedD, a:usedA} = weekUse(plan, iso, idx, C.addrRule);
  const others = day.stops.filter((_,i) => i !== idx && day.stops[i].coords).map(s => s.coords);
  const here = cur.coords;
  const center = others.length ? [others.reduce((a,c)=>a+c[0],0)/others.length, others.reduce((a,c)=>a+c[1],0)/others.length] : (cur.coords || C.home);
  const res = [];
  for (const d of C.docs){
    if (d.id === cur.id || usedD.has(d.id) || C.blocked.has(iso + "|" + d.id) || C.seen[d.id]) continue;
    for (const o of optionsFor(C, d.id, iso)){
      if (usedA.has(o.addrKey)) continue;
      if (!(cur.slot === "am" ? o.am : o.pm)) continue;
      const near = here ? km(here, o.coords) : (others.length ? Math.min(...others.map(c => km(c, o.coords))) : km(center, o.coords));
      const sameOffice = o.addrKey === cur.addrKey;
      res.push({...o, slot:cur.slot, doc:d, near, sameOffice, rank: d.score - 0.03 * near + (sameOffice ? 2 : 0)});
    }
  }
  const best = {}; res.forEach(r => { if (!best[r.id] || r.rank > best[r.id].rank) best[r.id] = r; });
  return Object.values(best).sort((a,b) => b.rank - a.rank).slice(0, limit || 12);
}
function addCandidates(C, plan, iso){
  // every doctor with calls left, with the best office for that day; flags say which rules a manual add would bend
  const day = plan.days[iso];
  const todayIds = new Set(day.stops.map(s => s.id)), todayAddr = new Set(day.stops.map(s => s.addrKey));
  const elsewhere = {}; for (const k in plan.days) if (k !== iso) plan.days[k].stops.forEach(s => elsewhere[s.id] = k);
  const pts = day.stops.filter(s => s.coords).map(s => s.coords);
  const out = [];
  for (const d of C.allDocs || C.docs){
    if (todayIds.has(d.id)) continue;
    let best = null;
    for (const i of (C.match.byDoc[d.id] || [])){
      const o = C.offices[i]; if (!o.coords) continue;
      const a = availableOn(o, iso);
      const near = pts.length ? Math.min(...pts.map(c => km(c, o.coords))) : km(C.home, o.coords);
      const cand = {id:d.id, office:i, coords:o.coords, addrKey:o.addrKey, am: a ? a.am : true, pm: a ? a.pm : true, inToday: !!a, near, doc:d,
        sameOffice: todayAddr.has(o.addrKey), elsewhere: elsewhere[d.id] || null, counterpart: C.blocked.has(iso + "|" + d.id) && !C.away.has(iso + "|" + d.id) && !C.streak.has(iso + "|" + d.id), streak: C.streak.has(iso + "|" + d.id), away: C.away.has(iso + "|" + d.id), seen: C.seen[d.id] || null};
      const key = c => (c.inToday ? 0 : 100) + (c.sameOffice ? 0 : 1) + c.near;
      if (!best || key(cand) < key(best)) best = cand;
    }
    if (best) out.push(best);
  }
  return out.sort((a,b) => (b.sameOffice && b.inToday) - (a.sameOffice && a.inToday) || (b.inToday - a.inToday) || (a.near - b.near) || (b.doc.score - a.doc.score));
}
function addManual(C, plan, iso, cand, slot){
  const day = plan.days[iso];
  day.stops.push({id:cand.id, office:cand.office, slot, am: slot === "am", pm: slot === "pm", coords:cand.coords, addrKey:cand.addrKey, manual:true, history:[]});
  finishDay(C, plan, iso);
}
function removeStop(C, plan, iso, idx, skip){
  const day = plan.days[iso]; const s = day.stops.splice(idx, 1)[0];
  if (skip) s.skipped = true; else delete s.skipped;
  if (!s.manual || skip) (day.removed = day.removed || []).push(s);   // planned (and skipped) stops can be put back
  finishDay(C, plan, iso); return s;
}
function restoreStop(C, plan, iso, k){
  const day = plan.days[iso]; const s = (day.removed || [])[k]; if (!s) return {ok:false};
  const {d, a} = weekUse(plan, null, -1, C.addrRule);
  if (d.has(s.id)) return {ok:false, reason:"conflict-doc", id:s.id};
  if (!s.fixed && !s.manual && C.addrRule !== "day" && a.has(s.addrKey)) return {ok:false, reason:"conflict-addr", id:s.id};
  day.removed.splice(k, 1); delete s.skipped; day.stops.push(s); finishDay(C, plan, iso); return {ok:true, id:s.id};
}
function moveOptions(C, plan, iso, idx){
  // For every other planned day: can this doctor go there without breaking a rule?
  const s = plan.days[iso].stops[idx];
  const {d:usedD, a:usedA} = weekUse(plan, iso, idx, C.addrRule);
  const out = [];
  for (const k of Object.keys(plan.days).sort()){
    if (k === iso) continue;
    const day = plan.days[k];
    const dayAddr = new Set(day.stops.map(x => x.addrKey));
    const opts = optionsFor(C, s.id, k);
    let reason = null, pick = null;
    if (!(C.match.byDoc[s.id] || []).length) reason = "Not in your spreadsheet";
    else if (!opts.length) reason = "Not in that day, per your spreadsheet";
    else if (C.away.has(k + "|" + s.id)) reason = "Out of office that day";
    else if (C.streak.has(k + "|" + s.id)) reason = "That would make three of you on three days in a row";
    else if (C.blocked.has(k + "|" + s.id)) reason = "A counterpart is seeing them that day";
    else if (usedD.has(s.id)) reason = "Already planned another day";
    else {
      pick = opts.find(o => !(C.addrRule === "day" ? dayAddr.has(o.addrKey) : usedA.has(o.addrKey)));
      if (!pick) reason = C.addrRule === "day" ? "You're already at that office that day" : "You're visiting that office another day";
    }
    const pts = day.stops.filter(x => x.coords).map(x => x.coords);
    const near = pick && pts.length ? Math.min(...pts.map(c => km(c, pick.coords))) : null;
    out.push({iso:k, ok: !reason, reason, opt: pick, count: day.stops.length, near});
  }
  return out;
}
function moveStop(C, plan, iso, idx, toIso, opt){
  const s = plan.days[iso].stops.splice(idx, 1)[0];
  plan.days[toIso].stops.push({id:s.id, office:opt.office, slot: opt.am ? "am" : "pm", am:opt.am, pm:opt.pm, coords:opt.coords, addrKey:opt.addrKey, history:[], movedFrom: iso});
  finishDay(C, plan, iso); finishDay(C, plan, toIso);
}
function applySubstitute(C, plan, iso, idx, opt){
  const day = plan.days[iso], cur = day.stops[idx];
  const next = {id:opt.id, office:opt.office, slot:cur.slot, am:opt.am, pm:opt.pm, coords:opt.coords, addrKey:opt.addrKey, history: (cur.history || []).concat([{id:cur.id, office:cur.office, am:cur.am, pm:cur.pm, coords:cur.coords, addrKey:cur.addrKey, fixed:cur.fixed, manual:cur.manual, note:cur.note, time:cur.time}])};
  day.stops[idx] = next; finishDay(C, plan, iso);
  return next;
}
function undoSubstitute(C, plan, iso, idx){
  const day = plan.days[iso], cur = day.stops[idx];
  if (!cur.history.length) return {ok:false, reason:"Nothing to undo."};
  const prev = cur.history[cur.history.length-1];
  const {d, a} = weekUse(plan, iso, idx, C.addrRule);
  if (d.has(prev.id)) return {ok:false, reason:"conflict-doc", id:prev.id};
  if (!prev.manual && a.has(prev.addrKey)) return {ok:false, reason:"conflict-addr", id:prev.id};
  day.stops[idx] = {...prev, slot:cur.slot, history: cur.history.slice(0,-1)};
  finishDay(C, plan, iso);
  return {ok:true, id:prev.id};
}
function explainUnscheduled(C, plan){
  const {d:used} = weekUse(plan, null, -1, C.addrRule);
  const out = C.docs.filter(d => !used.has(d.id)).sort((a,b) => b.score - a.score).map(d => {
    const offs = (C.match.byDoc[d.id]||[]).map(i => C.offices[i]);
    let why;
    if (C.seen[d.id]) why = "Already called this week (" + fromISO(C.seen[d.id]).toLocaleDateString(undefined,{weekday:"short"}) + ")";
    else if (!offs.length) why = "Not found in your spreadsheet";
    else if (offs.every(o => !o.avail)) why = "No days listed in your spreadsheet";
    else if (offs.every(o => o.onLeave)) why = "Spreadsheet notes say on leave";
    else if (offs.every(o => !o.coords)) why = "City not recognized";
    else if (C.allowed && (C.match.byDoc[d.id]||[]).every(i => !C.allowed.has(i))) why = "Outside this week's zone";
    else {
      const avDays = C.days.filter(iso => optionsFor(C, d.id, iso).length);
      if (!avDays.length) why = "Not in on the days you're working";
      else if (avDays.every(iso => C.away.has(iso + "|" + d.id))) why = "Out of office";
      else if (avDays.every(iso => C.blocked.has(iso + "|" + d.id))) why = avDays.some(iso => C.away.has(iso + "|" + d.id)) ? "Out of office or a counterpart is seeing them" : "Counterparts see them on, or right around, the only days they're in";
      else why = "Didn't fit this week's areas";
    }
    return {id:d.id, why};
  });
  return out.filter(u => u.why !== "Outside this week's zone").concat(out.filter(u => u.why === "Outside this week's zone"));
}
function checkPlan(C, plan){
  // returns list of rule problems (used by tests and shown if anything is off)
  const probs = [], seenD = new Map(), seenA = new Map();
  for (const iso in plan.days) plan.days[iso].stops.forEach(s => {
    if (s.manual) return;
    if (seenD.has(s.id)) probs.push("doctor twice: " + s.id); seenD.set(s.id, iso);
    const ak = C.addrRule === "day" ? iso + "|" + s.addrKey : s.addrKey;
    if (seenA.has(ak)) probs.push("address twice: " + s.addrKey); seenA.set(ak, iso);
    if (C.away.has(iso + "|" + s.id)) probs.push("out of office: " + s.id + " " + iso);
    else if (C.blocked.has(iso + "|" + s.id) && !(s.fixed && C.streak.has(iso + "|" + s.id))) probs.push((C.streak.has(iso + "|" + s.id) ? "three days in a row: " : "counterpart same day: ") + s.id + " " + iso);
    if (!s.fixed){ const a = s.office != null ? availableOn(C.offices[s.office], iso) : null; if (!a || !(s.slot === "am" ? a.am : a.pm)) probs.push("not available: " + s.id + " " + iso + " " + s.slot); }
  });
  return probs;
}

/* ---------------- loading the tracker's numbers ---------------- */
function docsFromTrackerFile(obj){
  // accepts the tracker's routing export, its backup file, or the tracker's saved data on this device
  const todayISO = isoDay(new Date());
  if (obj && obj.format === "calltracker-remaining-calls" && Array.isArray(obj.doctors))
    return obj.doctors.map(r => ({id:normName(r.name), name:String(r.name).toUpperCase(), city:r.city||"", remaining:+r.remaining||0, assigned:+r.assigned||0, completed:+r.completed||0, lastCall:r.lastCall||null, daysSinceLastCall:r.daysSinceLastCall ?? null, callsPerWeekNeeded:r.callsPerWeekNeeded ?? null})).filter(d => d.remaining > 0);
  if (obj && Array.isArray(obj.doctors) && obj.doctors.length && "r0" in obj.doctors[0]){
    const end = obj.planEnd && obj.planEnd >= todayISO ? obj.planEnd : null;
    const weeksLeft = end ? Math.max(1, Math.ceil((Math.round((fromISO(end)-fromISO(todayISO))/864e5)+1)/7)) : null;
    return obj.doctors.map(d => {
      const rem = Math.max(0, d.r0 - d.log.length); const lc = d.log.concat(d.hist || [], d.lastRpt ? [d.lastRpt] : []).sort().pop() || null;
      return {id:normName(d.name), name:d.name, city:d.city, remaining:rem, assigned:d.a, completed:d.c0 + d.log.length, lastCall:lc, added: !!d.added, kind: d.kind || "",
        daysSinceLastCall: lc ? Math.round((fromISO(todayISO)-fromISO(lc))/864e5) : null, callsPerWeekNeeded: d.added ? 0 : (weeksLeft ? rem/weeksLeft : null),
        noAuto: false};
    });
  }
  throw new Error("That file isn't a remaining-calls export from the Call Tracker.");
}
function docsFromCSV(text){
  const rows = csvRows(text); const H = rows[0].map(h => h.toLowerCase());
  const c = n => H.findIndex(h => h.includes(n));
  const iN = c("doctor"), iC = c("city"), iR = c("remaining"), iA = c("assigned"), iL = c("last call"), iD = c("days since"), iW = c("per week");
  if (iN < 0 || iR < 0) throw new Error("That CSV isn't a remaining-calls export from the Call Tracker.");
  return rows.slice(1).filter(r => r[iN]).map(r => ({id:normName(r[iN]), name:r[iN].toUpperCase(), city:r[iC]||"", remaining:+r[iR]||0, assigned:+r[iA]||0, lastCall:r[iL]||null,
    daysSinceLastCall: r[iD] === "" || r[iD] == null ? null : +r[iD], callsPerWeekNeeded: r[iW] === "" || r[iW] == null ? null : +r[iW]})).filter(d => d.remaining > 0);
}
function csvRows(text){
  const rows = []; let row = [], cell = "", q = false;
  for (let i=0;i<text.length;i++){
    const ch = text[i];
    if (q){ if (ch === '"' && text[i+1] === '"'){ cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ","){ row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r"){ if (ch === "\r" && text[i+1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

const api = {parseSharedWeek, isPerson, ANYTIME, availText, splitCity, detectColumns, isoDay, fromISO, addDays, mondayOf, weekDays, CITIES, ZIPS, loadGeo, cityCoords, km, miles, parseAvailability, splitSheetName, addressKey,
  officesFromRows, normName, matchDoctors, buildNameIndex, findDoctorsInText, parseICS, expandEvents, classifyEvent, MEAL_RE: MEAL, parseTSV,
  scheduleFromWords, scoreDoctors, paceSummary, holidaysOf, availableOn, planWeek, rebuildDay, placeFixed, fillDay, addCandidates, addManual, removeStop, restoreStop, moveOptions, moveStop, officeInZone, zipOf, cityKey, buildContext, substitutes, applySubstitute, undoSubstitute, checkPlan, finishDay,
  docsFromTrackerFile, docsFromCSV, csvRows, explainUnscheduled};
if (typeof module !== "undefined") module.exports = api; else root.RouteLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
