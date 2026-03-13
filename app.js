
function initApp() {
function showFatal(msg){
  const wrap = document.querySelector('.map-wrap') || document.body;
  const el = document.createElement('div');
  el.style.cssText='position:absolute;inset:80px 16px auto 16px;background:#111827;color:#fff;padding:14px 16px;border-radius:12px;font-family:monospace;font-size:12px;z-index:5000;box-shadow:0 10px 30px rgba(0,0,0,0.35);';
  el.textContent = 'MK Maps error: ' + msg;
  wrap.appendChild(el);
}

window.addEventListener('error', (e)=>{
  try{ showFatal(e?.message||'Unknown error'); }catch(err){}
});

if(!window.mapboxgl){
  showFatal('Mapbox failed to load.');
  return;
}

// â”€â”€ CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
mapboxgl.accessToken = 'pk.eyJ1IjoibWtjaGVzcyIsImEiOiJjbWt5YjM0ejMwNmt6M2RzNm9sZmdoZGM4In0.FBGsSGKuCtYzLoDNbZx51Q';
const SB_URL = 'https://hubwwdbecarttljomhpn.supabase.co';
const SB_KEY = 'sb_publishable_qFXNprIkMnaq-7J98ZghLg_WPhe8XkW';
const H = { apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}`, 'Content-Type':'application/json' };

const catColor = { Flooding:'#4a9eff',Closure:'#E83A2F',Lighting:'#f5a623',Obstruction:'#4caf7d',Surface:'#a78bfa',Pothole:'#f87171','Anti-social behaviour':'#fb923c' };
const catEmoji = { Flooding:'ðŸŒŠ',Closure:'ðŸš§',Lighting:'ðŸ’¡',Obstruction:'ðŸ—‘ï¸',Surface:'âš ï¸',Pothole:'ðŸ•³ï¸','Anti-social behaviour':'ðŸš¨' };

// â”€â”€ DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const db = {
  async get(t,q=''){const r=await fetch(`${SB_URL}/rest/v1/${t}?select=*${q}&order=created_at.desc`,{headers:H});return r.json();},
  async post(t,d){return fetch(`${SB_URL}/rest/v1/${t}`,{method:'POST',headers:{...H,Prefer:'return=minimal'},body:JSON.stringify(d)});},
  async patch(t,id,d){return fetch(`${SB_URL}/rest/v1/${t}?id=eq.${id}`,{method:'PATCH',headers:H,body:JSON.stringify(d)});}
};

// â”€â”€ MAP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const map = new mapboxgl.Map({
  container:'map', style:'mapbox://styles/mapbox/dark-v11',
  center:[-0.7594,52.0406], zoom:13, attributionControl:false
});
map.addControl(new mapboxgl.NavigationControl(),'bottom-right');
map.addControl(new mapboxgl.GeolocateControl({positionOptions:{enableHighAccuracy:true},trackUserLocation:true,showUserHeading:true}),'bottom-right');
map.addControl(new mapboxgl.AttributionControl({compact:true}),'bottom-right');

// State
let activeLayer = 'issues';
let data = {issues:[],transport:[],events:[],places:[],parking:[]};
let markers = {issues:[],transport:[],events:[],places:[],parking:[]};
let pendingMarker = null, pendingLat = null, pendingLng = null;
let redwaysVisible = false;
let selectedRating = 0;
let userLat = null, userLng = null;
let nearMeActive = false;
let activeSort = 'recent';
let activeFilters = {};
let routeMode = 'driving';
let routeLayer = null;
let transportLive = false;
let transportTimer = null;
let transportView = 'all';
let transportRouteQuery = '';
let lastRouteGeo = null;
const quickTrips = [
  {name:'CMK Station', lat:52.0341, lng:-0.7717, icon:'ðŸš‚'},
  {name:'Stadium MK', lat:51.9975, lng:-0.7349, icon:'ðŸŸï¸'},
  {name:'The Centre:mk', lat:52.0424, lng:-0.7606, icon:'ðŸ¬'},
  {name:'Willen Lake', lat:52.0450, lng:-0.7004, icon:'ðŸŒŠ'},
  {name:'MK Hospital', lat:52.0118, lng:-0.7565, icon:'ðŸ¥'},
  {name:'Xscape', lat:52.0377, lng:-0.7619, icon:'â›¸ï¸'}
];

// Map click
map.on('click', e => {
  if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest('.mapboxgl-marker')) return;
  if (activeLayer === 'issues' || activeLayer === 'events') {
    const {lat,lng} = e.lngLat;
    pendingLat=lat; pendingLng=lng;
    const color = activeLayer === 'issues' ? '#E83A2F' : '#f5a623';
    setPendingMarker(lat,lng,color);
    if(activeLayer === 'issues') openReportModal(lat,lng);
    else openEventModal(lat,lng);
  }
});

function setPendingMarker(lat,lng,color) {
  if(pendingMarker) pendingMarker.remove();
  const el=document.createElement('div');
  el.style.cssText=`width:16px;height:16px;background:white;border-radius:50%;border:3px solid ${color};box-shadow:0 0 0 4px ${color}33`;
  pendingMarker=new mapboxgl.Marker({element:el}).setLngLat([lng,lat]).addTo(map);
}

// â”€â”€ LAYER SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setLayer(layer, btn) {
  activeLayer = layer;
  saveLayer(layer);
  document.querySelectorAll('.layer-btn:not(.redways)').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById('transportControls').style.display = layer==='transport' ? 'flex' : 'none';
  document.getElementById('sortRow').style.display = layer==='issues' ? 'flex' : 'none';
  document.querySelectorAll('.layer-item').forEach(i=>i.classList.remove('active'));
  const mi = document.getElementById('menu-'+layer);
  if(mi) mi.classList.add('active');
  const titles={issues:'Live Issues',transport:'Public Transport',events:"What's On",places:'Places & Businesses',parking:'Free Parking'};
  const hints={issues:'Click map to report an issue',transport:'Live bus & train info',events:'Click map to add an event',places:'Click a place for full details',parking:'Free parking spaces and lots'};
  document.getElementById('sidebarTitle').textContent=titles[layer];
  document.getElementById('mapHint').textContent=hints[layer];
  document.getElementById('mapHint').style.opacity='1';
  setTimeout(()=>{document.getElementById('mapHint').style.opacity='0';},4000);
  showSkeletons(4);
  if(layer==='issues') loadIssues();
  else if(layer==='transport') {loadTransport(); document.getElementById('fab').style.display='none';}
  else if(layer==='events') {loadEvents(); document.getElementById('fab').style.display='flex';}
  else if(layer==='places') {loadPlaces(); document.getElementById('fab').style.display='none';}
  else if(layer==='parking') {loadParking(); document.getElementById('fab').style.display='none';}
  if(layer!=='issues') document.getElementById('fab').style.display = layer==='events'?'flex':'none';
  else document.getElementById('fab').style.display='flex';
}

// â”€â”€ ISSUES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadIssues() {
  try {
    const d=await db.get('reports');
    data.issues=Array.isArray(d)?d.filter(r=>!r.resolved):[];
    if(!Array.isArray(d)) data.issues=getSampleIssues();
    renderIssuesSidebar();
    renderIssueMarkers();
    renderLocalIntel();
  } catch(e){
    console.error(e);
    data.issues=getSampleIssues();
    renderIssuesSidebar();
    renderIssueMarkers();
    renderLocalIntel();
  }
}

function renderIssuesSidebar() {
  const today=new Date().toDateString();
  document.getElementById('s1').textContent=data.issues.length;
  document.getElementById('s2').textContent=data.issues.filter(r=>new Date(r.created_at).toDateString()===today).length;
  document.getElementById('s3').textContent=data.issues.reduce((s,r)=>s+(r.upvotes||0),0);
  document.getElementById('sidebarCount').textContent=data.issues.length;

  // Filters
  const cats=[...new Set(data.issues.map(r=>r.category))].filter(Boolean);
  renderFilterBar(cats);

  let issues=[...data.issues];
  const f=activeFilters['issues'];
  if(f) issues=issues.filter(r=>r.category===f);
  if(activeSort==='near'&&userLat) {
    issues=issues.map(r=>({...r,_dist:distKm(userLat,userLng,r.latitude,r.longitude)})).sort((a,b)=>a._dist-b._dist);
  }

  const body=document.getElementById('sidebarBody');
  if(!issues.length){body.innerHTML=`<div class="empty"><div class="ei">ðŸ›¤ï¸</div><p>No issues${f?' for '+f:''} yet.<br/>Tap + to be the first.</p></div>`;return;}
  body.innerHTML=issues.map(r=>`
    <div class="card" onclick="showIssueDetail(${r.id})">
      <div class="card-top">
        <span class="card-tag" style="background:${catColor[r.category]||'#888'}20;color:${catColor[r.category]||'#888'}">${catEmoji[r.category]||'âš ï¸'} ${r.category}</span>
        <span class="card-time">${timeAgo(r.created_at)}</span>
      </div>
      <div class="card-title">${r.title}</div>
      ${r.description?`<div class="card-sub">${r.description}</div>`:''}
      <div class="card-footer">
        <button class="upvote-btn" onclick="upvoteIssue(event,${r.id})">â–² ${r.upvotes||0} confirmed</button>
        <span class="card-meta">${r._dist!==undefined?`<span class="card-dist">ðŸ“ ${fmtDist(r._dist)}</span>`:parseFloat(r.latitude).toFixed(3)+', '+parseFloat(r.longitude).toFixed(3)}</span>
      </div>
    </div>`).join('');
}

async function markResolved(e,id) {
  if(e&&e.stopPropagation) e.stopPropagation();
  if(!confirm('Mark this issue as resolved?')) return;
  await db.patch('reports',id,{resolved:true});
  data.issues=data.issues.filter(x=>x.id!==id);
  renderIssuesSidebar();
  renderIssueMarkers();
  renderLocalIntel();
  closeDetail();
}

function renderIssueMarkers() {
  markers.issues.forEach(m=>m.remove()); markers.issues=[];
  data.issues.forEach(r=>{
    if(!r.latitude||!r.longitude) return;
    const color=catColor[r.category]||'#888', emoji=catEmoji[r.category]||'âš ï¸';
    const el=document.createElement('div');
    el.style.cssText=`width:32px;height:32px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid rgba(255,255,255,0.2);box-shadow:0 3px 10px rgba(0,0,0,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;`;
    const inner=document.createElement('div');
    inner.style.cssText='transform:rotate(45deg);font-size:12px;';
    inner.textContent=emoji; el.appendChild(inner);
    el.onclick=()=>showIssueDetail(r.id);
    const m=new mapboxgl.Marker({element:el}).setLngLat([r.longitude,r.latitude]).addTo(map);
    markers.issues.push(m);
  });
}

function renderLocalIntel() {
  const statsEl = document.getElementById('intelStats');
  if(!statsEl) return;
  const issues = (data.issues||[]).filter(r=>!r.resolved);
  const now = Date.now();
  const issues24 = issues.filter(r=>now - new Date(r.created_at).getTime() < 24*60*60*1000).length;
  const eventsToday = (data.events||[]).filter(e=>isToday(e.date)).length;
  const redwayIssues = issues.filter(r=>['Lighting','Obstruction','Surface','Flooding','Anti-social behaviour'].includes(r.category)).length;
  const nearbyIssues = userLat ? issues.filter(r=>distKm(userLat,userLng,r.latitude,r.longitude)<=1).length : null;

  const nearAction = nearbyIssues===null ? 'toggleNearMe()' : "setSort('near')";
  statsEl.innerHTML = `
    <div class="intel-card">
      <div class="intel-label">24h Issues</div>
      <div class="intel-value">${issues24}</div>
    </div>
    <div class="intel-card">
      <div class="intel-label">Events Today</div>
      <div class="intel-value">${eventsToday}</div>
    </div>
    <div class="intel-card">
      <div class="intel-label">Redway Watch</div>
      <div class="intel-value">${redwayIssues}</div>
    </div>
    <div class="intel-card" style="cursor:pointer" onclick="${nearAction}">
      <div class="intel-label">${nearbyIssues===null?'Near Me':'Within 1km'}</div>
      <div class="intel-value">${nearbyIssues===null?'Enable':'+'+nearbyIssues}</div>
    </div>`;

  const gridWatch = getGridWatch(issues);
  const gridEl = document.getElementById('gridWatch');
  gridEl.innerHTML = gridWatch.length
    ? gridWatch.map(g=>`<div class="intel-item"><span>${g.name}</span><strong>${g.count}</strong></div>`).join('')
    : `<div class="intel-item"><span>No grid road alerts</span><strong>âœ“</strong></div>`;

  const quickEl = document.getElementById('quickTrips');
  quickEl.innerHTML = quickTrips.map(t=>`<button class="quick-chip" onclick="routeTo('${t.name.replace(/'/g,"\\'")}',${t.lat},${t.lng})">${t.icon} ${t.name}</button>`).join('');

  if(!data.places || !data.places.length) data.places = getMKPlaces();
  const picksEl = document.getElementById('localPicks');
  const picks = getLocalPicks();
  picksEl.innerHTML = picks.map(p=>`<button class="quick-chip" onclick="showPlaceDetail(${p.id})">â­ ${p.name}</button>`).join('');
}

