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
const CITIES = {
 "concord":[37.978,-122.031],"walnut creek":[37.906,-122.065],"pleasant hill":[37.948,-122.061],"martinez":[38.019,-122.134],
 "lafayette":[37.886,-122.118],"orinda":[37.877,-122.180],"moraga":[37.835,-122.130],"danville":[37.822,-121.999],
 "alamo":[37.850,-122.032],"san ramon":[37.780,-121.978],"dublin":[37.702,-121.936],"pleasanton":[37.662,-121.875],
 "livermore":[37.682,-121.768],"castro valley":[37.694,-122.086],"hayward":[37.669,-122.081],"san leandro":[37.725,-122.156],
 "san lorenzo":[37.681,-122.124],"union city":[37.596,-122.044],"fremont":[37.548,-121.989],"newark":[37.530,-122.040],
 "milpitas":[37.428,-121.907],"san jose":[37.338,-121.886],"santa clara":[37.354,-121.955],"sunnyvale":[37.369,-122.036],
 "mountain view":[37.386,-122.084],"palo alto":[37.442,-122.143],"oakland":[37.804,-122.271],"emeryville":[37.831,-122.285],
 "berkeley":[37.872,-122.273],"albany":[37.887,-122.298],"el cerrito":[37.916,-122.311],"richmond":[37.936,-122.348],
 "san pablo":[37.962,-122.346],"pinole":[38.004,-122.299],"hercules":[38.017,-122.289],"rodeo":[38.033,-122.267],
 "el sobrante":[37.977,-122.295],"alameda":[37.765,-122.242],"piedmont":[37.824,-122.232],"antioch":[38.005,-121.806],
 "pittsburg":[38.028,-121.885],"bay point":[38.029,-121.962],"brentwood":[37.932,-121.696],"oakley":[37.997,-121.712],
 "discovery bay":[37.909,-121.600],"clayton":[37.941,-121.936],"benicia":[38.049,-122.159],"vallejo":[38.104,-122.257],
 "fairfield":[38.249,-122.040],"vacaville":[38.357,-121.988],"napa":[38.297,-122.287],"tracy":[37.740,-121.425],
 "mountain house":[37.783,-121.543],"manteca":[37.797,-121.216],"lathrop":[37.823,-121.276],"ripon":[37.742,-121.124],
 "stockton":[37.958,-121.291],"lodi":[38.130,-121.272],"galt":[38.255,-121.300],"modesto":[37.639,-120.997],
 "ceres":[37.595,-120.958],"turlock":[37.495,-120.847],"riverbank":[37.736,-120.935],"oakdale":[37.767,-120.847],
 "escalon":[37.797,-120.998],"patterson":[37.472,-121.130],"newman":[37.314,-121.021],"merced":[37.302,-120.483],
 "atwater":[37.348,-120.609],"livingston":[37.387,-120.724],"los banos":[37.058,-120.850],"sonora":[37.984,-120.382],
 "sacramento":[38.582,-121.494],"elk grove":[38.409,-121.372],"san francisco":[37.775,-122.419],"daly city":[37.688,-122.470],
 "south san francisco":[37.654,-122.408],"san mateo":[37.563,-122.326],"redwood city":[37.485,-122.236],"burlingame":[37.584,-122.366]
};
const cityKey = s => String(s||"").toLowerCase().replace(/[^a-z ]+/g," ").replace(/\s+/g," ").trim();
function cityCoords(city, address){
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
  const m = String(address||"").match(/(?:,|\bCA\b|\bCalifornia\b)\s*(\d{5})(?:-\d{4})?\s*$/i); return m ? m[1] : "";
}
function officeInZone(o, zone){
  if (!zone) return true;
  if (o.zip && (zone.zips||[]).includes(o.zip)) return true;
  return (zone.cities||[]).includes(cityKey(o.city));
}
function officesFromRows(rows){
  // rows: array of arrays (first row may be header somewhere in the first 6)
  let hi = rows.findIndex((r,i) => i < 8 && r.some(c => /name|doctor|provider|physician/i.test(String(c||""))) && r.some(c => /address|street/i.test(String(c||""))));
  if (hi < 0) throw new Error("Couldn't find the header row. The sheet needs columns named Name, Address, City and Availability (or Days).");
  const H = rows[hi].map(c => String(c||"").trim());
  const col = re => H.findIndex(h => re.test(h));
  const cName = col(/^(name|doctor|provider|physician|hcp)/i), cCity = col(/city/i), cAvail = col(/avail|best time|days|schedule/i);
  const cNotes = col(/note|contact/i), cOrg = col(/org|group|practice|clinic|company/i), cSpec = col(/special/i), cZip = col(/zip|postal/i);
  const addrCols = H.map((h,i) => /address|street/i.test(h) ? i : -1).filter(i => i >= 0);
  const missing = []; if (cName<0) missing.push("Name"); if (!addrCols.length) missing.push("Address"); if (cCity<0) missing.push("City"); if (cAvail<0) missing.push("Availability");
  if (missing.length) throw new Error("The spreadsheet is missing a column for: " + missing.join(", ") + ".");
  const body = rows.slice(hi+1);
  const goodAddr = v => { v = String(v||"").trim(); return v && !/^=|https?:|hyperlink/i.test(v); };
  const score = i => body.reduce((n,r) => n + (goodAddr(r[i]) && /^\d/.test(String(r[i]).trim()) ? 1 : 0), 0);
  const order = addrCols.slice().sort((a,b) => score(b)-score(a));
  const offices = [];
  body.forEach((r, idx) => {
    const name = String(r[cName]||"").trim(); if (!name) return;
    let address = ""; for (const i of order) if (goodAddr(r[i])) { address = String(r[i]).trim(); break; }
    const city = String(r[cCity]||"").trim().replace(/\s+/g," ");
    if (city) address = address.replace(new RegExp("[,\\s]+" + city.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\s*$", "i"), "").trim();
    const notes = cNotes >= 0 ? String(r[cNotes]||"").trim() : "";
    const avail = parseAvailability(r[cAvail]);
    offices.push({
      row: hi + idx + 2, rawName: name, ...splitSheetName(name),
      specialty: cSpec >= 0 ? String(r[cSpec]||"").trim() : "",
      address, city, availText: String(r[cAvail]||"").trim(), avail,
      notes, org: cOrg >= 0 ? String(r[cOrg]||"").trim() : "",
      zip: zipOf(cZip >= 0 ? r[cZip] : "", address),
      onLeave: /maternity leave|on leave|leave of absence|retired|no longer (here|with|at)/i.test(notes),
      coords: cityCoords(city, address), addrKey: addressKey(address || city, city)
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
const NEEDS_CONTEXT = new Set(["PARK","HEAL","LONG","LEE","HO","LU","SU","JUAN","KONG","LIANG","LIU","CHU","MAA","WONG","LOWERY","HUANG"]);
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
function findDoctorsInText(text, nameIndex){
  const W = normName(text).split(" ").filter(Boolean);
  const found = new Map(); // id -> true (sure) | false (probably)
  const put = (id, sure) => { if (sure) found.set(id, true); else if (!found.has(id)) found.set(id, false); };
  for (let i=0;i<W.length;i++){
    const group = nameIndex.byLast[W[i]]; if (!group) continue;
    const near = W.slice(Math.max(0,i-3), i+4), nearText = " " + W.slice(Math.max(0,i-3), i+8).join(" ").toLowerCase() + " ";
    const drHit = W[i-1] === "DR" || W[i-2] === "DR";
    const full = group.filter(e => near.some(w => w.length > 1 && (w === e.first || (w.length >= 3 && e.first.startsWith(w)))));
    const initial = group.filter(e => near.some(w => w.length === 1 && w === e.first[0]));
    const byCity = group.filter(e => e.cities.some(c => c && nearText.includes(" " + c + " ")));
    if (full.length){ full.forEach(e => put(e.id, true)); continue; }
    if (group.length === 1){
      const e = group[0];
      const risky = NEEDS_CONTEXT.has(e.last) || e.last.length < 3;
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
    else if (N === "ORGANIZER" || N === "ATTENDEE"){ const cn = params.match(/CN="?([^";:]+)"?/i); cur.attendees.push(cn ? cn[1] : val.replace(/^mailto:/i,"")); }
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
    if (en > from && s < to) out.push({start:s, end:en, allDay:e.start.allDay, summary:e.summary||"", location:e.location||"", description:e.description||"", attendees:e.attendees, transp:e.transp, uid:e.uid});
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
function classifyEvent(ev, counterparts, nameIndex){
  const text = [ev.summary, ev.location, ev.description, (ev.attendees||[]).join(" ")].join(" \n ");
  const who = counterparts.filter(c => c && wordIn(text, c));
  const docs = findDoctorsInText([ev.summary, ev.location, ev.description].join(" \n "), nameIndex);
  let kind;
  if (who.length && docs.length) kind = "counterpart";
  else if (who.length) kind = "ignore";
  else if (docs.length) kind = "mine";
  else kind = ev.transp === "TRANSPARENT" ? "ignore" : "busy";
  return {kind, who, docs};
}

/* ---------------- Ann / Chase screenshots (OCR TSV) ---------------- */
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
function scoreDoctors(docs){
  const need = d => d.callsPerWeekNeeded != null ? d.callsPerWeekNeeded : (d.assigned ? d.remaining / d.assigned : 0);
  const maxNeed = Math.max(0.0001, ...docs.map(need));
  docs.forEach(d => {
    const stale = d.daysSinceLastCall == null ? 1 : Math.min(d.daysSinceLastCall, 60) / 60;
    d.score = 0.8 * need(d) / maxNeed + 0.2 * stale;
  });
  return docs;
}

/* ---------------- scheduling ---------------- */
function availableOn(office, iso){
  if (!office.avail || office.onLeave || !office.coords) return null;
  const a = office.avail.days[dow(iso)]; if (!a) return null;
  if (office.avail.nth.length && !office.avail.nth.includes(Math.ceil(fromISO(iso).getDate()/7))) return null;
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
  C.blocked = new Set(input.counterpartVisits.map(v => v.date + "|" + v.id));
  C.caps = {}; C.fixed = {}; C.busyNotes = {}; C.addrRule = input.addrRule || "week";
  C.allowed = input.zone ? new Set(input.offices.map((o,i) => officeInZone(o, input.zone) ? i : -1).filter(i => i >= 0)) : null;
  for (const iso of input.days){
    let busyA = 0, busyP = 0, off = false; const notes = [];
    for (const ev of input.calendar){
      if (ev.kind !== "busy" && ev.kind !== "mine") continue;
      const covers = ev.allDay ? (ev.start <= fromISO(iso) && ev.end > fromISO(iso)) : isoDay(ev.start) === iso;
      if (!covers) continue;
      if (ev.kind === "busy"){
        if (ev.allDay){ off = true; notes.push({label:"All day", text:ev.summary}); continue; }
        const mA = minutesOverlap(ev, iso, 8, 12), mP = minutesOverlap(ev, iso, 12, 17);
        busyA += mA; busyP += mP;
        if (mA || mP) notes.push({label: ev.start.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}), text:ev.summary});
      } else {
        (ev.docs||[]).filter(x => x.sure !== false).forEach(x => {
          if (!C.docById[x.id]) return;
          const slot = ev.allDay ? "am" : (ev.start.getHours() < 12 ? "am" : "pm");
          (C.fixed[iso] = C.fixed[iso] || []).push({id:x.id, slot, from:"calendar", note:ev.summary, time:ev.allDay ? "" : ev.start.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})});
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
  const opts = optionsFor(C, f.id, iso); const o = opts[0] || null;
  const off = o ? C.offices[o.office] : (C.match.byDoc[f.id]||[]).map(i => C.offices[i])[0];
  return {id:f.id, office: o ? o.office : ((C.match.byDoc[f.id]||[])[0] ?? null), slot:f.slot, coords: off ? off.coords : null, addrKey: off ? off.addrKey : "cal|"+f.id, fixed:true, am:f.slot === "am", pm:f.slot === "pm", note:f.note, time:f.time, history:[]};
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
  const capAM = Math.max(0, C.caps[iso].am - fixedAM), capPM = Math.max(0, C.caps[iso].pm - fixedPM);
  const total = Math.max(0, Math.min(C.caps[iso].total - day.stops.length, capAM + capPM));
  day.short = 0;
  if (!total) return;
  const avoid = opts.avoid || new Set();
  const all = [];
  for (const d of C.docs){
    if (usedDoc.has(d.id) || C.blocked.has(iso + "|" + d.id)) continue;
    for (const o of optionsFor(C, d.id, iso)) if (!usedAddr.has(o.addrKey)) all.push({...o, w: d.score * (1 + 0.6 / Math.max(1, feas[d.id])) - (avoid.has(d.id) ? 0.5 : 0)});
  }
  if (!all.length){ day.short = total; return; }
  const adj = (o, center) => o.w - 0.02 * km(o.coords, center) - 0.12 * (cityDays[C.offices[o.office].city] || 0);
  const fill = (center, radius) => {
    const P = all.filter(o => km(o.coords, center) <= radius).sort((a,b) => adj(b, center) - adj(a, center));
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
  if (fixedC.length) centers = [[fixedC.reduce((a,c)=>a+c[0],0)/fixedC.length, fixedC.reduce((a,c)=>a+c[1],0)/fixedC.length]];
  else { const seen = new Set(); centers = []; all.forEach(o => { const k = o.coords.join(","); if (!seen.has(k)){ seen.add(k); centers.push(o.coords); } }); }
  const ranked = centers.map(c => { const r = fill(c, 20); return {c, r, v: r.val - 0.0025 * km(C.home, c) - 0.4 * r.left}; }).sort((a,b) => b.v - a.v);
  // alternatives: distinct areas (skip centres within 8 km of a better one)
  const distinct = []; ranked.forEach(x => { if (!distinct.some(y => km(y.c, x.c) < 8)) distinct.push(x); });
  const pickI = (opts.variant || 0) % Math.max(1, distinct.length);
  const best = distinct[pickI] || ranked[0];
  let res = best.r;
  if (res.left > 0){ const r2 = fill(best.c, 32); if (r2.left < res.left) res = r2; }
  res.picked.forEach(o => day.stops.push({id:o.id, office:o.office, slot:o.slot, am:o.am, pm:o.pm, coords:o.coords, addrKey:o.addrKey, history:[]}));
  day.short = res.left; day.center = best.c; day.variants = distinct.length;
}
function planWeek(input){
  const C = buildContext(input);
  const plan = {days:{}};
  const used = new Set();
  for (const iso of C.days){
    plan.days[iso] = {stops:[], area:"", miles:0, short:0, notes:C.busyNotes[iso], variant:0};
    for (const f of (C.fixed[iso] || [])){ if (used.has(f.id)) continue; plan.days[iso].stops.push(makeFixedStop(C, f, iso)); used.add(f.id); }
  }
  for (const iso of C.days) fillDay(C, plan, iso);
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
function finishDay(C, plan, iso){
  const day = plan.days[iso];
  const extra = day.stops.filter(s => s.manual).length;
  const o = orderDay(day.stops.filter(s => s.coords), C.home, (day.capAM ?? 4) + extra, (day.capPM ?? 5) + extra);
  day.stops = o.stops.concat(day.stops.filter(s => !s.coords)); day.miles = o.miles;
  const cities = []; day.stops.forEach(s => { const of = s.office != null ? C.offices[s.office] : null; const c = of ? of.city : ""; if (c && !cities.includes(c)) cities.push(c); });
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
    if (d.id === cur.id || usedD.has(d.id) || C.blocked.has(iso + "|" + d.id)) continue;
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
  for (const d of C.docs){
    if (todayIds.has(d.id)) continue;
    let best = null;
    for (const i of (C.match.byDoc[d.id] || [])){
      const o = C.offices[i]; if (!o.coords) continue;
      const a = availableOn(o, iso);
      const near = pts.length ? Math.min(...pts.map(c => km(c, o.coords))) : km(C.home, o.coords);
      const cand = {id:d.id, office:i, coords:o.coords, addrKey:o.addrKey, am: a ? a.am : true, pm: a ? a.pm : true, inToday: !!a, near, doc:d,
        sameOffice: todayAddr.has(o.addrKey), elsewhere: elsewhere[d.id] || null, counterpart: C.blocked.has(iso + "|" + d.id)};
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
function removeStop(C, plan, iso, idx){
  const day = plan.days[iso]; const s = day.stops.splice(idx, 1)[0]; finishDay(C, plan, iso); return s;
}
function applySubstitute(C, plan, iso, idx, opt){
  const day = plan.days[iso], cur = day.stops[idx];
  const next = {id:opt.id, office:opt.office, slot:cur.slot, am:opt.am, pm:opt.pm, coords:opt.coords, addrKey:opt.addrKey, history: cur.history.concat([{id:cur.id, office:cur.office, am:cur.am, pm:cur.pm, coords:cur.coords, addrKey:cur.addrKey, fixed:cur.fixed, note:cur.note, time:cur.time}])};
  day.stops[idx] = next; finishDay(C, plan, iso);
  return next;
}
function undoSubstitute(C, plan, iso, idx){
  const day = plan.days[iso], cur = day.stops[idx];
  if (!cur.history.length) return {ok:false, reason:"Nothing to undo."};
  const prev = cur.history[cur.history.length-1];
  const {d, a} = weekUse(plan, iso, idx, C.addrRule);
  if (d.has(prev.id)) return {ok:false, reason:"conflict-doc", id:prev.id};
  if (a.has(prev.addrKey)) return {ok:false, reason:"conflict-addr", id:prev.id};
  day.stops[idx] = {...prev, slot:cur.slot, history: cur.history.slice(0,-1)};
  finishDay(C, plan, iso);
  return {ok:true, id:prev.id};
}
function explainUnscheduled(C, plan){
  const {d:used} = weekUse(plan, null, -1, C.addrRule);
  const out = C.docs.filter(d => !used.has(d.id)).sort((a,b) => b.score - a.score).map(d => {
    const offs = (C.match.byDoc[d.id]||[]).map(i => C.offices[i]);
    let why;
    if (!offs.length) why = "Not found in your spreadsheet";
    else if (offs.every(o => !o.avail)) why = "No days listed in your spreadsheet";
    else if (offs.every(o => o.onLeave)) why = "Spreadsheet notes say on leave";
    else if (offs.every(o => !o.coords)) why = "City not recognized";
    else if (C.allowed && (C.match.byDoc[d.id]||[]).every(i => !C.allowed.has(i))) why = "Outside this week's zone";
    else {
      const avDays = C.days.filter(iso => optionsFor(C, d.id, iso).length);
      if (!avDays.length) why = "Not in on the days you're working";
      else if (avDays.every(iso => C.blocked.has(iso + "|" + d.id))) why = "A counterpart sees them on the only days they're in";
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
    if (C.blocked.has(iso + "|" + s.id)) probs.push("counterpart same day: " + s.id + " " + iso);
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
      const rem = Math.max(0, d.r0 - d.log.length); const lc = d.log.length ? d.log.slice().sort()[d.log.length-1] : null;
      return {id:normName(d.name), name:d.name, city:d.city, remaining:rem, assigned:d.a, completed:d.c0 + d.log.length, lastCall:lc,
        daysSinceLastCall: lc ? Math.round((fromISO(todayISO)-fromISO(lc))/864e5) : null, callsPerWeekNeeded: weeksLeft ? rem/weeksLeft : null};
    }).filter(d => d.remaining > 0);
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

const api = {isoDay, fromISO, addDays, mondayOf, weekDays, CITIES, cityCoords, km, miles, parseAvailability, splitSheetName, addressKey,
  officesFromRows, normName, matchDoctors, buildNameIndex, findDoctorsInText, parseICS, expandEvents, classifyEvent, parseTSV,
  scheduleFromWords, scoreDoctors, availableOn, planWeek, rebuildDay, fillDay, addCandidates, addManual, removeStop, officeInZone, zipOf, cityKey, buildContext, substitutes, applySubstitute, undoSubstitute, checkPlan, finishDay,
  docsFromTrackerFile, docsFromCSV, csvRows, explainUnscheduled};
if (typeof module !== "undefined") module.exports = api; else root.RouteLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