function getGridWatch(issues) {
  const counts = {};
  issues.forEach(r=>{
    const text = `${r.title||''} ${r.description||''}`;
    extractGridRoads(text).forEach(name=>{
      counts[name]=(counts[name]||0)+1;
    });
  });
  return Object.entries(counts)
    .map(([name,count])=>({name, count}))
    .sort((a,b)=>b.count-a.count)
    .slice(0,4);
}

function extractGridRoads(text) {
  const out = new Set();
  const re = /\b([HV]\d{1,2})\s+([A-Za-z][A-Za-z\s]{2,24})/g;
  let m;
  while((m=re.exec(text))!==null) {
    const road = `${m[1]} ${m[2].trim()}`.replace(/\s{2,}/g,' ');
    out.add(road);
  }
  return [...out];
}

function getLocalPicks() {
  const list = (data.places && data.places.length) ? data.places : getMKPlaces();
  return [...list].sort((a,b)=> (b.rating||0) - (a.rating||0)).slice(0,4);
}

function showIssueDetail(id) {
  const r=data.issues.find(x=>x.id===id);
  if(!r) return;
  updateURL('issue',id);
  flyTo(r.longitude,r.latitude);
  const color=catColor[r.category]||'#888';
  document.getElementById('detailScroll').innerHTML=`
    <div class="place-hero" style="margin-bottom:12px">
      <div class="place-icon-big" style="background:${color}20">${catEmoji[r.category]||'âš ï¸'}</div>
      <div style="flex:1">
        <div class="place-name" style="font-size:16px">${r.title}</div>
        <div class="place-cat">${r.category} Â· ${timeAgo(r.created_at)}</div>
        <span class="open-badge ${(r.upvotes||0)>2?'open':'closed'}">${(r.upvotes||0)>2?'âš ï¸ Multiple reports':'ðŸ“ Reported'}</span>
      </div>
    </div>
    ${r.description?`<div style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:16px;padding:12px;background:var(--panel);border-radius:8px;border:1px solid var(--border)">${r.description}</div>`:''}
    <div class="action-row">
      <button class="action-btn" onclick="upvoteIssue(event,${r.id})">
        <span class="action-btn-icon">â–²</span>
        <span class="action-btn-label">Confirm (${r.upvotes||0})</span>
      </button>
      <button class="action-btn" onclick="routeTo('${r.title.replace(/'/g,"\\'")}',${r.latitude},${r.longitude})">
        <span class="action-btn-icon">ðŸ—ºï¸</span>
        <span class="action-btn-label">Route here</span>
      </button>
      <a class="action-btn" href="https://www.fixmystreet.com/report/new?lat=${r.latitude}&lon=${r.longitude}" target="_blank">
        <span class="action-btn-icon">ðŸ“‹</span>
        <span class="action-btn-label">Report to council</span>
      </a>
      <button class="action-btn" onclick="markResolved(event,${r.id})" style="color:var(--green)">
        <span class="action-btn-icon">âœ…</span>
        <span class="action-btn-label">Resolved</span>
      </button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Location</div>
      <div style="font-size:12px;color:var(--muted)">${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}</div>
    </div>`;
  openDetail();
}

// â”€â”€ TRANSPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadTransport() {
  document.getElementById('sidebarTitle').textContent='Public Transport';
  document.getElementById('sidebarCount').textContent='â€”';
  showSkeletons(3);

  const live = await fetchLiveTransport();
  if(live && live.length) {
    data.transport = live;
    transportLive = true;
    if(userLat && transportView==='all') transportView = 'near';
  } else {
    data.transport = getMKBusRoutes();
    transportLive = false;
  }

  renderTransportSidebar();
  renderTransportMarkers();
  renderLocalIntel();

  document.getElementById('sidebarCount').textContent=data.transport.length;
  document.getElementById('s1').textContent=data.transport.length;
  document.getElementById('s2').textContent=transportLive?'live vehicles':data.transport.filter(r=>r.departures[0]?.minsAway<=5).length+' due';
  document.getElementById('s3').textContent=transportLive?'updated now':'â€”';
  document.getElementById('busAll').classList.toggle('active', transportView==='all');
  document.getElementById('busNear').classList.toggle('active', transportView==='near');
  document.getElementById('busRoute').classList.toggle('active', transportView==='route');

  if(transportTimer) clearTimeout(transportTimer);
  transportTimer = setTimeout(loadTransport, transportLive?20000:30000);
}

async function fetchLiveTransport() {
  try {
    const r = await fetch('/.netlify/functions/mk-buses');
    if(!r.ok) return null;
    const d = await r.json();
    if(!d || !Array.isArray(d.vehicles) || !d.vehicles.length) return null;
    return d.vehicles.map((v,i)=>({
      id: v.vehicleId || v.id || i+1,
      number: v.routeId || 'ðŸšŒ',
      name: v.routeId ? `Route ${v.routeId}` : 'Live Bus',
      stop: v.vehicleId ? `Vehicle ${v.vehicleId}` : 'Live vehicle',
      lat: v.lat,
      lng: v.lng,
      departures: [],
      color: '#4a9eff',
      operator: v.operator || 'Live',
      live: true,
      updated: v.timestamp
    })).filter(x=>x.lat && x.lng);
  } catch(e) {
    return null;
  }
}

function getMKBusRoutes() {
  const now=new Date(), h=now.getHours(), m=now.getMinutes();
  function deps(interval,off=0){
    return Array.from({length:3},(_,i)=>{
      const tot=(h*60+m+off+interval*i)%(24*60);
      const ma=off+interval*i;
      return {time:`${String(Math.floor(tot/60)).padStart(2,'0')}:${String(tot%60).padStart(2,'0')}`,minsAway:ma,status:ma<=0?'Due':Math.random()>0.85?'Delayed':'On time'};
    });
  }
  const o=()=>Math.floor(Math.random()*20);
  return [
    {id:1,number:'1',name:'Wolverton â€” Bletchley via CMK',stop:'CMK Bus Station Bay A',lat:52.0415,lng:-0.7596,departures:deps(12,o()),color:'#4a9eff',operator:'Arriva'},
    {id:2,number:'4',name:'Stony Stratford â€” Bletchley',stop:'CMK Bus Station Bay B',lat:52.0412,lng:-0.7590,departures:deps(15,o()),color:'#4a9eff',operator:'Arriva'},
    {id:3,number:'5',name:'Northampton â€” Milton Keynes',stop:'CMK Bus Station Bay C',lat:52.0418,lng:-0.7601,departures:deps(30,o()),color:'#4a9eff',operator:'Stagecoach'},
    {id:4,number:'7',name:'Westcroft â€” CMK',stop:'Westcroft Centre',lat:52.0163,lng:-0.7801,departures:deps(20,o()),color:'#4a9eff',operator:'Arriva'},
    {id:5,number:'8',name:'Emerson Valley â€” CMK',stop:'Emerson Valley',lat:52.0090,lng:-0.7850,departures:deps(20,o()),color:'#4a9eff',operator:'Arriva'},
    {id:6,number:'10',name:'Wolverton â€” Kingston',stop:'Wolverton',lat:52.0658,lng:-0.8107,departures:deps(25,o()),color:'#4a9eff',operator:'Red Rose'},
    {id:7,number:'13',name:'Bletchley â€” Walnut Tree',stop:'Bletchley Bus Station',lat:51.9965,lng:-0.7378,departures:deps(30,o()),color:'#4a9eff',operator:'Arriva'},
    {id:8,number:'ðŸš‚',name:'London Euston â€” Birmingham',stop:'MK Central Station',lat:52.0341,lng:-0.7717,departures:deps(30,o()),color:'#E83A2F',operator:'Avanti / LNR'},
  ];
}

function renderTransportSidebar() {
  const body=document.getElementById('sidebarBody');
  const filtered = filterTransport(data.transport||[]);
  body.innerHTML=filtered.map(r=>r.live?`
    <div class="transport-card" onclick="showTransportDetail(${r.id})">
      <div class="transport-header">
        <div class="bus-number" style="background:${r.color}">${r.number}</div>
        <div style="flex:1">
          <div class="bus-name">${r.name}</div>
          <div class="bus-dest">${r.operator} Â· ${r.stop}</div>
        </div>
      </div>
      <div>
        <div class="departure">
          <span class="dep-time">${fmtUpdated(r.updated)}</span>
          <span class="dep-stop">Live position</span>
          <span class="dep-status on-time">LIVE</span>
        </div>
      </div>
    </div>
  `:`
    <div class="transport-card" onclick="showTransportDetail(${r.id})">
      <div class="transport-header">
        <div class="bus-number" style="background:${r.color}">${r.number}</div>
        <div style="flex:1">
          <div class="bus-name">${r.name}</div>
          <div class="bus-dest">${r.operator} Â· ${r.stop}</div>
        </div>
      </div>
      <div>
        ${r.departures.map(d=>`
          <div class="departure">
            <span class="dep-time ${d.minsAway<=0?'due':d.minsAway<=3?'soon':''}">${d.minsAway<=0?'Due now':d.minsAway<=1?'1 min':d.time}</span>
            <span class="dep-stop">${r.stop}</span>
            <span class="dep-status ${d.status==='On time'?'on-time':d.status==='Delayed'?'delayed':''}">${d.status}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function renderTransportMarkers() {
  markers.transport.forEach(m=>m.remove()); markers.transport=[];
  const filtered = filterTransport(data.transport||[]);
  filtered.forEach(r=>{
    const el=document.createElement('div');
    const isRail=r.number==='ðŸš‚';
    el.style.cssText=`width:34px;height:34px;border-radius:${isRail?'6px':'50%'};background:${r.color};display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:${isRail?'16px':'12px'};font-weight:900;color:white;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.2);`;
    el.textContent=r.number;
    el.onclick=()=>showTransportDetail(r.id);
    markers.transport.push(new mapboxgl.Marker({element:el}).setLngLat([r.lng,r.lat]).addTo(map));
  });
}

function filterTransport(list) {
  if(!transportLive) return list;
  let out = [...list];
  if(transportView === 'near' && userLat) {
    out = out.filter(r=>distKm(userLat,userLng,r.lat,r.lng) <= 2.5);
  }
  if(transportView === 'route' && transportRouteQuery) {
    const q = transportRouteQuery.toLowerCase();
    out = out.filter(r=>String(r.number).toLowerCase().includes(q) || String(r.routeId||'').toLowerCase().includes(q));
  }
  if(transportView === 'all') {
    // reduce clutter by showing only buses within current viewport
    const bounds = map.getBounds();
    out = out.filter(r=>bounds.contains([r.lng,r.lat]));
  }
  return out;
}

function setBusView(mode) {
  transportView = mode;
  document.getElementById('busAll').classList.toggle('active', mode==='all');
  document.getElementById('busNear').classList.toggle('active', mode==='near');
  document.getElementById('busRoute').classList.toggle('active', mode==='route');
  const input = document.getElementById('routeFilterInput');
  input.style.display = mode==='route' ? 'block' : 'none';
  renderTransportSidebar();
  renderTransportMarkers();
}

function showTransportDetail(id) {
  const r=data.transport.find(x=>String(x.id)===String(id));
  if(!r) return;
  flyTo(r.lng,r.lat);
  document.getElementById('detailScroll').innerHTML=r.live?`
    <div class="place-hero">
      <div class="place-icon-big" style="background:${r.color}20;font-size:20px;font-family:'Syne',sans-serif;font-weight:900;color:${r.color}">${r.number}</div>
      <div style="flex:1">
        <div class="place-name" style="font-size:16px">${r.name}</div>
        <div class="place-cat">${r.operator}</div>
        <span class="open-badge open">â— Live Vehicle</span>
      </div>
    </div>
    <div class="action-row">
      <button class="action-btn" onclick="flyTo(${r.lng},${r.lat})">
        <span class="action-btn-icon">ðŸ“</span><span class="action-btn-label">Show bus</span>
      </button>
      <button class="action-btn" onclick="routeTo('${r.name.replace(/'/g,"\\'")}',${r.lat},${r.lng})">
        <span class="action-btn-icon">ðŸ—ºï¸</span><span class="action-btn-label">Route to bus</span>
      </button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Live Status</div>
      <div class="hours-row"><span class="hours-day">Updated</span><span class="hours-time">${fmtUpdated(r.updated)}</span></div>
      <div class="hours-row"><span class="hours-day">Route</span><span class="hours-time">${r.number}</span></div>
      <div class="hours-row"><span class="hours-day">Vehicle</span><span class="hours-time">${r.stop}</span></div>
      <div class="hours-row"><span class="hours-day">Coords</span><span class="hours-time">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</span></div>
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:8px">Live positions refresh every ~20 seconds.</div>
  `:`
    <div class="place-hero">
      <div class="place-icon-big" style="background:${r.color}20;font-size:20px;font-family:'Syne',sans-serif;font-weight:900;color:${r.color}">${r.number}</div>
      <div style="flex:1">
        <div class="place-name" style="font-size:16px">${r.name}</div>
        <div class="place-cat">${r.operator}</div>
        <span class="open-badge open">â— Serving MK</span>
      </div>
    </div>
    <div class="action-row">
      <button class="action-btn" onclick="flyTo(${r.lng},${r.lat})">
        <span class="action-btn-icon">ðŸ“</span><span class="action-btn-label">Show stop</span>
      </button>
      <a class="action-btn" href="https://bustimes.org/stops/?lat=${r.lat}&lon=${r.lng}" target="_blank">
        <span class="action-btn-icon">ðŸ•</span><span class="action-btn-label">Live times</span>
      </a>
      <a class="action-btn" href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank">
        <span class="action-btn-icon">ðŸ—ºï¸</span><span class="action-btn-label">Directions</span>
      </a>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Next departures from ${r.stop}</div>
      ${r.departures.map(d=>`
        <div class="departure" style="margin-bottom:4px">
          <span class="dep-time ${d.minsAway<=0?'due':d.minsAway<=3?'soon':''}">${d.minsAway<=0?'Due now':d.time}</span>
          <span class="dep-stop">${r.name}</span>
          <span class="dep-status ${d.status==='On time'?'on-time':'delayed'}">${d.status}</span>
        </div>`).join('')}
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:8px">âš ï¸ Times are estimated. Tap "Live times" for real-time data.</div>`;
  openDetail();
}

// â”€â”€ EVENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadEvents() {
  try {
    let d=await db.get('events').catch(()=>[]);
    if(!Array.isArray(d)||!d.length) d=getSampleEvents();
    data.events=d;
    renderEventsSidebar();
    renderEventMarkers();
    renderLocalIntel();
    document.getElementById('sidebarTitle').textContent="What's On";
    document.getElementById('sidebarCount').textContent=data.events.length;
    document.getElementById('s1').textContent=data.events.length;
    document.getElementById('s2').textContent=data.events.filter(e=>isToday(e.date)).length+' today';
    document.getElementById('s3').textContent=data.events.filter(e=>e.free).length+' free';
  } catch(e){console.error(e);}
}

function getSampleIssues() {
  return [
    {id:101,category:'Lighting',title:'Dark underpass near CMK station',description:'Two lamps out under the Midsummer Blvd underpass.',latitude:52.0345,longitude:-0.7708,created_at:new Date(Date.now()-1000*60*45).toISOString(),upvotes:5},
    {id:102,category:'Pothole',title:'H5 Portway surface damage by Shenley',description:'Large pothole on the left lane heading west.',latitude:52.0009,longitude:-0.8122,created_at:new Date(Date.now()-1000*60*180).toISOString(),upvotes:3},
    {id:103,category:'Obstruction',title:'Redway blocked by fallen branch (Willen)',description:'Tree branch across the redway by Willen Lake footbridge.',latitude:52.0442,longitude:-0.7009,created_at:new Date(Date.now()-1000*60*420).toISOString(),upvotes:7},
    {id:104,category:'Flooding',title:'V6 Grafton Street underpass flooded',description:'Water across the full width after heavy rain.',latitude:52.0356,longitude:-0.7288,created_at:new Date(Date.now()-1000*60*720).toISOString(),upvotes:4}
  ];
}

function getSampleEvents() {
  return [
    {id:1,title:'Campbell Park Parkrun',description:'Free 5km run every Saturday morning. All abilities welcome. Register once at parkrun.org.uk.',category:'Sports',date:getNextDay(6),time:'09:00',venue:'Campbell Park',latitude:52.0489,longitude:-0.7401,free:true,created_at:new Date().toISOString()},
    {id:2,title:'MK Dons vs Charlton Athletic',description:'Sky Bet League One fixture. Arrive early â€” car parks fill up fast.',category:'Sports',date:getNextDay(6),time:'15:00',venue:'Stadium MK',latitude:52.0009,longitude:-0.7331,free:false,created_at:new Date().toISOString()},
    {id:3,title:'MK Gallery: Open Exhibition',description:'Contemporary art gallery. Free entry on Saturdays and for under 16s.',category:'Arts',date:new Date().toISOString().split('T')[0],time:'10:00',venue:'MK Gallery, CMK',latitude:52.0423,longitude:-0.7588,free:true,created_at:new Date().toISOString()},
    {id:4,title:'CMK Saturday Market',description:'Weekly market with local produce, street food, artisan crafts and more.',category:'Market',date:getNextDay(6),time:'08:00',venue:'Midsummer Place',latitude:52.0431,longitude:-0.7571,free:true,created_at:new Date().toISOString()},
    {id:5,title:'The Stables: Live Jazz Evening',description:'Intimate jazz performance in the studio space. Book in advance â€” sells out.',category:'Music',date:getNextDay(5),time:'19:30',venue:'The Stables, Wavendon',latitude:52.0197,longitude:-0.6825,free:false,created_at:new Date().toISOString()},
    {id:6,title:'Willen Lake Triathlon',description:'Open water swim, cycle and run around Willen Lake. All abilities welcome.',category:'Sports',date:getNextDay(0),time:'07:30',venue:'Willen Lake',latitude:52.0583,longitude:-0.7189,free:false,created_at:new Date().toISOString()},
  ];
}

function getNextDay(day){const d=new Date();d.setDate(d.getDate()+(day-d.getDay()+7)%7||7);return d.toISOString().split('T')[0];}
function isToday(d){return new Date(d).toDateString()===new Date().toDateString();}

function renderEventsSidebar() {
  const body=document.getElementById('sidebarBody');
  const cats=[...new Set(data.events.map(e=>e.category))].filter(Boolean);
  renderFilterBar(cats);

  let events=[...data.events];
  const f=activeFilters['events'];
  if(f) events=events.filter(e=>e.category===f);
  if(activeSort==='near'&&userLat) {
    events=events.map(e=>({...e,_dist:distKm(userLat,userLng,e.latitude,e.longitude)})).sort((a,b)=>a._dist-b._dist);
  }

  body.innerHTML=events.map(e=>`
    <div class="card" onclick="showEventDetail(${e.id})">
      <div class="card-top">
        <span class="card-tag" style="background:rgba(245,166,35,0.12);color:var(--amber)">${evEmoji(e.category)} ${e.category}</span>
        <span class="card-time">${fmtDate(e.date)}</span>
      </div>
      <div class="card-title">${e.title}</div>
      <div class="card-sub">${e.venue}${e.time?' Â· '+e.time:''}</div>
      <div class="card-footer">
        <span class="card-meta">${e.free?'ðŸ†“ Free':'ðŸŽŸï¸ Ticketed'}</span>
        ${e._dist!==undefined?`<span class="card-dist">ðŸ“ ${fmtDist(e._dist)}</span>`:''}
      </div>
    </div>`).join('');
}

function renderEventMarkers() {
  markers.events.forEach(m=>m.remove()); markers.events=[];
  data.events.forEach(e=>{
    if(!e.latitude||!e.longitude) return;
    const el=document.createElement('div');
    el.style.cssText='width:30px;height:30px;border-radius:50%;background:#f5a623;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.2);';
    el.textContent=evEmoji(e.category);
    el.onclick=()=>showEventDetail(e.id);
    markers.events.push(new mapboxgl.Marker({element:el}).setLngLat([e.longitude,e.latitude]).addTo(map));
  });
}

function showEventDetail(id) {
  const e=data.events.find(x=>x.id===id);
  if(!e) return;
  updateURL('event',id);
  flyTo(e.longitude,e.latitude);
  document.getElementById('detailScroll').innerHTML=`
    <div class="place-hero">
      <div class="place-icon-big" style="background:rgba(245,166,35,0.12)">${evEmoji(e.category)}</div>
      <div style="flex:1">
        <div class="place-name" style="font-size:16px">${e.title}</div>
        <div class="place-cat">${e.category} Â· ${e.venue}</div>
        <span class="open-badge open">${e.free?'ðŸ†“ Free entry':'ðŸŽŸï¸ Ticketed'}</span>
      </div>
    </div>
    <div class="action-row">
      <button class="action-btn" onclick="flyTo(${e.longitude},${e.latitude})">
        <span class="action-btn-icon">ðŸ“</span><span class="action-btn-label">View on map</span>
      </button>
      <a class="action-btn" href="https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}" target="_blank">
        <span class="action-btn-icon">ðŸš—</span><span class="action-btn-label">Directions</span>
      </a>
      <button class="action-btn" onclick="shareEvent('${e.title}',${e.id})">
        <span class="action-btn-icon">ðŸ“¤</span><span class="action-btn-label">Share</span>
      </button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Details</div>
      <div style="font-size:12px;line-height:1.8">
        <div style="margin-bottom:6px">ðŸ“… <strong>${fmtDate(e.date)}</strong>${e.time?' at '+e.time:''}</div>
        <div style="margin-bottom:6px">ðŸ“ ${e.venue}</div>
        ${e.description?`<div style="color:var(--muted);margin-top:8px;line-height:1.7">${e.description}</div>`:''}
      </div>
    </div>`;
  openDetail();
}

function evEmoji(c){return{Sports:'âš½',Arts:'ðŸŽ¨',Music:'ðŸŽµ',Market:'ðŸ›ï¸',Food:'ðŸ•',Community:'ðŸ‘¥',Leisure:'ðŸŽ¿'}[c]||'ðŸ“…';}

// â”€â”€ PLACES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadPlaces() {
  data.places=getMKPlaces();
  renderPlacesSidebar();
  renderPlaceMarkers();
  renderLocalIntel();
  document.getElementById('sidebarTitle').textContent='Places & Businesses';
  document.getElementById('sidebarCount').textContent=data.places.length;
  document.getElementById('s1').textContent=data.places.length;
  document.getElementById('s2').textContent=data.places.filter(p=>p.open).length+' open';
  document.getElementById('s3').textContent=(data.places.reduce((s,p)=>s+p.rating,0)/data.places.length).toFixed(1)+' avg';
}

// â”€â”€ FREE PARKING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadParking() {
  showSkeletons(3);
  const osm = await fetchFreeParkingOSM();
  data.parking = osm.length ? osm : getFreeParking();
  renderParkingSidebar();
  renderParkingMarkers();
  document.getElementById('sidebarTitle').textContent='Free Parking';
  document.getElementById('sidebarCount').textContent=data.parking.length;
  document.getElementById('s1').textContent=data.parking.length;
  document.getElementById('s2').textContent=data.parking.filter(p=>p.type==='On-street').length+' on-street';
  document.getElementById('s3').textContent=data.parking.filter(p=>p.freeAfter).length+' after 6pm';
}

async function fetchFreeParkingOSM() {
  try {
    const bbox='-0.95,51.90,-0.55,52.15';
    const query=`[out:json][timeout:25];
      (
        node["amenity"="parking"]["fee"="no"](${bbox});
        way["amenity"="parking"]["fee"="no"](${bbox});
        relation["amenity"="parking"]["fee"="no"](${bbox});
        node["amenity"="parking_space"]["fee"="no"](${bbox});
        way["amenity"="parking_space"]["fee"="no"](${bbox});
        node["amenity"="parking"]["fee:conditional"~"no"](${bbox});
        way["amenity"="parking"]["fee:conditional"~"no"](${bbox});
        relation["amenity"="parking"]["fee:conditional"~"no"](${bbox});
      );
      out center;`;
    const r = await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(query)});
    const d = await r.json();
    return (d.elements||[]).map((e,i)=>{
      const lat = e.lat || e.center?.lat;
      const lng = e.lon || e.center?.lon;
      if(!lat || !lng) return null;
      const name = e.tags?.name || 'Free parking';
      const maxstay = e.tags?.maxstay || e.tags?.maxstay2 || 'No limit';
      const access = e.tags?.access || 'public';
      const feeConditional = e.tags?.['fee:conditional'] || '';
      const freeAfter = /no/i.test(feeConditional) ? (feeConditional.includes('18:00') ? 'After 6pm' : 'Conditional') : '';
      return {
        id: 'osm_'+(e.id||i),
        name,
        type: e.tags?.parking || 'Parking',
        limit: maxstay,
        notes: `OSM Â· ${access}${freeAfter ? ' Â· '+freeAfter : ''}`,
        freeAfter,
        lat, lng
      };
    }).filter(Boolean);
  } catch(e) {
    return [];
  }
}

function getFreeParking() {
  // Sample data â€” replace with official MK free parking dataset when available
  return [
    {id:1,name:'CMK: Midsummer Blvd (West) bays',type:'On-street',limit:'2h',notes:'Free after 6pm',lat:52.0418,lng:-0.7702},
    {id:2,name:'CMK: Avebury Blvd bays',type:'On-street',limit:'2h',notes:'Free after 6pm',lat:52.0410,lng:-0.7664},
    {id:3,name:'Wolverton: Stratford Rd bays',type:'On-street',limit:'No limit',notes:'All day free',lat:52.0632,lng:-0.8117},
    {id:4,name:'Stony Stratford: High St bays',type:'On-street',limit:'No limit',notes:'All day free',lat:52.0565,lng:-0.8469},
    {id:5,name:'Bletchley: Queensway bays',type:'On-street',limit:'3h',notes:'Free after 6pm',lat:51.9925,lng:-0.7311},
    {id:6,name:'Newport Pagnell: High St bays',type:'On-street',limit:'No limit',notes:'All day free',lat:52.0876,lng:-0.7228},
    {id:7,name:'Olney: Market Place bays',type:'On-street',limit:'No limit',notes:'All day free',lat:52.1532,lng:-0.7028}
  ];
}

function renderParkingSidebar() {
  const body=document.getElementById('sidebarBody');
  const note = `<div class="card" style="border-style:dashed">
    <div class="card-title">Free parking (live)</div>
    <div class="card-sub">Showing free parking and â€œfree after 6pmâ€ tagged in OpenStreetMap. Always check local signage for time limits.</div>
  </div>`;
  const freeNow = data.parking.filter(p=>!p.freeAfter);
  const freeLater = data.parking.filter(p=>p.freeAfter);
  const section = (title, list)=> list.length ? `<div class="detail-section-title">${title}</div>`+list.map(p=>`
    <div class="card" onclick="flyTo(${p.lng},${p.lat})">
      <div class="card-top">
        <span class="card-tag" style="background:rgba(16,185,129,0.12);color:#10b981">ðŸ…¿ï¸ ${p.type}</span>
        <span class="card-time">${p.freeAfter || p.limit}</span>
      </div>
      <div class="card-title">${p.name}</div>
      <div class="card-sub">${p.notes}</div>
      <div class="card-footer">
        <span class="card-meta">${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}</span>
      </div>
    </div>`).join('');
  body.innerHTML= note + section('Free Now', freeNow) + section('Free After 6pm', freeLater);
}

function renderParkingMarkers() {
  markers.parking.forEach(m=>m.remove()); markers.parking=[];
  data.parking.forEach(p=>{
    const el=document.createElement('div');
    const color = p.freeAfter ? '#f59e0b' : '#10b981';
    el.style.cssText=`width:30px;height:30px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;color:white;cursor:pointer;box-shadow:0 6px 14px ${p.freeAfter?'rgba(245,158,11,0.35)':'rgba(16,185,129,0.35)'};border:2px solid rgba(255,255,255,0.5);`;
    el.textContent='ðŸ…¿ï¸';
    el.onclick=()=>flyTo(p.lng,p.lat);
    markers.parking.push(new mapboxgl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(map));
  });
}

function getMKPlaces() {
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const tod=new Date().getDay();
  const h=new Date().getHours();
  const isOpen=(open,close)=>h>=open&&h<close;
  return [
    // Shopping
    {id:1,name:'thecentre:mk',category:'Shopping',emoji:'ðŸ›ï¸',description:'Main shopping centre with 200+ stores including John Lewis, M&S, Apple and dozens of restaurants.',lat:52.0431,lng:-0.7571,rating:4.1,reviews:1842,open:isOpen(9,21),phone:'01908 679800',website:'https://thecentremk.com',hours:{Mon:'9:00â€“21:00',Tue:'9:00â€“21:00',Wed:'9:00â€“21:00',Thu:'9:00â€“21:00',Fri:'9:00â€“21:00',Sat:'9:00â€“21:00',Sun:'11:00â€“17:00'},address:'Silbury Blvd, MK9 3ES'},
    {id:2,name:'Midsummer Place',category:'Shopping',emoji:'ðŸ›ï¸',description:'Covered mall with NEXT, H&M, Boots, restaurants and a great food court. Connects to thecentre:mk.',lat:52.0438,lng:-0.7558,rating:4.0,reviews:892,open:isOpen(9,20),phone:'01908 661166',website:'https://midsummerplace.co.uk',hours:{Mon:'9:00â€“20:00',Tue:'9:00â€“20:00',Wed:'9:00â€“20:00',Thu:'9:00â€“20:00',Fri:'9:00â€“21:00',Sat:'9:00â€“20:00',Sun:'11:00â€“17:00'},address:'Midsummer Blvd, MK9 3GB'},
    // Culture
    {id:3,name:'MK Gallery',category:'Art & Culture',emoji:'ðŸŽ¨',description:'Contemporary art gallery in the heart of CMK. Free entry Saturdays and for under 16s. CafÃ© on site.',lat:52.0423,lng:-0.7588,rating:4.6,reviews:623,open:isOpen(10,17),phone:'01908 676900',website:'https://mkgallery.org',hours:{Mon:'Closed',Tue:'10:00â€“17:00',Wed:'10:00â€“17:00',Thu:'10:00â€“17:00',Fri:'10:00â€“17:00',Sat:'10:00â€“17:00',Sun:'12:00â€“17:00'},address:'900 Midsummer Blvd, MK9 3QA'},
    {id:4,name:'MK Museum',category:'Art & Culture',emoji:'ðŸ›ï¸',description:"Local heritage and history of Milton Keynes from Roman times to the new city. Free entry.",lat:52.0441,lng:-0.7609,rating:4.4,reviews:412,open:isOpen(10,16),phone:'01908 676960',website:'https://www.mkmuseum.org.uk',hours:{Mon:'Closed',Tue:'10:00â€“16:30',Wed:'10:00â€“16:30',Thu:'10:00â€“16:30',Fri:'10:00â€“16:30',Sat:'10:00â€“16:30',Sun:'Closed'},address:'McConnell Drive, Wolverton, MK12 5EL'},
    {id:5,name:'Bletchley Park',category:'Art & Culture',emoji:'ðŸ°',description:'Historic home of WWII codebreakers. Museum, tours, replica bombe machines and the story of Alan Turing.',lat:51.9978,lng:-0.7408,rating:4.8,reviews:8921,open:isOpen(9,17),phone:'01908 640404',website:'https://bletchleypark.org.uk',hours:{Mon:'9:30â€“17:00',Tue:'9:30â€“17:00',Wed:'9:30â€“17:00',Thu:'9:30â€“17:00',Fri:'9:30â€“17:00',Sat:'9:30â€“17:00',Sun:'9:30â€“17:00'},address:'The Mansion, Bletchley Park, MK3 6EB'},
    // Parks
    {id:6,name:'Campbell Park',category:'Parks & Nature',emoji:'ðŸŒ³',description:'260-acre park along the Ouzel Valley with sculptures, cycling paths, play areas and stunning views of CMK.',lat:52.0489,lng:-0.7401,rating:4.7,reviews:2341,open:true,phone:null,website:'https://www.theparkstrust.com/parks/campbell-park/',hours:{Mon:'Open 24hrs',Tue:'Open 24hrs',Wed:'Open 24hrs',Thu:'Open 24hrs',Fri:'Open 24hrs',Sat:'Open 24hrs',Sun:'Open 24hrs'},address:'Campbell Park, MK9'},
    {id:7,name:'Willen Lake',category:'Parks & Nature',emoji:'ðŸ’§',description:'North and South lakes with watersports centre, Redway cycling, cafÃ©, Himalayan garden and peace pagoda.',lat:52.0583,lng:-0.7189,rating:4.6,reviews:3102,open:true,phone:null,website:'https://www.theparkstrust.com/parks/willen-lake/',hours:{Mon:'Open 24hrs',Tue:'Open 24hrs',Wed:'Open 24hrs',Thu:'Open 24hrs',Fri:'Open 24hrs',Sat:'Open 24hrs',Sun:'Open 24hrs'},address:'Willen Lake, MK15 0DS'},
    {id:8,name:'Linford Wood',category:'Parks & Nature',emoji:'ðŸŒ²',description:'Ancient woodland with marked trails, wildlife and picnic areas. Great for dog walking and mountain biking.',lat:52.0672,lng:-0.7601,rating:4.5,reviews:788,open:true,phone:null,website:'https://www.theparkstrust.com',hours:{Mon:'Open 24hrs',Tue:'Open 24hrs',Wed:'Open 24hrs',Thu:'Open 24hrs',Fri:'Open 24hrs',Sat:'Open 24hrs',Sun:'Open 24hrs'},address:'Linford Wood, MK14'},
    {id:9,name:'Ouzel Valley Park',category:'Parks & Nature',emoji:'ðŸ¦†',description:'Riverside park running through the heart of MK. Popular with cyclists, runners and families.',lat:52.0356,lng:-0.7489,rating:4.4,reviews:421,open:true,phone:null,website:'https://www.theparkstrust.com',hours:{Mon:'Open 24hrs',Tue:'Open 24hrs',Wed:'Open 24hrs',Thu:'Open 24hrs',Fri:'Open 24hrs',Sat:'Open 24hrs',Sun:'Open 24hrs'},address:'Ouzel Valley Park, MK'},
    // Leisure
    {id:10,name:'Xscape',category:'Leisure',emoji:'ðŸŽ¿',description:'Indoor ski slope, climbing wall, bowling, cinema, restaurants. One of MK\'s most popular leisure destinations.',lat:52.0045,lng:-0.7349,rating:4.3,reviews:4521,open:isOpen(10,22),phone:'01908 736572',website:'https://www.xscape.co.uk/xscape-milton-keynes',hours:{Mon:'10:00â€“22:00',Tue:'10:00â€“22:00',Wed:'10:00â€“22:00',Thu:'10:00â€“22:00',Fri:'10:00â€“23:00',Sat:'9:00â€“23:00',Sun:'10:00â€“21:00'},address:'602 Marlborough Gate, MK9 2XS'},
    {id:11,name:'MK Dons â€” Stadium MK',category:'Leisure',emoji:'âš½',description:'Home of MK Dons FC. 30,717 capacity. Also used for concerts and community events.',lat:52.0009,lng:-0.7331,rating:4.2,reviews:2103,open:false,phone:'01908 622922',website:'https://www.mkdons.com',hours:{Mon:'Office 9â€“5',Tue:'Office 9â€“5',Wed:'Office 9â€“5',Thu:'Office 9â€“5',Fri:'Office 9â€“5',Sat:'Match days only',Sun:'Match days only'},address:'Stadium Way West, MK1 1ST'},
    {id:12,name:'The Stables',category:'Music & Nightlife',emoji:'ðŸŽµ',description:'Award-winning live music venue in Wavendon. Covers jazz, folk, classical and pop. Consistently sells out.',lat:52.0197,lng:-0.6825,rating:4.8,reviews:891,open:false,phone:'01908 280800',website:'https://stables.org',hours:{Mon:'Closed',Tue:'Closed',Wed:'Box office 12â€“5pm',Thu:'Box office 12â€“5pm',Fri:'Box office 12â€“8pm',Sat:'Box office 12â€“8pm',Sun:'Box office 12â€“3pm'},address:'Stockwell Lane, Wavendon MK17 8LU'},
    {id:13,name:'The Woughton Centre',category:'Leisure',emoji:'ðŸŠ',description:'Leisure centre with pool, gym and sports courts. One of MK\'s best-value facilities.',lat:52.0186,lng:-0.7283,rating:3.9,reviews:342,open:isOpen(6,22),phone:'01908 667789',website:null,hours:{Mon:'6:30â€“22:00',Tue:'6:30â€“22:00',Wed:'6:30â€“22:00',Thu:'6:30â€“22:00',Fri:'6:30â€“22:00',Sat:'7:00â€“20:00',Sun:'8:00â€“20:00'},address:'Woughton on the Green, MK6 3EG'},
    // Food & Drink
    {id:14,name:'The Barge',category:'Pub & Food',emoji:'ðŸº',description:'Canalside pub in Cosgrove with waterside seating, great ales and hearty food. Dog friendly.',lat:52.1025,lng:-0.8272,rating:4.5,reviews:614,open:isOpen(11,23),phone:'01908 562152',website:null,hours:{Mon:'12:00â€“23:00',Tue:'12:00â€“23:00',Wed:'12:00â€“23:00',Thu:'12:00â€“23:00',Fri:'12:00â€“23:00',Sat:'11:00â€“23:00',Sun:'12:00â€“22:30'},address:'Cosgrove, MK19 7JE'},
    {id:15,name:'Nandos CMK',category:'Restaurant',emoji:'ðŸ—',description:'Popular peri-peri chicken chain. Central MK location in The Hub. Often busy on weekends.',lat:52.0429,lng:-0.7567,rating:4.1,reviews:1243,open:isOpen(11,22),phone:'01908 691291',website:'https://www.nandos.co.uk',hours:{Mon:'11:30â€“22:00',Tue:'11:30â€“22:00',Wed:'11:30â€“22:00',Thu:'11:30â€“22:00',Fri:'11:30â€“23:00',Sat:'11:00â€“23:00',Sun:'11:30â€“22:00'},address:'602 Marlborough Gate, CMK, MK9'},
    {id:16,name:'Turtle Bay CMK',category:'Restaurant',emoji:'ðŸ¹',description:'Caribbean restaurant and bar with rum cocktails, jerk chicken and a lively atmosphere.',lat:52.0434,lng:-0.7562,rating:4.3,reviews:876,open:isOpen(12,23),phone:'01908 230701',website:'https://www.turtlebay.co.uk',hours:{Mon:'12:00â€“23:00',Tue:'12:00â€“23:00',Wed:'12:00â€“23:00',Thu:'12:00â€“23:00',Fri:'12:00â€“00:00',Sat:'12:00â€“00:00',Sun:'12:00â€“23:00'},address:'Xscape, Marlborough Gate, MK9'},
    // Transport
    {id:17,name:'Milton Keynes Central Station',category:'Transport',emoji:'ðŸš‚',description:'Main railway station. Direct trains to London Euston (35 mins), Birmingham New Street, and Liverpool.',lat:52.0341,lng:-0.7717,rating:3.9,reviews:2841,open:true,phone:null,website:'https://www.nationalrail.co.uk/stations/mkc',hours:{Mon:'Open 24hrs',Tue:'Open 24hrs',Wed:'Open 24hrs',Thu:'Open 24hrs',Fri:'Open 24hrs',Sat:'Open 24hrs',Sun:'Open 24hrs'},address:'Elder Gate, MK9 1LT'},
    {id:18,name:'CMK Bus Station',category:'Transport',emoji:'ðŸšŒ',description:'Central Milton Keynes bus interchange. Hub for Arriva, Stagecoach and National Express services.',lat:52.0415,lng:-0.7596,rating:3.2,reviews:421,open:true,phone:null,website:null,hours:{Mon:'5:30â€“23:00',Tue:'5:30â€“23:00',Wed:'5:30â€“23:00',Thu:'5:30â€“23:00',Fri:'5:30â€“00:00',Sat:'5:30â€“00:00',Sun:'7:00â€“23:00'},address:'Midsummer Blvd, CMK, MK9 3EH'},
    // Health
    {id:19,name:'Milton Keynes University Hospital',category:'Health',emoji:'ðŸ¥',description:'Main NHS hospital for Milton Keynes. A&E, maternity, cancer centre and specialist care.',lat:52.0205,lng:-0.7331,rating:3.7,reviews:1892,open:true,phone:'01908 660033',website:'https://www.mkuh.nhs.uk',hours:{Mon:'Open 24hrs',Tue:'Open 24hrs',Wed:'Open 24hrs',Thu:'Open 24hrs',Fri:'Open 24hrs',Sat:'Open 24hrs',Sun:'Open 24hrs'},address:'Standing Way, MK6 5LD'},
    // Education
    {id:20,name:'The Open University',category:'Education',emoji:'ðŸŽ“',description:'World-renowned distance learning university headquartered in Walton Hall. Campus open to visitors.',lat:52.0247,lng:-0.7089,rating:4.5,reviews:1102,open:isOpen(8,17),phone:'01908 274066',website:'https://www.open.ac.uk',hours:{Mon:'8:00â€“17:00',Tue:'8:00â€“17:00',Wed:'8:00â€“17:00',Thu:'8:00â€“17:00',Fri:'8:00â€“17:00',Sat:'Closed',Sun:'Closed'},address:'Walton Hall, MK7 6AA'},
    {id:21,name:'University of Buckingham',category:'Education',emoji:'ðŸŽ“',description:'UK\'s only independent university. Small, research-focused campus in Buckingham town centre.',lat:51.9943,lng:-0.9869,rating:4.2,reviews:312,open:isOpen(8,18),phone:'01280 814080',website:'https://www.buckingham.ac.uk',hours:{Mon:'8:00â€“18:00',Tue:'8:00â€“18:00',Wed:'8:00â€“18:00',Thu:'8:00â€“18:00',Fri:'8:00â€“18:00',Sat:'Closed',Sun:'Closed'},address:'Hunter Street, Buckingham MK18 1EG'},
    // Community
    {id:22,name:'The National Bowl',category:'Events Venue',emoji:'ðŸŽª',description:'Open-air amphitheatre hosting major concerts and festivals. Famous for huge summer headline events.',lat:52.0065,lng:-0.7445,rating:4.6,reviews:3421,open:false,phone:null,website:null,hours:{Mon:'Event days only',Tue:'Event days only',Wed:'Event days only',Thu:'Event days only',Fri:'Event days only',Sat:'Event days only',Sun:'Event days only'},address:'National Bowl, MK1'},
    {id:23,name:'Middleton Hall CMK',category:'Community',emoji:'ðŸ¢',description:'Community hub in the heart of CMK with events space, cafÃ© and local services.',lat:52.0420,lng:-0.7580,rating:4.0,reviews:231,open:isOpen(9,17),phone:'01908 606060',website:null,hours:{Mon:'9:00â€“17:00',Tue:'9:00â€“17:00',Wed:'9:00â€“17:00',Thu:'9:00â€“17:00',Fri:'9:00â€“17:00',Sat:'10:00â€“16:00',Sun:'Closed'},address:'Middleton Hall, CMK, MK9'},
    // CafÃ©s
    {id:24,name:'Coffee Corner CMK',category:'CafÃ©',emoji:'â˜•',description:'Independent coffee shop on Midsummer Boulevard. Known for specialty coffee and home-made cakes.',lat:52.0427,lng:-0.7573,rating:4.7,reviews:445,open:isOpen(7,18),phone:null,website:null,hours:{Mon:'7:00â€“18:00',Tue:'7:00â€“18:00',Wed:'7:00â€“18:00',Thu:'7:00â€“18:00',Fri:'7:00â€“18:00',Sat:'8:00â€“17:00',Sun:'9:00â€“16:00'},address:'Midsummer Blvd, CMK'},
    {id:25,name:'Patisserie Valerie CMK',category:'CafÃ©',emoji:'ðŸ¥',description:'French-style cafÃ© and patisserie. Great breakfasts, cakes and lunches in a stylish setting.',lat:52.0435,lng:-0.7555,rating:4.2,reviews:562,open:isOpen(8,20),phone:'01908 605252',website:'https://patisserie-valerie.co.uk',hours:{Mon:'8:00â€“20:00',Tue:'8:00â€“20:00',Wed:'8:00â€“20:00',Thu:'8:00â€“20:00',Fri:'8:00â€“20:00',Sat:'8:00â€“21:00',Sun:'9:00â€“18:00'},address:'Midsummer Place, MK9'},
  ];
}

function renderPlacesSidebar() {
  const body=document.getElementById('sidebarBody');
  const cats=[...new Set(data.places.map(p=>p.category))].filter(Boolean).sort();
  renderFilterBar(cats);

  let places=[...data.places];
  const f=activeFilters['places'];
  if(f) places=places.filter(p=>p.category===f);
  if(activeSort==='near'&&userLat) {
    places=places.map(p=>({...p,_dist:distKm(userLat,userLng,p.lat,p.lng)})).sort((a,b)=>a._dist-b._dist);
  }

  body.innerHTML=places.map(p=>`
    <div class="card" onclick="showPlaceDetail(${p.id})">
      <div class="card-top">
        <span class="card-tag" style="background:rgba(76,175,125,0.12);color:var(--green)">${p.emoji} ${p.category}</span>
        <span class="card-time" style="color:${p.open?'var(--green)':'var(--red)'}">${p.open?'Open':'Closed'}</span>
      </div>
      <div class="card-title">${p.name}</div>
      <div class="card-sub">${p.description.substring(0,80)}...</div>
      <div class="card-footer">
        <span class="stars">${'â˜…'.repeat(Math.round(p.rating))}${'â˜†'.repeat(5-Math.round(p.rating))}</span>
        <span class="card-meta">${p.rating} Â· ${p.reviews.toLocaleString()} reviews ${p._dist!==undefined?`Â· <span class="card-dist" style="color:var(--blue)">ðŸ“${fmtDist(p._dist)}</span>`:''}</span>
      </div>
    </div>`).join('');
}

function renderPlaceMarkers() {
  markers.places.forEach(m=>m.remove()); markers.places=[];
  data.places.forEach(p=>{
    const el=document.createElement('div');
    el.style.cssText='width:28px;height:28px;border-radius:6px;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.2);';
    el.textContent=p.emoji;
    el.onclick=()=>showPlaceDetail(p.id);
    markers.places.push(new mapboxgl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(map));
  });
}

function showPlaceDetail(id) {
  const p=data.places.find(x=>x.id===id);
  if(!p) return;
  updateURL('place',id);
  flyTo(p.lng,p.lat);
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today=days[new Date().getDay()];
  const reviews=getReviews(id);
  document.getElementById('detailScroll').innerHTML=`
    <div class="place-hero">
      <div class="place-icon-big">${p.emoji}</div>
      <div style="flex:1">
        <div class="place-name">${p.name}</div>
        <div class="place-cat">${p.category} Â· ${p.address}</div>
        <div class="place-rating-row">
          <span class="place-stars">${'â˜…'.repeat(Math.round(p.rating))}${'â˜†'.repeat(5-Math.round(p.rating))}</span>
          <span class="place-rating-num">${p.rating}</span>
          <span class="place-review-count">(${p.reviews.toLocaleString()} reviews)</span>
          <span class="open-badge ${p.open?'open':'closed'} "style="margin-left:4px">${p.open?'â— Open now':'â— Closed'}</span>
        </div>
      </div>
    </div>

    <div class="action-row">
      ${p.phone?`<a class="action-btn" href="tel:${p.phone}"><span class="action-btn-icon">ðŸ“ž</span><span class="action-btn-label">Call</span></a>`:''}
      ${p.website?`<a class="action-btn" href="${p.website}" target="_blank"><span class="action-btn-icon">ðŸŒ</span><span class="action-btn-label">Website</span></a>`:''}
      <button class="action-btn" onclick="routeTo('${p.name.replace(/'/g,"\\'")}',${p.lat},${p.lng})"><span class="action-btn-icon">ðŸ—ºï¸</span><span class="action-btn-label">Route here</span></button>
      <button class="action-btn" onclick="sharePlace('${p.name}',${p.id})"><span class="action-btn-icon">ðŸ“¤</span><span class="action-btn-label">Share</span></button>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">About</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.7">${p.description}</div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Opening Hours</div>
      ${Object.entries(p.hours).map(([day,hrs])=>`
        <div class="hours-row ${day===today?'today':''}">
          <span class="hours-day">${day}</span>
          <span class="hours-time">${hrs}</span>
        </div>`).join('')}
    </div>

    <div class="detail-section" id="reviewsSection">
      <div class="detail-section-title">Community Reviews (${reviews.length})</div>
      ${reviews.length?reviews.map(r=>`
        <div class="review">
          <div class="review-top">
            <span class="review-author">${r.author}</span>
            <span class="review-stars">${'â˜…'.repeat(r.rating)}${'â˜†'.repeat(5-r.rating)}</span>
          </div>
          <div class="review-date">${timeAgo(r.created_at)}</div>
          <div class="review-text" style="margin-top:6px">${r.text}</div>
        </div>`).join(''):'<div style="font-size:12px;color:var(--muted);margin-bottom:12px">No reviews yet. Be the first!</div>'}
      <div class="review-form">
        <div class="review-form-title">Leave a review</div>
        <div class="star-select" id="starSelect">
          ${[1,2,3,4,5].map(n=>`<button class="star-btn" onclick="setRating(${n},${id})" data-star="${n}">â˜…</button>`).join('')}
        </div>
        <input id="reviewAuthor" placeholder="Your name (optional)" style="margin-bottom:8px"/>
        <textarea id="reviewText" placeholder="Share your experience..." style="min-height:60px;margin-bottom:8px"></textarea>
        <button class="btn-primary" style="margin-top:0" onclick="submitReview(${id})">Post Review</button>
      </div>
    </div>`;
  openDetail();
}

// â”€â”€ REVIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const reviewStore = {}; // In-memory until Supabase reviews table added

function getReviews(placeId) {
  return reviewStore[placeId] || [];
}

function setRating(n, placeId) {
  selectedRating = n;
  document.querySelectorAll('#starSelect .star-btn').forEach((b,i)=>{
    b.classList.toggle('active', i < n);
  });
}

function submitReview(placeId) {
  if(!selectedRating){ toast('Please select a star rating.','warn'); return; }
  const text=document.getElementById('reviewText').value.trim();
  const author=document.getElementById('reviewAuthor').value.trim()||'Anonymous';
  if(!text){ toast('Please write your review.','warn'); return; }
  if(!reviewStore[placeId]) reviewStore[placeId]=[];
  reviewStore[placeId].unshift({ author, rating:selectedRating, text, created_at:new Date().toISOString() });
  selectedRating=0;
  showPlaceDetail(placeId); // refresh
}

// â”€â”€ REDWAYS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleRedways(btn) {
  redwaysVisible = !redwaysVisible;
  btn.classList.toggle('active', redwaysVisible);
  if(redwaysVisible) loadRedways();
  else if(map.getLayer('redways')) { map.setLayoutProperty('redways','visibility','none'); }
}

async function loadRedways() {
  if(map.getLayer('redways')) { map.setLayoutProperty('redways','visibility','visible'); return; }
  try {
    // Overpass API query for MK Redways (designated cycling/walking paths)
    const query=`[out:json][timeout:25];(way["highway"="cycleway"](51.9,-0.95,52.15,-0.55);way["highway"="path"]["bicycle"="designated"](51.9,-0.95,52.15,-0.55);way["name"~"Redway",i](51.9,-0.95,52.15,-0.55););out geom;`;
    const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(query)});
    const d=await r.json();
    const geojson={type:'FeatureCollection',features:d.elements.filter(e=>e.type==='way'&&e.geometry).map(e=>({type:'Feature',properties:{name:e.tags?.name||'Redway',highway:e.tags?.highway},geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])}}))};
    if(!map.getSource('redways')) map.addSource('redways',{type:'geojson',data:geojson});
    map.addLayer({id:'redways',type:'line',source:'redways',layout:{visibility:'visible','line-join':'round','line-cap':'round'},paint:{'line-color':'#cc2200','line-width':2.5,'line-opacity':0.85}});
  } catch(e) {
    console.error('Redways failed:',e);
    toast('Could not load Redway data. Check your connection.','error');
  }
}

// â”€â”€ SEARCH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const routeFilterInput = document.getElementById('routeFilterInput');
const byId = (id)=>document.getElementById(id);

routeFilterInput.addEventListener('input', () => {
  transportRouteQuery = routeFilterInput.value.trim();
  if(transportView === 'route') {
    renderTransportSidebar();
    renderTransportMarkers();
  }
});

searchInput.addEventListener('input', async () => {
  const q = searchInput.value.trim().toLowerCase();
  if(!q) { searchResults.style.display='none'; return; }
  if(!data.places.length) data.places=getMKPlaces();
  if(!data.transport.length) data.transport=getMKBusRoutes();
  if(!data.events.length) data.events=getSampleEvents();
  const local=[
    ...data.issues.map(r=>({icon:catEmoji[r.category]||'âš ï¸',name:r.title,sub:`Issue Â· ${r.category}`,onClick:()=>showIssueDetail(r.id)})),
    ...data.events.map(e=>({icon:evEmoji(e.category),name:e.title,sub:`Event Â· ${e.venue}`,onClick:()=>showEventDetail(e.id)})),
    ...data.places.map(p=>({icon:p.emoji,name:p.name,sub:`${p.category} Â· ${p.open?'Open':'Closed'}`,onClick:()=>showPlaceDetail(p.id)})),
    ...data.transport.map(t=>({icon:'ðŸšŒ',name:`Bus ${t.number}: ${t.name}`,sub:`${t.operator} Â· ${t.stop}`,onClick:()=>showTransportDetail(t.id)})),
    ...data.parking.map(p=>({icon:'ðŸ…¿ï¸',name:p.name,sub:`Free parking Â· ${p.limit}`,onClick:()=>flyTo(p.lng,p.lat)})),
  ].filter(r=>r.name.toLowerCase().includes(q)).slice(0,5);

  // Also geocode via Mapbox for addresses/streets
  let geoResults=[];
  if(q.length>3){
    try{
      const r=await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?proximity=-0.7594,52.0406&bbox=-1.05,51.85,-0.55,52.2&country=gb&limit=4&access_token=${mapboxgl.accessToken}`);
      const d=await r.json();
      geoResults=(d.features||[]).map(f=>({
        icon:'ðŸ“',name:f.text||f.place_name,
        sub:f.place_name.replace(f.text+', ','').substring(0,60),
        onClick:()=>{map.flyTo({center:f.center,zoom:16,duration:800});searchResults.style.display='none';searchInput.value='';}
      }));
    }catch(e){}
  }

  const all=[...local,...geoResults].slice(0,8);
  if(!all.length){searchResults.style.display='none';return;}
  searchResults.innerHTML=all.map((_,i)=>`<div class="sr" id="sr${i}"><span class="sr-icon">${_.icon}</span><div><div class="sr-name">${_.name}</div><div class="sr-sub">${_.sub}</div></div></div>`).join('');
  all.forEach((_,i)=>{document.getElementById('sr'+i).addEventListener('click',()=>{_.onClick();searchInput.value='';searchResults.style.display='none';});});
  searchResults.style.display='block';
});
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap')) searchResults.style.display='none';});

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleLayerMenu(forceClose=false) {
  const menu = document.getElementById('layerMenu');
  if(forceClose) { menu.classList.remove('open'); return; }
  menu.classList.toggle('open');
}

document.addEventListener('click', e => {
  const menu = document.getElementById('layerMenu');
  if(menu && menu.classList.contains('open') && !e.target.closest('#layerMenu') && !e.target.closest('#layerMenuBtn')) {
    menu.classList.remove('open');
  }
});

// â”€â”€ MODALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openReportModal(lat,lng) {
  const latVal = (lat!==undefined && lat!==null) ? lat : pendingLat;
  const lngVal = (lng!==undefined && lng!==null) ? lng : pendingLng;
  document.getElementById('reportBody').innerHTML=`
    <p class="form-hint">Report any issue on MK roads, Redways or public spaces. Appears live instantly.</p>
    <div class="form-group"><label>Category *</label>
      <select id="r-cat">
        <option value="">Select...</option>
        <option value="Flooding">ðŸŒŠ Flooding</option>
        <option value="Closure">ðŸš§ Road / Path Closure</option>
        <option value="Lighting">ðŸ’¡ Lighting Issue</option>
        <option value="Obstruction">ðŸ—‘ï¸ Obstruction / Fly-tipping</option>
        <option value="Surface">âš ï¸ Surface Damage</option>
        <option value="Pothole">ðŸ•³ï¸ Pothole</option>
        <option value="Anti-social behaviour">ðŸš¨ Anti-social Behaviour</option>
      </select></div>
    <div class="form-group"><label>Title *</label><input id="r-title" placeholder="e.g. Flooded path near Willen Lake"/></div>
    <div class="form-group"><label>Description</label><textarea id="r-desc" placeholder="Extra details..."></textarea></div>
    <div class="form-group"><label>Location â€” Lat / Lng *</label>
      <div class="row2">
        <input type="number" id="r-lat" placeholder="52.0406" step="0.00001" value="${latVal?latVal.toFixed(5):''}"/>
        <input type="number" id="r-lng" placeholder="-0.7594" step="0.00001" value="${lngVal?lngVal.toFixed(5):''}"/>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:5px">ðŸ’¡ Close and click the map to set location</div>
    </div>
    <button class="btn-primary" onclick="submitIssue()">Submit Report â†’</button>`;
  document.getElementById('reportModal').classList.add('open');
}

function openEventModal(lat,lng) {
  const latVal = (lat!==undefined && lat!==null) ? lat : pendingLat;
  const lngVal = (lng!==undefined && lng!==null) ? lng : pendingLng;
  document.getElementById('eventBody').innerHTML=`
    <p class="form-hint">Add an event, pop-up or activity happening in MK.</p>
    <div class="form-group"><label>Category *</label>
      <select id="e-cat"><option value="">Select...</option><option value="Sports">âš½ Sports</option><option value="Arts">ðŸŽ¨ Arts</option><option value="Music">ðŸŽµ Music</option><option value="Market">ðŸ›ï¸ Market / Pop-up</option><option value="Food">ðŸ• Food & Drink</option><option value="Community">ðŸ‘¥ Community</option></select></div>
    <div class="form-group"><label>Event Name *</label><input id="e-title" placeholder="e.g. CMK Street Food Market"/></div>
    <div class="form-group"><label>Venue</label><input id="e-venue" placeholder="e.g. Midsummer Boulevard"/></div>
    <div class="form-group"><label>Description</label><textarea id="e-desc" placeholder="What's on, who's it for?"></textarea></div>
    <div class="row2" style="margin-bottom:12px">
      <div class="form-group" style="margin:0"><label>Date *</label><input type="date" id="e-date"/></div>
      <div class="form-group" style="margin:0"><label>Time</label><input type="time" id="e-time"/></div>
    </div>
    <div class="form-group"><label>Location â€” Lat / Lng *</label>
      <div class="row2">
        <input type="number" id="e-lat" placeholder="52.0406" step="0.00001" value="${latVal?latVal.toFixed(5):''}"/>
        <input type="number" id="e-lng" placeholder="-0.7594" step="0.00001" value="${lngVal?lngVal.toFixed(5):''}"/>
      </div></div>
    <div class="form-group"><label>Free entry?</label><select id="e-free"><option value="true">Yes â€” free</option><option value="false">No â€” ticketed</option></select></div>
    <button class="btn-primary" onclick="submitEvent()">Add to Map â†’</button>`;
  document.getElementById('eventModal').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if(pendingMarker){pendingMarker.remove();pendingMarker=null;}
  pendingLat=null;pendingLng=null;
}

// â”€â”€ SUBMIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function submitIssue() {
  const cat=document.getElementById('r-cat').value;
  const title=document.getElementById('r-title').value.trim();
  const desc=document.getElementById('r-desc').value.trim();
  const lat=parseFloat(document.getElementById('r-lat').value);
  const lng=parseFloat(document.getElementById('r-lng').value);
  if(!cat||!title||!lat||!lng){toast('Please fill in category, title and location.','warn');return;}
  const btn=document.querySelector('#reportBody .btn-primary');
  btn.disabled=true;btn.textContent='Submitting...';
  try{
    const r=await db.post('reports',{category:cat,title,description:desc,latitude:lat,longitude:lng,upvotes:0});
    if(!r.ok) throw new Error(await r.text());
    document.getElementById('reportBody').innerHTML=`<div class="success-msg"><div class="success-icon">âœ…</div><h3>Reported!</h3><p>Live on the map now.</p></div>`;
    toast('Issue reported â€” live on the map now.','success');
    setTimeout(()=>{closeModal('reportModal');loadIssues();},1800);
  }catch(e){toast('Submission error: '+e.message,'error');btn.disabled=false;btn.textContent='Submit Report â†’';}
}

async function submitEvent() {
  const cat=document.getElementById('e-cat').value;
  const title=document.getElementById('e-title').value.trim();
  const venue=document.getElementById('e-venue').value.trim();
  const desc=document.getElementById('e-desc').value.trim();
  const date=document.getElementById('e-date').value;
  const time=document.getElementById('e-time').value;
  const lat=parseFloat(document.getElementById('e-lat').value);
  const lng=parseFloat(document.getElementById('e-lng').value);
  const free=document.getElementById('e-free').value==='true';
  if(!cat||!title||!date||!lat||!lng){toast('Please fill in category, name, date and location.','warn');return;}
  const btn=document.querySelector('#eventBody .btn-primary');
  btn.disabled=true;btn.textContent='Adding...';
  try{
    await db.post('events',{category:cat,title,venue,description:desc,date,time,latitude:lat,longitude:lng,free});
    document.getElementById('eventBody').innerHTML=`<div class="success-msg"><div class="success-icon">âœ…</div><h3>Added!</h3><p>Event is live on the map.</p></div>`;
    toast('Event added â€” live on the map now.','success');
    setTimeout(()=>{closeModal('eventModal');loadEvents();},1800);
  }catch(e){toast('Submission error: '+e.message,'error');btn.disabled=false;btn.textContent='Add to Map â†’';}
}

// â”€â”€ UPVOTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function upvoteIssue(e,id) {
  if(e&&e.stopPropagation) e.stopPropagation();
  const r=data.issues.find(x=>x.id===id);
  if(!r) return;
  r.upvotes=(r.upvotes||0)+1;
  await db.patch('reports',id,{upvotes:r.upvotes});
  renderIssuesSidebar();
  renderLocalIntel();
}

// â”€â”€ DETAIL PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openDetail(){ document.getElementById('detailPanel').classList.add('open'); }
function closeDetail(){ document.getElementById('detailPanel').classList.remove('open'); }

// â”€â”€ FAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function onFabClick() {
  if(activeLayer==='issues') openReportModal();
  else if(activeLayer==='events') openEventModal();
}

// â”€â”€ SHARE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function sharePlace(name, id) {
  const url = `${window.location.origin}${window.location.pathname}?view=place&id=${id}`;
  if(navigator.share) { navigator.share({title:name+' â€” MK Maps',url}); }
  else { navigator.clipboard.writeText(url).then(()=>toast('Link copied to clipboard!','success')).catch(()=>toast('Share: '+url,'info',6000)); }
}
function shareEvent(name, id) {
  const url = `${window.location.origin}${window.location.pathname}?view=event&id=${id}`;
  if(navigator.share) { navigator.share({title:name+' â€” MK Maps',url}); }
  else { navigator.clipboard.writeText(url).then(()=>toast('Link copied to clipboard!','success')).catch(()=>toast('Share: '+url,'info',6000)); }
}

// â”€â”€ FLY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function flyTo(lng,lat){ map.flyTo({center:[lng,lat],zoom:16,duration:900}); }

// â”€â”€ UTILS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function timeAgo(d){const m=Math.floor((Date.now()-new Date(d))/60000);if(m<1)return'just now';if(m<60)return`${m}m ago`;if(m<1440)return`${Math.floor(m/60)}h ago`;return`${Math.floor(m/1440)}d ago`;}
function fmtDate(d){if(!d)return'';const dt=new Date(d),n=new Date(),diff=Math.floor((dt-n)/86400000);if(diff===0)return'Today';if(diff===1)return'Tomorrow';return dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function fmtUpdated(ts){
  if(!ts) return 'just now';
  const ms = typeof ts === 'number' ? (ts<1e12? ts*1000 : ts) : ts;
  return timeAgo(ms);
}

// â”€â”€ TOAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toast(msg, type='info', duration=3500) {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  const icons = {success:'âœ…',error:'âŒ',info:'â„¹ï¸',warn:'âš ï¸'};
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'â„¹ï¸'}</span><span>${msg}</span>`;
  container.appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);}, duration);
}

// â”€â”€ MOBILE SHEET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mobileTab(layer, btn) {
  document.querySelectorAll('.mobile-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  setLayer(layer, document.getElementById('btn-'+layer));
  // Mirror sidebar content into mobile list
  setTimeout(()=>{
    const ml=document.getElementById('mobileList');
    const sb=document.getElementById('sidebarBody');
    ml.innerHTML='<span class="mobile-sheet-handle"></span>'+sb.innerHTML;
    // Re-bind click events â€” clone nodes lose them, so we use event delegation via onclick attrs (already inline)
  },50);
}

// â”€â”€ WEATHER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let weatherData = null;

async function loadWeather() {
  const iconEl = byId('weatherIcon');
  const tempEl = byId('weatherTemp');
  const descEl = byId('weatherDesc');
  const chipEl = byId('weatherChip');
  if(!iconEl || !tempEl || !descEl || !chipEl) return;
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.0406&longitude=-0.7594&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,precipitation&hourly=temperature_2m,weather_code&timezone=Europe%2FLondon&forecast_days=1');
    const d = await r.json();
    const c = d.current;
    weatherData = {temp:Math.round(c.temperature_2m), feels:Math.round(c.apparent_temperature), code:c.weather_code, wind:Math.round(c.wind_speed_10m), humidity:c.relative_humidity_2m, precip:c.precipitation, hourly:d.hourly};
    const icon = wmoIcon(c.weather_code);
    const desc = wmoDesc(c.weather_code);
    iconEl.textContent = icon;
    tempEl.textContent = weatherData.temp + 'Â°C';
    descEl.textContent = desc;
    chipEl.title = `MK: ${desc}, feels ${weatherData.feels}Â°C, wind ${weatherData.wind} km/h`;
  } catch(e) { console.log('Weather unavailable'); }
}

function toggleWeatherDetail() {
  const panel = byId('weatherDetailPanel');
  if(!panel) return;
  const isOpen = panel.classList.toggle('open');
  if(isOpen && weatherData) {
    const w = weatherData;
    // Next 6 hours
    const now = new Date().getHours();
    const hourly = w.hourly;
    const hours = Array.from({length:6},(_,i)=>{
      const idx = now+i;
      if(idx>=hourly.time.length) return '';
      const t = new Date(hourly.time[idx]);
      return `<div class="weather-row"><span class="weather-row-label">${t.getHours().toString().padStart(2,'0')}:00</span><span>${wmoIcon(hourly.weather_code[idx])} ${Math.round(hourly.temperature_2m[idx])}Â°C</span></div>`;
    }).join('');
    document.getElementById('weatherDetailRows').innerHTML = `
      <div class="weather-row"><span class="weather-row-label">Feels like</span><span>${w.feels}Â°C</span></div>
      <div class="weather-row"><span class="weather-row-label">Wind</span><span>${w.wind} km/h</span></div>
      <div class="weather-row"><span class="weather-row-label">Humidity</span><span>${w.humidity}%</span></div>
      <div class="weather-row"><span class="weather-row-label">Precip</span><span>${w.precip} mm</span></div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:10px 0 6px">Next 6 hours</div>
      ${hours}
      <div style="font-size:9px;color:var(--muted);margin-top:8px">ðŸ“ Milton Keynes Â· Open-Meteo</div>`;
  }
}
function wmoIcon(c) {
  if(c===0) return 'â˜€ï¸';
  if(c<=2) return 'ðŸŒ¤ï¸';
  if(c<=3) return 'â˜ï¸';
  if(c<=49) return 'ðŸŒ«ï¸';
  if(c<=69) return 'ðŸŒ§ï¸';
  if(c<=79) return 'ðŸŒ¨ï¸';
  if(c<=82) return 'ðŸŒ¦ï¸';
  if(c<=99) return 'â›ˆï¸';
  return 'ðŸŒ¤ï¸';
}
function wmoDesc(c) {
  if(c===0) return 'Clear';
  if(c<=2) return 'Partly cloudy';
  if(c<=3) return 'Overcast';
  if(c<=49) return 'Foggy';
  if(c<=69) return 'Rainy';
  if(c<=79) return 'Snowy';
  if(c<=82) return 'Showers';
  if(c<=99) return 'Thunderstorm';
  return '';
}

// â”€â”€ NEAR ME / GEOLOCATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleNearMe() {
  if(!userLat) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      nearMeActive = true;
      document.getElementById('nearMeBtn').classList.add('active');
      document.getElementById('nearMeBtn').title = 'Near Me: ON';
      setSort('near');
      map.flyTo({center:[userLng,userLat],zoom:14,duration:800});
      renderLocalIntel();
      if(transportView==='near') { renderTransportSidebar(); renderTransportMarkers(); }
    }, () => { toast('Location access denied â€” enable it in browser settings.','warn'); nearMeActive=false; document.getElementById('nearMeBtn').classList.remove('active'); });
  } else {
    nearMeActive = !nearMeActive;
    document.getElementById('nearMeBtn').classList.toggle('active', nearMeActive);
    if(nearMeActive) { setSort('near'); map.flyTo({center:[userLng,userLat],zoom:14,duration:800}); }
    else setSort('recent');
    renderLocalIntel();
    if(transportView==='near') { renderTransportSidebar(); renderTransportMarkers(); }
  }
}

function setSort(mode) {
  activeSort = mode;
  document.getElementById('sortRecent').classList.toggle('active', mode==='recent');
  document.getElementById('sortNear').classList.toggle('active', mode==='near');
  if(mode==='near' && !userLat) { toggleNearMe(); return; }
  if(mode==='near') document.getElementById('distBadge').textContent = 'ðŸ“ your location';
  else document.getElementById('distBadge').textContent = '';
  // Re-render current layer
  if(activeLayer==='issues') renderIssuesSidebar();
  else if(activeLayer==='events') renderEventsSidebar();
  else if(activeLayer==='places') renderPlacesSidebar();
  renderLocalIntel();
}

function distKm(lat1,lng1,lat2,lng2) {
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function fmtDist(km) {
  if(km<1) return Math.round(km*1000)+'m';
  return km.toFixed(1)+'km';
}

// â”€â”€ FILTERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderFilterBar(cats) {
  const bar = document.getElementById('filterBar');
  if(!cats||!cats.length){bar.style.display='none';return;}
  bar.style.display='flex';
  bar.innerHTML = '<span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);align-self:center;flex-shrink:0">Filter</span>' +
    ['All',...cats].map(c=>`<button class="filter-chip ${!activeFilters[activeLayer]||activeFilters[activeLayer]===c||c==='All'&&!activeFilters[activeLayer]?'active':''}" onclick="setFilter('${c}')">${c}</button>`).join('');
}

function setFilter(cat) {
  activeFilters[activeLayer] = cat==='All'?null:cat;
  document.querySelectorAll('.filter-chip').forEach(b=>b.classList.toggle('active',b.textContent===cat||(cat==='All'&&b.textContent==='All')));
  if(activeLayer==='issues') renderIssuesSidebar();
  else if(activeLayer==='events') renderEventsSidebar();
  else if(activeLayer==='places') renderPlacesSidebar();
}

// â”€â”€ ROUTING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleRoutePanel() {
  const panel = document.getElementById('routePanel');
  const btn = document.getElementById('routeHeaderBtn');
  const open = panel.classList.toggle('open');
  btn.classList.toggle('active', open);
  if(open && userLat) {
    document.getElementById('routeFrom').value = 'Your location';
  }
}

function setRouteMode(btn) {
  routeMode = btn.dataset.mode;
  document.querySelectorAll('.route-mode').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

async function getDirections() {
  const from = document.getElementById('routeFrom').value.trim();
  const to = document.getElementById('routeTo').value.trim();
  const result = document.getElementById('routeResult');
  if(!to){toast('Please enter a destination.','warn');return;}

  result.className='route-result show';
  result.textContent='Finding routeâ€¦';

  try {
    let fromCoords;
    if(!from || from.toLowerCase().includes('your location') || from.toLowerCase().includes('me')) {
      if(!userLat) {
        await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(p=>{userLat=p.coords.latitude;userLng=p.coords.longitude;res();},rej));
      }
      fromCoords = [userLng, userLat];
    } else {
      fromCoords = await geocodeMK(from);
    }
    const toCoords = await geocodeMK(to);
    if(!fromCoords||!toCoords){result.textContent='Could not find one of the locations.';return;}

    const profile = routeMode==='cycling'?'mapbox/cycling':routeMode==='walking'?'mapbox/walking':'mapbox/driving';
    const r = await fetch(`https://api.mapbox.com/directions/v5/${profile}/${fromCoords.join(',')};${toCoords.join(',')}?steps=false&geometries=geojson&access_token=${mapboxgl.accessToken}`);
    const d = await r.json();
    if(!d.routes||!d.routes.length){result.textContent='No route found.';return;}

    const route = d.routes[0];
    const mins = Math.round(route.duration/60);
    const km = (route.distance/1000).toFixed(1);
    const modeEmoji = routeMode==='cycling'?'ðŸš´':routeMode==='walking'?'ðŸš¶':'ðŸš—';
    result.innerHTML = `${modeEmoji} <strong>${mins} min</strong> Â· ${km} km<br/><span style="color:var(--muted);font-size:10px">${routeMode.charAt(0).toUpperCase()+routeMode.slice(1)} route</span>`;

    // Draw route on map
    const routeGeo = {type:'Feature',properties:{},geometry:route.geometry};
    lastRouteGeo = routeGeo;
    if(map.getSource('route')) {
      map.getSource('route').setData(routeGeo);
    } else {
      map.addSource('route',{type:'geojson',data:routeGeo});
      map.addLayer({id:'route',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#4a9eff','line-width':4,'line-opacity':0.85}});
    }
    // Fit bounds
    const coords = route.geometry.coordinates;
    const bounds = coords.reduce((b,c)=>b.extend(c), new mapboxgl.LngLatBounds(coords[0],coords[0]));
    map.fitBounds(bounds,{padding:80});

  } catch(e) {
    result.textContent = 'Error: ' + e.message;
  }
}

async function geocodeMK(query) {
  // Try to find in local data first
  const lq = query.toLowerCase();
  const place = data.places.find(p=>p.name.toLowerCase().includes(lq));
  if(place) return [place.lng, place.lat];
  const ev = data.events.find(e=>e.title.toLowerCase().includes(lq)||e.venue.toLowerCase().includes(lq));
  if(ev) return [ev.longitude, ev.latitude];
  // Otherwise geocode via Mapbox
  const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query+' Milton Keynes')}.json?proximity=-0.7594,52.0406&country=gb&limit=1&access_token=${mapboxgl.accessToken}`);
  const d = await r.json();
  if(d.features&&d.features.length) return d.features[0].center;
  return null;
}

// Route destination from detail panel
function routeTo(name,lat,lng) {
  document.getElementById('routeTo').value = name;
  if(userLat) document.getElementById('routeFrom').value = 'Your location';
  document.getElementById('routePanel').classList.add('open');
  document.getElementById('routeHeaderBtn').classList.add('active');
  // Pre-draw if we have user location
  if(userLat) getDirections();
}

// â”€â”€ NEARBY PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openNearby() {
  const panel = document.getElementById('nearbyPanel');
  if(panel.classList.toggle('open') && !userLat) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLat=pos.coords.latitude; userLng=pos.coords.longitude;
      renderNearby();
    }, () => {
      document.getElementById('nearbyContent').innerHTML='<div style="font-size:11px;color:var(--red)">Location access denied.</div>';
    });
  } else if(userLat) {
    renderNearby();
  }
}
function closeNearby() { document.getElementById('nearbyPanel').classList.remove('open'); }

function renderNearby() {
  const R=0.75; // km radius
  if(!data.places.length) data.places=getMKPlaces();
  if(!data.events.length) data.events=getSampleEvents();
  if(!data.transport.length) data.transport=getMKBusRoutes();

  const nearPlaces=data.places.map(p=>({...p,_d:distKm(userLat,userLng,p.lat,p.lng)})).filter(p=>p._d<=R*2).sort((a,b)=>a._d-b._d).slice(0,6);
  const nearEvents=data.events.map(e=>({...e,_d:distKm(userLat,userLng,e.latitude,e.longitude)})).filter(e=>e._d<=R*3).sort((a,b)=>a._d-b._d).slice(0,4);
  const nearIssues=data.issues.map(r=>({...r,_d:distKm(userLat,userLng,r.latitude,r.longitude)})).filter(r=>r._d<=R).sort((a,b)=>a._d-b._d).slice(0,4);
  const nearStops=data.transport.map(t=>({...t,_d:distKm(userLat,userLng,t.lat,t.lng)})).filter(t=>t._d<=R*2).sort((a,b)=>a._d-b._d).slice(0,4);

  let html='';
  if(nearPlaces.length) {
    html+=`<div class="nearby-section"><div class="nearby-section-label">Places</div>`;
    html+=nearPlaces.map(p=>`<div class="nearby-item" onclick="showPlaceDetail(${p.id});closeNearby()"><span class="nearby-icon">${p.emoji}</span><span class="nearby-name">${p.name}</span><span class="nearby-dist">${fmtDist(p._d)}</span></div>`).join('');
    html+='</div>';
  }
  if(nearStops.length) {
    html+=`<div class="nearby-section"><div class="nearby-section-label">Bus Stops</div>`;
    html+=nearStops.map(t=>`<div class="nearby-item" onclick="showTransportDetail(${t.id});closeNearby()"><span class="nearby-icon">ðŸšŒ</span><span class="nearby-name">Bus ${t.number}: ${t.name.split('â€”')[0].trim()}</span><span class="nearby-dist">${fmtDist(t._d)}</span></div>`).join('');
    html+='</div>';
  }
  if(nearEvents.length) {
    html+=`<div class="nearby-section"><div class="nearby-section-label">Events Nearby</div>`;
    html+=nearEvents.map(e=>`<div class="nearby-item" onclick="showEventDetail(${e.id});closeNearby()"><span class="nearby-icon">${evEmoji(e.category)}</span><span class="nearby-name">${e.title}</span><span class="nearby-dist">${fmtDist(e._d)}</span></div>`).join('');
    html+='</div>';
  }
  if(nearIssues.length) {
    html+=`<div class="nearby-section"><div class="nearby-section-label">Live Issues</div>`;
    html+=nearIssues.map(r=>`<div class="nearby-item" onclick="showIssueDetail(${r.id});closeNearby()"><span class="nearby-icon">${catEmoji[r.category]||'âš ï¸'}</span><span class="nearby-name">${r.title}</span><span class="nearby-dist">${fmtDist(r._d)}</span></div>`).join('');
    html+='</div>';
  }
  if(!html) html='<div style="font-size:11px;color:var(--muted);padding:8px 0">Nothing found within 1.5km of your location.</div>';
  document.getElementById('nearbyContent').innerHTML=html;
}

// â”€â”€ DEEP LINKS (shareable URLs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateURL(type, id) {
  const url = new URL(window.location);
  url.searchParams.set('view', type);
  url.searchParams.set('id', id);
  history.replaceState(null,'',url);
}

function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const id = parseInt(params.get('id'));
  if(!view||!id) return;
  setTimeout(()=>{
    if(view==='place'){data.places=getMKPlaces();showPlaceDetail(id);}
    else if(view==='event'){loadEvents().then(()=>showEventDetail(id));}
    else if(view==='issue'){loadIssues().then(()=>showIssueDetail(id));}
  },800);
}

// â”€â”€ LAYER MEMORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function saveLayer(layer) {
  try{localStorage.setItem('mkmaps_layer',layer);}catch(e){}
}
function getSavedLayer() {
  try{return localStorage.getItem('mkmaps_layer')||'issues';}catch(e){return 'issues';}
}

// â”€â”€ LOADING SKELETONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showSkeletons(count=3) {
  const body=document.getElementById('sidebarBody');
  body.innerHTML=Array.from({length:count},()=>`
    <div class="skeleton-card">
      <div class="skeleton" style="width:60%;height:10px"></div>
      <div class="skeleton" style="width:90%;height:13px;margin:8px 0 4px"></div>
      <div class="skeleton" style="width:75%;height:10px"></div>
    </div>`).join('');
}

// â”€â”€ PWA INSTALL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  setTimeout(()=>document.getElementById('installBanner').classList.add('show'), 3000);
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const {outcome} = await deferredInstallPrompt.userChoice;
  if(outcome==='accepted') toast('MK Maps installed! ðŸŽ‰','success');
  document.getElementById('installBanner').classList.remove('show');
  deferredInstallPrompt=null;
});

// â”€â”€ EXPOSE GLOBALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.setLayer=setLayer;
window.toggleRedways=toggleRedways;
window.toggleSidebar=toggleSidebar;
window.toggleLayerMenu=toggleLayerMenu;
window.toggleTheme=toggleTheme;
window.onFabClick=onFabClick;
window.closeModal=closeModal;
window.closeDetail=closeDetail;
window.submitIssue=submitIssue;
window.submitEvent=submitEvent;
window.upvoteIssue=upvoteIssue;
window.showPlaceDetail=showPlaceDetail;
window.showIssueDetail=showIssueDetail;
window.showEventDetail=showEventDetail;
window.showTransportDetail=showTransportDetail;
window.setRating=setRating;
window.submitReview=submitReview;
window.flyTo=flyTo;
window.sharePlace=sharePlace;
window.shareEvent=shareEvent;
window.toggleNearMe=toggleNearMe;
window.setSort=setSort;
window.setFilter=setFilter;
window.toggleRoutePanel=toggleRoutePanel;
window.setRouteMode=setRouteMode;
window.getDirections=getDirections;
window.routeTo=routeTo;
window.toggleWeatherDetail=toggleWeatherDetail;
window.markResolved=markResolved;
window.mobileTab=mobileTab;
window.openNearby=openNearby;
window.closeNearby=closeNearby;
window.toast=toast;

// â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
setTimeout(()=>{document.getElementById('mapHint').style.opacity='0';},5000);
map.on('load',()=>{
  // Restore last layer
  const savedLayer = getSavedLayer();
  const savedBtn = document.getElementById('btn-'+savedLayer);
  try{ setLayer(savedLayer, savedBtn); }catch(e){ showFatal(e.message||'Layer init failed'); }

  try{ initTheme(); }catch(e){ showFatal(e.message||'Theme init failed'); }
  document.getElementById('sidebar').classList.add('collapsed');
  loadWeather();

  // Silent geolocation on startup
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos=>{
      userLat=pos.coords.latitude;
      userLng=pos.coords.longitude;
      const nb = byId('nearMeBtn'); if(nb) nb.title='Near Me';
    },()=>{});
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if(e.key==='/' && !e.target.matches('input,textarea,select')) {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if(e.key==='Escape') {
      searchResults.style.display='none';
      const rp = byId('routePanel'); if(rp) rp.classList.remove('open');
      const rh = byId('routeHeaderBtn'); if(rh) rh.classList.remove('active');
      const np = byId('nearbyPanel'); if(np) np.classList.remove('open');
      const wd = byId('weatherDetailPanel'); if(wd) wd.classList.remove('open');
      closeDetail();
    }
  });

  // Close weather detail on outside click
  document.addEventListener('click', e => {
    if(byId('weatherChip') && byId('weatherDetailPanel')) {
      if(!e.target.closest('#weatherChip') && !e.target.closest('#weatherDetailPanel')) {
        byId('weatherDetailPanel').classList.remove('open');
      }
    }
    if(!e.target.closest('#nearbyPanel') && !e.target.closest('#nearMeBtn')) {
      // don't auto-close nearby â€” user explicitly closes it
    }
  });

  // Route input enter keys
  document.getElementById('routeFrom').addEventListener('keydown',e=>{if(e.key==='Enter') getDirections();});
  document.getElementById('routeTo').addEventListener('keydown',e=>{if(e.key==='Enter') getDirections();});

  // Handle deep links
  handleDeepLink();
});

map.on('style.load',()=>{
  try{
    if(redwaysVisible) loadRedways();
    if(lastRouteGeo) {
      if(map.getSource('route')) map.getSource('route').setData(lastRouteGeo);
      else {
        map.addSource('route',{type:'geojson',data:lastRouteGeo});
        map.addLayer({id:'route',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#4a9eff','line-width':4,'line-opacity':0.85}});
      }
    }
  }catch(e){ showFatal(e.message||'Style load failed'); }
});

function toggleTheme() {
  const body = document.body;
  const on = body.classList.toggle('theme-day');
  try{ localStorage.setItem('mkmaps_theme', on ? 'day' : 'dark'); }catch(e){}
  document.getElementById('themeToggle').textContent = on ? 'ðŸŒ™ Night' : 'ðŸŒ¤ï¸ Day';
  map.setStyle(on ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11');
}

function initTheme() {
  let theme = 'day';
  try{ theme = localStorage.getItem('mkmaps_theme') || 'day'; }catch(e){}
  if(theme==='day') {
    document.body.classList.add('theme-day');
    document.getElementById('themeToggle').textContent = 'ðŸŒ™ Night';
    map.setStyle('mapbox://styles/mapbox/light-v11');
  } else {
    document.getElementById('themeToggle').textContent = 'ðŸŒ¤ï¸ Day';
  }
}

} // end initApp

