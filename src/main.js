import Fuse from 'fuse.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { db, initDB, toggleFavorite, getFavorites, toggleCompare, getCompareIds, clearCompare } from './db/index.js';
import { phones, brands, priceSegments } from './data/phones.js';

// ---------- Frame Wrapper Controls (removed — responsive layout) ----------
const phoneFrame = document.getElementById('phoneFrame');
const deviceShell = document.getElementById('deviceShell');
const bezelSeg = document.getElementById('bezelSeg');
const notchSeg = document.getElementById('notchSeg');
const deviceSelect = document.getElementById('deviceSelect');
const zoomSeg = document.getElementById('zoomSeg');
const toggleFrameBtn = document.getElementById('toggleFrame');
const frameToolbar = document.getElementById('frameToolbar');
const sideInfo = document.getElementById('sideInfo');

if(bezelSeg) bezelSeg.addEventListener('click', e=>{
  if(e.target.tagName!=='BUTTON') return;
  bezelSeg.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  if(!phoneFrame) return;
  if(e.target.dataset.bezel==='android') phoneFrame.classList.add('android');
  else phoneFrame.classList.remove('android');
});
if(notchSeg) notchSeg.addEventListener('click', e=>{
  if(e.target.tagName!=='BUTTON') return;
  notchSeg.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  if(!phoneFrame) return;
  if(e.target.dataset.notch==='punch') phoneFrame.classList.add('punch');
  else phoneFrame.classList.remove('punch');
});
if(deviceSelect) deviceSelect.addEventListener('change', ()=>{
  if(!phoneFrame) return;
  const v=deviceSelect.value;
  if(v.endsWith('landscape')) phoneFrame.classList.add('landscape');
  else phoneFrame.classList.remove('landscape');
  if(v==='390x844' && !phoneFrame.classList.contains('landscape')){
    phoneFrame.style.width='390px';phoneFrame.style.minWidth='390px';phoneFrame.style.height='844px';phoneFrame.style.minHeight='844px';
  } else if(v==='412x915'){
    phoneFrame.style.width='412px';phoneFrame.style.minWidth='412px';phoneFrame.style.height='915px';phoneFrame.style.minHeight='915px';
  } else if(v==='360x800'){
    phoneFrame.style.width='360px';phoneFrame.style.minWidth='360px';phoneFrame.style.height='800px';phoneFrame.style.minHeight='800px';
  } else if(v==='393x852'){
    phoneFrame.style.width='393px';phoneFrame.style.minWidth='393px';phoneFrame.style.height='852px';phoneFrame.style.minHeight='852px';
  } else if(v==='390x844-landscape'){
    phoneFrame.style.width='844px';phoneFrame.style.minWidth='844px';phoneFrame.style.height='390px';phoneFrame.style.minHeight='390px';
  }
});
if(zoomSeg) zoomSeg.addEventListener('click', e=>{
  if(e.target.tagName!=='BUTTON') return;
  zoomSeg.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  if(!phoneFrame) return;
  phoneFrame.classList.remove('zoom-90','zoom-75');
  if(e.target.dataset.zoom==='90') phoneFrame.classList.add('zoom-90');
  if(e.target.dataset.zoom==='75') phoneFrame.classList.add('zoom-75');
});
let frameHidden=false;
if(toggleFrameBtn) toggleFrameBtn.addEventListener('click', ()=>{
  frameHidden=!frameHidden;
  if(deviceShell) deviceShell.classList.toggle('no-frame', frameHidden);
  toggleFrameBtn.textContent = frameHidden ? 'Show Frame ▣' : 'Hide Frame 📱';
  if(sideInfo) sideInfo.style.display = frameHidden ? 'block' : 'none';
  if(frameToolbar){
    const hint=frameToolbar.querySelector('.frame-hint');
    if(hint){
      if(frameHidden) hint.textContent='Desktop mode — responsive 1280px';
      else hint.innerHTML='<span class="dot"></span> Live Preview • <span id="offlineHint">Online</span> • Tap frame to interact';
    }
  }
});

// live clock — optional (no status bar in minimal layout)
function tickClock(){
  const now=new Date();
  const t=now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  const el=document.getElementById('statusClock');
  if(el) el.textContent=t+' — Archive Open';
}
setInterval(tickClock, 1000); tickClock();

// theme — light vs dark
const themeToggle=document.getElementById('themeToggle');
let theme=localStorage.getItem('aether-theme')||'light';
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t==='dark'?'dark':'');
  themeToggle.textContent=t==='dark'?'☀️':'◐';
  localStorage.setItem('aether-theme', t);
}
applyTheme(theme);
if(themeToggle) themeToggle.addEventListener('click', ()=>{ theme=theme==='light'?'dark':'light'; applyTheme(theme);});

// toast
function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.innerHTML=msg;
  t.style.position='fixed';t.style.bottom='22px';t.style.left='50%';t.style.transform='translateX(-50%)';
  t.style.background='#1B1B1F';t.style.color='#FFFBF2';t.style.border='1.5px solid #1B1B1F';t.style.padding='10px 14px';t.style.borderRadius='999px';t.style.fontSize='12px';t.style.fontWeight='700';t.style.zIndex='100';t.style.display='flex';t.style.alignItems='center';t.style.gap='8px';t.style.boxShadow='4px 4px 0 #1B1B1F';t.style.fontFamily='IBM Plex Mono, monospace';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2600);
}

// ---------- DB & Offline ----------
let allPhones=[];
let fuse;
async function boot(){
  await initDB();
  allPhones = await db.phones.toArray();
  // Also ensure Fuse index
  fuse = new Fuse(allPhones, {
    keys: [
      {name:'brand', weight:0.9},{name:'model', weight:1},{name:'aka', weight:0.6},
      {name:'highlights', weight:0.7},{name:'display.type', weight:0.4},{name:'soc.chipset', weight:0.6},
      {name:'camera.primary.sensor', weight:0.5},{name:'price.segment', weight:0.3},{name:'status', weight:0.3}
    ],
    threshold:0.35, ignoreLocation:true, includeScore:true
  });
  document.getElementById('countPill').textContent=`${allPhones.length} Devices`;
  document.getElementById('statDevices').textContent=allPhones.length;
  // populate filters
  const brandSel=document.getElementById('filterBrand');
  [...new Set(allPhones.map(p=>p.brand))].forEach(b=>{ const o=document.createElement('option');o.value=b;o.textContent=b;brandSel.appendChild(o);});
  const segSel=document.getElementById('filterSegment');
  priceSegments.forEach(s=>{ const o=document.createElement('option');o.value=s;o.textContent=s;segSel.appendChild(o);});
  renderFeatured();
  renderCatalog();
  updateCompareUI();
  refreshVault();
  initRadar();
  initSensors();
  initValueCalc();
  updateOfflinePill();
}
boot();

// Service Worker
let swReg=null;
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(reg=>{
    swReg=reg;
    document.getElementById('swStatus').textContent='Filed — '+allPhones.length+' cards in drawer';
    document.getElementById('swStatus').style.color='var(--teal)';
  }).catch(()=>{ document.getElementById('swStatus').textContent='Offline-ready (fallback)';});
}
function updateOfflinePill(){
  const pill=document.getElementById('offlinePill');
  const hint=document.getElementById('offlineHint');
  const online=navigator.onLine;
  if(online){
    pill.innerHTML='<span class="dot"></span> Card catalog • Offline ready';
    if(hint) hint.textContent='Paper Archive — Live';
  } else {
    pill.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:var(--mustard);display:inline-block;border:1.5px solid var(--ink)"></span> Reading offline • Cards on desk';
    if(hint) hint.textContent='Offline';
  }
}
window.addEventListener('online', ()=>{ updateOfflinePill(); toast('🌐 Back online — syncing deltas…'); if(swReg && 'sync' in swReg) swReg.sync.register('aether-sync');});
window.addEventListener('offline', updateOfflinePill);

// ---------- Navigation ----------
const navBtns=document.querySelectorAll('.nav-btn');
const viewRoots=document.querySelectorAll('[data-view-root]');
function showView(name){
  viewRoots.forEach(v=> v.style.display = v.getAttribute('data-view-root')===name ? 'block' : 'none');
  navBtns.forEach(b=> b.classList.toggle('active', b.dataset.view===name));
  document.getElementById('appMain').scrollTop=0;
  if(name==='compare') renderCompare();
  if(name==='vault') refreshVault();
}
navBtns.forEach(b=> b.addEventListener('click', ()=> showView(b.dataset.view)));
document.querySelectorAll('[data-view-link]').forEach(el=> el.addEventListener('click', ()=> showView(el.getAttribute('data-view-link'))));
document.getElementById('ctaExplore').addEventListener('click', ()=> showView('catalog'));
document.getElementById('ctaCompare').addEventListener('click', ()=> showView('compare'));
document.getElementById('vaultBtn').addEventListener('click', ()=> showView('vault'));

// ---------- Search ----------
const searchInput=document.getElementById('searchInput');
searchInput.addEventListener('input', ()=>{
  const q=searchInput.value.trim();
  if(!q){ renderCatalog(); showView('catalog'); return; }
  const res=fuse.search(q).map(r=>r.item);
  renderCatalog(res, q);
  showView('catalog');
  if(res.length===0) toast('◌ No match — try “Titanium” or “1-inch”');
});
document.querySelectorAll('[data-filter]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    searchInput.value=btn.dataset.filter;
    searchInput.dispatchEvent(new Event('input'));
  });
});

// ---------- Catalog Rendering ----------
function starBrand(b){
  const icons={Apple:'', Samsung:'◆', Google:'G', OnePlus:'1+', Xiaomi:'Mi', Nothing:'◍', ASUS:'ROG', Nokia:'☎'};
  return icons[b]||'◈';
}
function cardHTML(p, opts={}){
  const isFav = opts.favs?.has(p.id);
  const inCompare = opts.compared?.has(p.id);
  return `<div class="card" data-id="${p.id}">
    <div class="card-img">
      <img src="${p.image}" alt="${p.model}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80'">
      <span class="card-badge ${p.price.segment==='Ultra-Premium'?'ultra':''}">${p.status}</span>
      <button class="card-fav ${isFav?'active':''}" data-fav="${p.id}" title="Favorite">♡</button>
    </div>
    <div class="card-body">
      <div class="card-brand">${starBrand(p.brand)} ${p.brand} • ${new Date(p.released).getFullYear()}</div>
      <div class="card-model">${p.model}</div>
      <div class="card-meta">
        <span class="chip">${p.soc.chipset.split(' ')[0]} ${p.soc.chipset.split(' ')[1]||''}</span>
        <span class="chip">${p.display.size}" ${p.display.refresh.includes('120')?'120Hz':p.display.refresh.split(' ')[0]}</span>
        <span class="chip">${p.camera.primary.mp}</span>
        <span class="chip">${p.battery.capacity}mAh</span>
      </div>
      <div class="card-foot">
        <div class="price">$${p.price.usd.toLocaleString()} <small>• ${p.price.segment}</small></div>
        <button class="add-compare ${inCompare?'active':''}" data-compare="${p.id}" title="Compare">${inCompare?'✓':'＋'}</button>
      </div>
    </div>
  </div>`;
}
function renderFeatured(){
  const grid=document.getElementById('featuredGrid');
  const featured = allPhones.filter(p=>['s24-ultra','iphone-15-pro-max','xiaomi-14-ultra','oneplus-12'].includes(p.id));
  Promise.resolve(getFavorites()).then(()=>{}); // warm
  grid.innerHTML = featured.map(p=>cardHTML(p)).join('');
  attachCardListeners(grid);
}
async function renderCatalog(list=null, query=null){
  const grid=document.getElementById('catalogGrid');
  const empty=document.getElementById('catalogEmpty');
  let data = list || allPhones;
  // apply filters
  const brand=document.getElementById('filterBrand').value;
  const segment=document.getElementById('filterSegment').value;
  const sort=document.getElementById('filterSort').value;
  if(!list){
    if(brand) data=data.filter(p=>p.brand===brand);
    if(segment) data=data.filter(p=>p.price.segment===segment);
    // sort
    if(sort==='released-desc') data=[...data].sort((a,b)=> new Date(b.released)-new Date(a.released));
    if(sort==='price-asc') data=[...data].sort((a,b)=> a.price.usd-b.price.usd);
    if(sort==='price-desc') data=[...data].sort((a,b)=> b.price.usd-a.price.usd);
    if(sort==='camera-desc') data=[...data].sort((a,b)=> b.cameraScore-a.cameraScore);
    if(sort==='antutu-desc') data=[...data].sort((a,b)=> b.benchmarks.antutu-a.benchmarks.antutu);
  }
  const favs = new Set((await db.favorites.toArray()).map(f=>f.id));
  const compared = new Set(await getCompareIds());
  if(data.length===0){ grid.style.display='none'; empty.style.display='block'; }
  else {
    grid.style.display='grid'; empty.style.display='none';
    grid.innerHTML = data.map(p=>cardHTML(p, {favs, compared})).join('');
    attachCardListeners(grid);
  }
}
function attachCardListeners(container){
  container.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click', e=>{
      if(e.target.closest('[data-fav]') || e.target.closest('[data-compare]')) return;
      openDetail(card.dataset.id);
    });
  });
  container.querySelectorAll('[data-fav]').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      e.stopPropagation();
      const id=btn.dataset.fav;
      await toggleFavorite(id);
      btn.classList.toggle('active');
      toast(btn.classList.contains('active') ? '♡ Saved to Vault (IndexedDB)' : 'Removed from Vault');
      refreshVault();
    });
  });
  container.querySelectorAll('[data-compare]').forEach(btn=>{
    btn.addEventListener('click', async e=>{
      e.stopPropagation();
      try{
        const added=await toggleCompare(btn.dataset.compare);
        btn.classList.toggle('active', added);
        btn.textContent=added?'✓':'＋';
        toast(added ? '⚖ Added to Compare Lab (max 4)':'Removed from comparison');
        updateCompareUI();
        if(added && document.querySelector('[data-view-root="compare"]').style.display==='block') renderCompare();
      } catch(err){ toast('⚖ Max 4 devices — clear one first'); }
    });
  });
}
document.getElementById('filterBrand').addEventListener('change', ()=>renderCatalog());
document.getElementById('filterSegment').addEventListener('change', ()=>renderCatalog());
document.getElementById('filterSort').addEventListener('change', ()=>renderCatalog());
document.getElementById('clearFilters').addEventListener('click', ()=>{
  document.getElementById('filterBrand').value=''; document.getElementById('filterSegment').value=''; document.getElementById('filterSort').value='released-desc';
  searchInput.value=''; renderCatalog();
});

// ---------- Detail View ----------
async function openDetail(id){
  const p = allPhones.find(x=>x.id===id);
  if(!p) return;
  showView('detail');
  const favs = new Set((await db.favorites.toArray()).map(f=>f.id));
  const isFav=favs.has(id);
  const root=document.getElementById('detailRoot');
  root.innerHTML = `
    <div class="detail-hero" style="background:${p.heroColor}">
      <img src="${p.image}" alt="${p.model}" />
      <div class="detail-hero-content">
        <div class="detail-avatar"><img src="${p.image}" /></div>
        <div class="detail-title">
          <h2>${p.brand} ${p.model}</h2>
          <p>${p.aka} • ${p.released} • ${p.status}</p>
          <div class="meta"><span>$${p.price.usd} USD</span><span>${p.price.segment}</span><span>${p.highlights[0]}</span></div>
        </div>
      </div>
    </div>
    <div class="section" style="padding-top:12px">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-primary" id="detailCompare" style="flex:1">⚖ ${ (await getCompareIds()).includes(id) ? 'In Compare ✓' : 'Add to Compare'}</button>
        <button class="btn btn-ghost" id="detailFav" style="flex:1">${isFav?'♥ Saved':'♡ Save to Vault'}</button>
        <button class="btn btn-ghost" id="detailBack" style="padding:10px 14px">← Back</button>
      </div>

      <!-- Modular Boxes -->
      ${boxHTML('Display — Hyper-Granular', '▣', `
        <div class="box-grid">
          <div class="kv"><label>Panel & Substrate</label><b>${p.display.type}</b><span>${p.display.panelManufacturer} • ${p.display.substrate}</span></div>
          <div class="kv"><label>Size & Resolution</label><b>${p.display.size}" • ${p.display.resolution}</b><span>${p.display.ppi} PPI • ${p.display.refresh}</span></div>
          <div class="kv"><label>Subpixel & HDR</label><b>${p.display.subpixel}</b><span>${p.display.hdr}</span></div>
          <div class="kv"><label>Brightness (nits)</label><b>${p.display.brightness.peak1} peak @1% APL • ${p.display.brightness.sustained100} 100% APL</b><span>HBM ${p.display.brightness.hbm}</span></div>
          <div class="kv"><label>PWM Dimming</label><b>${p.display.pwm}</b><span>Touch ${p.display.touchSampling}</span></div>
          <div class="kv"><label>Protection</label><b>${p.display.protection}</b><span>${p.display.extra}</span></div>
        </div>
        <div class="badge-row"><span class="micro-badge accent">${p.display.refresh}</span><span class="micro-badge">${p.display.pwm}</span><span class="micro-badge success">${p.display.brightness.peak1} nits</span></div>
      `, true)}
      ${boxHTML('SoC & Thermals', '⚡', `
        <div class="box-grid">
          <div class="kv"><label>Chipset & Node</label><b>${p.soc.chipset}</b><span>${p.soc.revision} • ${p.soc.node}</span></div>
          <div class="kv"><label>CPU Cluster</label><b style="font-size:11.5px">${p.soc.cpu}</b></div>
          <div class="kv"><label>GPU & NPU</label><b>${p.soc.gpu}</b><span>${p.soc.npu}</span></div>
          <div class="kv"><label>Memory</label><b>${p.soc.ram}</b><span>${p.soc.storage}</span></div>
          <div class="kv"><label>Cooling System</label><b>${p.soc.cooling}</b><span>${p.soc.coolingLayers}</span></div>
          <div class="kv"><label>Throttling Curve</label><b>${p.soc.throttling}</b><span>3DMark / Genshin sustained</span></div>
        </div>
        <div class="badge-row"><span class="micro-badge">${p.soc.node}</span><span class="micro-badge accent">VC ${p.soc.cooling.split(' ')[p.soc.cooling.split(' ').length-1]}</span><span class="micro-badge">${p.benchmarks.antutu.toLocaleString()} AnTuTu</span></div>
      `)}
      ${boxHTML('Camera Hardware & Optics', '📷', `
        <div class="box-grid">
          <div class="kv"><label>Primary Sensor</label><b>${p.camera.primary.sensor}</b><span>${p.camera.primary.size} • ${p.camera.primary.mp} • ${p.camera.primary.pixelSize} • ${p.camera.primary.aperture}</span></div>
          <div class="kv"><label>OIS & Lens</label><b>${p.camera.primary.ois}</b><span>${p.camera.primary.lens||'—'} • ${p.camera.primary.focal} • ${p.camera.primary.video||''}</span></div>
          <div class="kv"><label>Ultrawide</label><b>${p.camera.ultrawide ? p.camera.ultrawide.sensor+' • '+p.camera.ultrawide.mp+' • '+p.camera.ultrawide.aperture : '—'}</b><span>${p.camera.ultrawide?.focal||''} ${p.camera.ultrawide?.fov||''}</span></div>
          <div class="kv"><label>Telephoto 1</label><b>${p.camera.tele1 ? p.camera.tele1.sensor+' • '+p.camera.tele1.zoom+' • '+p.camera.tele1.aperture : '— No Tele'}</b><span>${p.camera.tele1?.ois||''}</span></div>
          <div class="kv"><label>Telephoto 2 / Periscope</label><b>${p.camera.tele2 ? p.camera.tele2.sensor+' • '+p.camera.tele2.zoom : '—'}</b><span>${p.camera.tele2?.aperture||''}</span></div>
          <div class="kv"><label>Front + ISP</label><b>${p.camera.front.sensor} ${p.camera.front.aperture}</b><span>${p.camera.isp}</span></div>
        </div>
        <div class="badge-row"><span class="micro-badge accent">${p.camera.primary.size}</span><span class="micro-badge">${p.camera.maxBitrate}</span><span class="micro-badge ${p.camera.raw?'success':''}">${p.camera.raw?'RAW ✓':'No RAW'}</span></div>
      `)}
      ${boxHTML('Audio & Haptics', '🔊', `
        <div class="box-grid">
          <div class="kv"><label>DAC / Amp</label><b>${p.audio.dac}</b></div>
          <div class="kv"><label>Speakers</label><b>${p.audio.speakers}</b></div>
          <div class="kv"><label>Haptics</label><b>${p.audio.haptics}</b></div>
          <div class="kv"><label>Audio Codecs</label><b>${p.audio.codec}</b><span>${p.audio.mics}</span></div>
        </div>
      `)}
      ${boxHTML('Connectivity & Bands', '📡', `
        <div class="box-grid">
          <div class="kv"><label>5G Bands (SA/NSA)</label><b style="font-size:11px;line-height:1.4">${p.connectivity.bands5G}</b><span>${p.connectivity.ca}</span></div>
          <div class="kv"><label>Wi-Fi & BT</label><b>${p.connectivity.wifi}</b><span>${p.connectivity.bt}</span></div>
          <div class="kv"><label>UWB / NFC / IR</label><b>${p.connectivity.uwb?'UWB ✓':'UWB ✗'} • ${p.connectivity.nfc?'NFC ✓':'NFC ✗'} • ${p.connectivity.ir?'IR Blaster ✓':'IR ✗'}</b><span>${p.connectivity.sim}</span></div>
        </div>
        <div class="badge-row"><span class="micro-badge">${p.connectivity.wifi.split(' ')[0]} ${p.connectivity.wifi.split(' ')[1]||''}</span><span class="micro-badge accent">${p.connectivity.bt.split(' ')[0]} ${p.connectivity.bt.split(' ')[1]||''}</span><span class="micro-badge">${p.networkScore}/100 Net Score</span></div>
      `)}
      ${boxHTML('Battery & Charging', '🔋', `
        <div class="box-grid">
          <div class="kv"><label>Capacity & Chemistry</label><b>${p.battery.capacity} mAh • ${p.battery.chemistry}</b></div>
          <div class="kv"><label>Wired Charging</label><b>${p.battery.wired}</b><span>${p.battery.chargingIC}</span></div>
          <div class="kv"><label>Wireless & Reverse</label><b>${p.battery.wireless}</b><span>${p.battery.reverseOTG}</span></div>
          <div class="kv"><label>Endurance & Cycles</label><b>${p.battery.endurance}</b><span>${p.battery.cycles}</span></div>
        </div>
      `)}
      ${boxHTML('Software & Support', '⬢', `
        <div class="box-grid">
          <div class="kv"><label>Launch OS</label><b>${p.software.launchOS}</b></div>
          <div class="kv"><label>Update Commitment</label><b>${p.software.updates}</b></div>
          <div class="kv"><label>Bootloader</label><b>${p.software.bootloader}</b><span>${p.software.treble}</span></div>
          <div class="kv"><label>Community</label><b>${p.software.romRank}</b></div>
        </div>
      `)}
      ${boxHTML('Repairability & SAR', '🔧', `
        <div class="box-grid">
          <div class="kv"><label>iFixit Score</label><b style="font-size:18px">${p.repairability.ifixit}</b><span>${p.repairability.modular}</span></div>
          <div class="kv"><label>Weight & Thickness</label><b>${p.repairability.weight} • ${p.repairability.thickness}</b><span>${p.repairability.material}</span></div>
          <div class="kv"><label>SAR EU Head / Body</label><b>${p.repairability.sarHeadEU} / ${p.repairability.sarBodyEU}</b></div>
          <div class="kv"><label>SAR US Head</label><b>${p.repairability.sarHeadUS}</b></div>
        </div>
      `)}
      <div class="box">
        <div class="box-head"><h4><span class="icon">📊</span> Benchmarks & Scores</h4></div>
        <div class="box-body">
          <div class="kpi-row">
            <div class="kpi"><b>${p.benchmarks.antutu.toLocaleString()}</b><span>AnTuTu</span></div>
            <div class="kpi"><b>${p.benchmarks.geekbenchSingle}</b><span>Geekbench Single</span></div>
            <div class="kpi"><b>${p.benchmarks.geekbenchMulti}</b><span>Geekbench Multi</span></div>
            <div class="kpi"><b>${p.benchmarks.g3DMark}</b><span>3DMark</span></div>
          </div>
          <div class="kpi-row" style="margin-top:8px">
            <div class="kpi"><b>${p.networkScore}</b><span>Network</span></div>
            <div class="kpi"><b>${p.cameraScore}</b><span>Camera</span></div>
            <div class="kpi"><b>${p.displayScore}</b><span>Display</span></div>
            <div class="kpi"><b style="color:var(--success)">★ ${(p.cameraScore*0.3+p.displayScore*0.3+p.networkScore*0.2+p.benchmarks.antutu/25000*0.2).toFixed(1)}</b><span>Aether Score</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
  // attach box collapsible
  root.querySelectorAll('.box').forEach(box=>{
    const head=box.querySelector('.box-head');
    if(head) head.addEventListener('click', ()=> box.classList.toggle('collapsed'));
  });
  root.querySelector('#detailBack').addEventListener('click', ()=> showView('catalog'));
  root.querySelector('#detailFav').addEventListener('click', async ()=>{
    await toggleFavorite(id);
    toast('♡ Vault updated');
    openDetail(id);
  });
  root.querySelector('#detailCompare').addEventListener('click', async ()=>{
    try{ await toggleCompare(id); toast('⚖ Compare Lab updated'); updateCompareUI(); }catch{ toast('Max 4 — clear one in Compare Lab'); }
  });
}
function boxHTML(title, icon, body, open=false){
  return `<div class="box ${open?'':'collapsed'}">
    <div class="box-head"><h4><span class="icon">${icon}</span> ${title}</h4><div class="toggle">⌃</div></div>
    <div class="box-body">${body}</div>
  </div>`;
}

// ---------- Compare ----------
async function updateCompareUI(){
  const ids=await getCompareIds();
  document.getElementById('compareCount').textContent=ids.length;
  document.getElementById('stickyCount').textContent=ids.length;
  const bar=document.getElementById('stickyCompareBar');
  const tray=document.getElementById('stickyTray');
  if(ids.length>0){
    bar.style.display='flex';
    tray.innerHTML=ids.map(id=>{
      const p=allPhones.find(x=>x.id===id);
      return `<div class="compare-thumb"><img src="${p.image}"><button data-remove="${id}">✕</button></div>`;
    }).join('');
    tray.querySelectorAll('[data-remove]').forEach(b=> b.addEventListener('click', async ()=>{
      await toggleCompare(b.dataset.remove); updateCompareUI(); renderCompare();
    }));
  } else bar.style.display='none';
}
document.getElementById('stickyGoCompare').addEventListener('click', ()=> showView('compare'));
document.getElementById('clearCompare').addEventListener('click', async ()=>{ await clearCompare(); updateCompareUI(); renderCompare(); toast('Compare lab cleared');});
async function renderCompare(){
  const ids=await getCompareIds();
  const empty=document.getElementById('compareEmpty');
  const content=document.getElementById('compareContent');
  if(ids.length===0){ empty.style.display='block'; content.style.display='none'; return; }
  empty.style.display='none'; content.style.display='block';
  const phonesSel = ids.map(id=> allPhones.find(p=>p.id===id));
  // Matrix
  const rows=[
    {label:'Device', get:p=>`${p.brand} ${p.model}`},
    {label:'Image', get:p=>`<img src="${p.image}" style="width:64px;height:48px;object-fit:cover;border-radius:10px">`},
    {label:'Price (USD)', get:p=>`$${p.price.usd}`},
    {label:'Display', get:p=>`${p.display.size}" ${p.display.type.split(' ')[0]} • ${p.display.brightness.peak1} nits • ${p.display.pwm}`},
    {label:'Chipset', get:p=>p.soc.chipset},
    {label:'Node', get:p=>p.soc.node},
    {label:'RAM / Storage', get:p=>`${p.soc.ram} / ${p.soc.storage.split('/')[0]}`},
    {label:'Primary Camera', get:p=>`${p.camera.primary.mp} ${p.camera.primary.sensor} (${p.camera.primary.size})`},
    {label:'Telephoto', get:p=> p.camera.tele2 ? `${p.camera.tele2.zoom} ${p.camera.tele2.mp}` : (p.camera.tele1 ? `${p.camera.tele1.zoom}` : '—')},
    {label:'Battery', get:p=>`${p.battery.capacity} mAh • ${p.battery.wired.split(' ')[0]}`},
    {label:'Charging', get:p=>p.battery.wired},
    {label:'Weight', get:p=>p.repairability.weight},
    {label:'AnTuTu', get:p=>p.benchmarks.antutu.toLocaleString()},
    {label:'Geekbench (S/M)', get:p=>`${p.benchmarks.geekbenchSingle} / ${p.benchmarks.geekbenchMulti}`},
    {label:'iFixit', get:p=>p.repairability.ifixit},
  ];
  const highlight=document.getElementById('highlightDiff').checked;
  const showWinner=document.getElementById('showWinner').checked;
  let html=`<table class="compare-table"><thead><tr><th>Spec</th>${phonesSel.map(p=>`<th>${p.brand}<br><span style="font-weight:800;color:var(--text);text-transform:none;letter-spacing:-0.02em">${p.model}</span><br><button data-rm="${p.id}" style="margin-top:6px;font-size:10px;padding:4px 8px;border-radius:999px;border:1px solid var(--border);background:var(--bg-3);cursor:pointer">✕ Remove</button></th>`).join('')}</tr></thead><tbody>`;
  rows.forEach(r=>{
    const vals=phonesSel.map(p=> r.get(p));
    const allSame = vals.every(v=> v===vals[0]);
    // winner detection for numeric rows
    let winnerIdx=-1;
    if(showWinner && ['AnTuTu','Price (USD)','Battery'].includes(r.label)){
      const nums=phonesSel.map(p=>{
        if(r.label==='AnTuTu') return p.benchmarks.antutu;
        if(r.label==='Price (USD)') return -p.price.usd; // lower is winner
        if(r.label==='Battery') return p.battery.capacity;
      });
      winnerIdx = nums.indexOf(Math.max(...nums));
    }
    html+=`<tr><th>${r.label}</th>${vals.map((v,i)=>{
      let cls='';
      if(highlight && !allSame) cls='diff';
      if(winnerIdx===i) cls='winner';
      return `<td class="${cls}">${v}</td>`;
    }).join('')}</tr>`;
  });
  html+=`</tbody></table>`;
  document.getElementById('compareMatrix').innerHTML=html;
  document.getElementById('compareMatrix').querySelectorAll('[data-rm]').forEach(b=> b.addEventListener('click', async ()=>{ await toggleCompare(b.dataset.rm); updateCompareUI(); renderCompare();}));

  // custom weighted scores
  const wP=parseInt(document.getElementById('wPerf').value);
  const wC=parseInt(document.getElementById('wCam').value);
  const wB=parseInt(document.getElementById('wBatt').value);
  const wD=parseInt(document.getElementById('wDisp').value);
  const total=wP+wC+wB+wD || 1;
  const scores=phonesSel.map(p=>{
    const perf = p.benchmarks.antutu/22000; // normalize ~100
    const cam = p.cameraScore;
    const batt = Math.min(100, p.battery.capacity/55);
    const disp = p.displayScore;
    const weighted = (perf*(wP/total) + cam*(wC/total) + batt*(wB/total) + disp*(wD/total)).toFixed(1);
    return {p, weighted, perf:perf.toFixed(0), cam, batt:batt.toFixed(0), disp};
  }).sort((a,b)=> b.weighted-a.weighted);
  document.getElementById('compareScores').innerHTML=`<div class="box"><div class="box-head"><h4>Custom Weighted — Editor’s Pick</h4><span class="micro-badge accent">${scores[0].p.model} — Pick</span></div><div class="box-body"><div class="kpi-row">${scores.map((s,i)=>`<div class="kpi" style="${i===0?'border-color:var(--terrac);background:var(--terrac-light)':''}"><b>${s.weighted}</b><span>${s.p.model} ${i===0?'— pick':''}</span><div style="font-size:10px;color:var(--muted);margin-top:4px">P${s.perf} • C${s.cam} • B${s.batt} • D${s.disp}</div></div>`).join('')}</div></div></div>`;

}
['highlightDiff','showWinner','wPerf','wCam','wBatt','wDisp'].forEach(id=>{
  const el=document.getElementById(id);
  if(!el) return;
  el.addEventListener('input', ()=>{
    ['wPerf','wCam','wBatt','wDisp'].forEach(k=>{
      const v=document.getElementById(k)?.value;
      if(v) document.getElementById(k+'Val').textContent=v+'%';
    });
    renderCompare();
  });
  el.addEventListener('change', renderCompare);
});

// ---------- Tools: Radar ----------
let radarChart=null;
function initRadar(){
  const ctx=document.getElementById('radarCanvas');
  const aSel=document.getElementById('radarA');
  const bSel=document.getElementById('radarB');
  function draw(){
    const a = allPhones.find(p=>p.id===aSel.value);
    const b = allPhones.find(p=>p.id===bSel.value);
    if(!a||!b) return;
    const norm = p => ({
      perf: Math.round(p.benchmarks.antutu/22000),
      geek: Math.round(p.benchmarks.geekbenchSingle/30),
      gpu: Math.round(p.benchmarks.g3DMark/55),
      eff: Math.round(Math.max(0, 100 - p.benchmarks.batteryDrain*8)),
      cam: p.cameraScore,
      disp: p.displayScore
    });
    const na=norm(a), nb=norm(b);
    if(radarChart) radarChart.destroy();
    radarChart=new Chart(ctx, {
      type:'radar',
      data:{
        labels:['AnTuTu','Geekbench','3DMark','Efficiency (inv drain)','Camera','Display'],
        datasets:[
          {label:a.model, data:[na.perf,na.geek,na.gpu,na.eff,na.cam,na.disp], borderColor:'#1B1B1F', backgroundColor:'rgba(27,27,31,0.10)', pointBackgroundColor:'#1B1B1F', borderWidth:2},
          {label:b.model, data:[nb.perf,nb.geek,nb.gpu,nb.eff,nb.cam,nb.disp], borderColor:'#C25A3A', backgroundColor:'rgba(194,90,58,0.14)', pointBackgroundColor:'#C25A3A', borderWidth:2}
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ r:{ min:0, max:100, ticks:{display:false, stepSize:20}, grid:{color:'#E8DDC9'}, angleLines:{color:'#E8DDC9'}, pointLabels:{color:'#6B6B7A', font:{family:'IBM Plex Mono', size:10, weight:'600'}} } },
        plugins:{ legend:{labels:{color:'#1B1B1F', font:{family:'IBM Plex Mono', size:11, weight:'700'}, usePointStyle:true, boxWidth:10}}}
      }
    });
    document.getElementById('radarKpi').innerHTML=`
      <div class="kpi"><b>${a.benchmarks.antutu.toLocaleString()}</b><span>${a.model} AnTuTu</span></div>
      <div class="kpi"><b>${b.benchmarks.antutu.toLocaleString()}</b><span>${b.model} AnTuTu</span></div>
      <div class="kpi"><b style="color:${a.benchmarks.batteryDrain < b.benchmarks.batteryDrain ? 'var(--teal)' : 'var(--muted)'}">${a.benchmarks.batteryDrain}W</b><span>${a.model} Drain</span></div>
    `;
  }
  aSel.addEventListener('change', draw); bSel.addEventListener('change', draw);
  draw();
}

// ---------- Tools: Battery Estimator ----------
function calcBattery(){
  const sot=parseInt(document.getElementById('bSot').value);
  const game=parseInt(document.getElementById('bGame').value);
  const stream=parseInt(document.getElementById('bStream').value);
  const devId=document.getElementById('bDevice').value;
  const p=allPhones.find(x=>x.id===devId);
  if(!p) return;
  document.getElementById('bSotVal').textContent=sot+'h';
  document.getElementById('bGameVal').textContent=game+'h';
  document.getElementById('bStreamVal').textContent=stream+'h';
  // model: baseline SoT hours scaled by capacity and efficiency
  const eff = Math.max(0.7, 1.3 - p.benchmarks.batteryDrain/10); // lower drain = higher eff
  const baseActive = (p.battery.capacity/4000)*eff*10; // hours active use
  // usage weighted drain: SoT 1x, game 1.8x, stream 1.2x
  const weightedHours = sot*1 + game*1.8 + stream*1.2;
  const est = (baseActive / Math.max(0.6, weightedHours/8)).toFixed(1);
  const days = (parseFloat(est)/24).toFixed(2);
  document.getElementById('bEst').textContent=est+'h';
  document.getElementById('bDays').textContent=days+' days';
  document.getElementById('bCycles').textContent=p.battery.cycles.split(' ')[0];
}
['bSot','bGame','bStream','bDevice'].forEach(id=> document.getElementById(id).addEventListener('input', calcBattery));
calcBattery();

// ---------- Tools: Sensor Visualizer ----------
const sensorSizes={
  "1/0.98\"": {w:12.8,h:9.6, label:"1\" 12.8×9.6mm"},
  "1/1.28\"":{w:9.8,h:7.3, label:"1/1.28\" 9.8×7.3mm"},
  "1/1.3\"":{w:9.6,h:7.2, label:"1/1.3\" 9.6×7.2mm"},
  "1/1.31\"":{w:9.6,h:7.2, label:"1/1.31\""},
  "1/1.4\"":{w:8.8,h:6.6, label:"1/1.4\""},
  "1/1.56\"":{w:7.5,h:5.6, label:"1/1.56\""},
  "1/2\"":{w:6.4,h:4.8, label:"1/2\""},
  "1/2.55\"":{w:5.1,h:3.8, label:"1/2.55\""},
  "1/3.06\"":{w:4.2,h:3.1, label:"1/3.06\""},
  "1/3.94\"":{w:3.4,h:2.5, label:"1/3.94\""},
  "1/5\"":{w:2.6,h:1.95, label:"1/5\""}
};
function sensorKey(p){
  // try to extract normalized key
  const s=p.camera.primary.size;
  if(sensorSizes[s]) return s;
  if(s.includes("1-inch") || s.includes("1/0.98")) return "1/0.98\"";
  if(s.includes("1/1.28")) return "1/1.28\"";
  if(s.includes("1/1.31")) return "1/1.31\"";
  return "1/1.56\"";
}
function drawSensors(){
  const aId=document.getElementById('sensorA').value;
  const bId=document.getElementById('sensorB').value;
  const pa=allPhones.find(p=>p.id===aId);
  const pb=allPhones.find(p=>p.id===bId);
  const svg=document.getElementById('sensorSvg');
  const kpi=document.getElementById('sensorKpi');
  const aSize=sensorSizes[sensorKey(pa)]||sensorSizes["1/1.56\""];
  const bSize=sensorSizes[sensorKey(pb)]||sensorSizes["1/1.56\""];
  // reference full-frame 36x24mm scale factor: fit 36mm to 360px width => 10px per mm
  const scale=9; // 36mm => 324px
  const cx=200, cy=130;
  const refW=36*scale, refH=24*scale;
  const aW=aSize.w*scale, aH=aSize.h*scale;
  const bW=bSize.w*scale, bH=bSize.h*scale;
  svg.innerHTML=`
    <rect x="${cx-refW/2}" y="${cy-refH/2}" width="${refW}" height="${refH}" rx="8" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" stroke-dasharray="6 6"/>
    <text x="${cx}" y="${cy-refH/2-10}" text-anchor="middle" fill="#6b7280" font-size="10" font-weight="800" letter-spacing="0.06em">FULL-FRAME 36×24mm REFERENCE</text>
    <rect x="${cx-bW/2}" y="${cy-bH/2}" width="${bW}" height="${bH}" rx="6" fill="rgba(194,90,58,0.14)" stroke="#C25A3A" stroke-width="2"/>
    <text x="${cx}" y="${cy+bH/2+14}" text-anchor="middle" fill="#C25A3A" font-size="11" font-weight="800">${pb.model.split(' ').slice(-2).join(' ')} • ${pb.camera.primary.size}</text>
    <rect x="${cx-aW/2}" y="${cy-aH/2}" width="${aW}" height="${aH}" rx="6" fill="rgba(27,27,31,0.12)" stroke="#1B1B1F" stroke-width="2.5"/>
    <text x="${cx}" y="${cy-aH/2-8}" text-anchor="middle" fill="#1B1B1F" font-size="11" font-weight="900">${pa.model.split(' ').slice(-2).join(' ')} • ${pa.camera.primary.size} • ${aSize.w}×${aSize.h}mm</text>
    <line x1="${cx-aW/2}" y1="${cy+aH/2+2}" x2="${cx+aW/2}" y2="${cy+aH/2+2}" stroke="#1B1B1F" stroke-width="1.2" marker-end="url(#arrow)"/>
  `;
  const areaA=(aSize.w*aSize.h).toFixed(1);
  const areaB=(bSize.w*bSize.h).toFixed(1);
  const ratio=(areaA/areaB).toFixed(2);
  kpi.innerHTML=`
    <div class="kpi"><b>${areaA} mm²</b><span>${pa.model} Area</span></div>
    <div class="kpi"><b>${areaB} mm²</b><span>${pb.model} Area</span></div>
    <div class="kpi"><b style="color:var(--accent)">${ratio}×</b><span>Larger</span></div>
  `;
}
function initSensors(){
  const selA=document.getElementById('sensorA');
  const selB=document.getElementById('sensorB');
  // populate
  selA.innerHTML=allPhones.map(p=>`<option value="${p.id}">${p.model} • ${p.camera.primary.size}</option>`).join('');
  selB.innerHTML=allPhones.map(p=>`<option value="${p.id}">${p.model} • ${p.camera.primary.size}</option>`).join('');
  selA.value='xiaomi-14-ultra'; selB.value='iphone-15-pro-max';
  selA.addEventListener('change', drawSensors); selB.addEventListener('change', drawSensors);
  drawSensors();
}

// ---------- Tools: Value Calculator ----------
function initValueCalc(){
  const budget=document.getElementById('budget');
  const list=document.getElementById('valueList');
  function render(){
    const b=parseInt(budget.value);
    document.getElementById('budgetVal').textContent='$'+b;
    const eligible=allPhones.filter(p=>p.price.usd <= b);
    const scored=eligible.map(p=>{
      const perfPerDollar=(p.benchmarks.antutu / p.price.usd);
      const weighted = (p.cameraScore*0.25 + p.displayScore*0.25 + p.networkScore*0.15 + Math.min(100, p.benchmarks.antutu/18000)*0.35);
      const valueScore = (perfPerDollar/2000*40 + weighted*0.6).toFixed(1);
      return {p, perfPerDollar: Math.round(perfPerDollar), weighted, valueScore};
    }).sort((a,b)=> b.valueScore-a.valueScore);
    if(scored.length===0) list.innerHTML='<div class="empty" style="padding:12px"><b>No devices in budget</b></div>';
    else list.innerHTML=scored.slice(0,5).map((s,i)=>`
      <div class="list-row" style="${i===0?'border-color:var(--ink);background:var(--paper-2)':''}">
        <img src="${s.p.image}" />
        <div style="flex:1">
          <b style="font-size:13px">${i===0?'👑 ':''}${s.p.brand} ${s.p.model} ${i===0?'<span class="micro-badge success" style="margin-left:6px">Best Value</span>':''}</b>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">$${s.p.price.usd} • AnTuTu ${s.p.benchmarks.antutu.toLocaleString()} • ${s.perfPerDollar} pts/$ • Score ${s.weighted.toFixed(0)}</div>
          <div style="margin-top:6px;display:flex;gap:6px"><span class="micro-badge ${i===0?'success':''}">Value ${s.valueScore}</span><span class="micro-badge">${s.p.camera.primary.mp}</span></div>
        </div>
        <button class="btn btn-ghost" style="padding:8px 10px;font-size:12px" data-view="${s.p.id}">View →</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-view]').forEach(btn=> btn.addEventListener('click', ()=> openDetail(btn.getAttribute('data-view'))));
  }
  budget.addEventListener('input', render);
  render();
}

// ---------- Vault ----------
async function refreshVault(){
  const favs=await getFavorites();
  document.getElementById('vaultCount').textContent=`${favs.length} saved`;
  const body=document.getElementById('vaultBody');
  if(favs.length===0){
    body.innerHTML=`<div class="empty"><div class="emoji">♡</div><b>No favorites yet</b><p>Tap ♡ on any device to save offline in IndexedDB. Survives airplane mode.</p></div>`;
    return;
  }
  body.innerHTML=favs.map(p=>`
    <div class="list-row" style="margin-bottom:8px">
      <img src="${p.image}" />
      <div style="flex:1">
        <b style="font-size:13px">${p.brand} ${p.model}</b><div style="font-size:11px;color:var(--muted)">${p.soc.chipset} • ${p.battery.capacity}mAh</div>
      </div>
      <button class="btn btn-ghost" data-open="${p.id}" style="padding:8px 10px;font-size:12px">Open →</button>
      <button class="btn btn-ghost" data-unfav="${p.id}" style="padding:8px 10px">✕</button>
    </div>
  `).join('');
  body.querySelectorAll('[data-open]').forEach(b=> b.addEventListener('click', ()=> openDetail(b.dataset.open)));
  body.querySelectorAll('[data-unfav]').forEach(b=> b.addEventListener('click', async ()=>{ await toggleFavorite(b.dataset.unfav); refreshVault(); toast('Removed from Vault');}));
}
document.getElementById('exportVault').addEventListener('click', async ()=>{
  const favs=await getFavorites();
  const blob=new Blob([JSON.stringify(favs,null,2)], {type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='aetherphone-vault.json'; a.click(); URL.revokeObjectURL(url);
  toast('Exported vault JSON');
});
document.getElementById('clearVault').addEventListener('click', async ()=>{
  await db.favorites.clear(); refreshVault(); toast('Vault cleared');
});

// ---------- Simulate New Device Delta ----------
document.getElementById('btnSync').addEventListener('click', async ()=>{
  toast('↻ Syncing… Background Fetch fetching deltas');
  document.getElementById('swStatus').textContent='Syncing… fetching GSMArena delta 12KB';
  setTimeout(()=>{ document.getElementById('swStatus').textContent='Up to date ✓ — '+allPhones.length+' devices cached'; toast('✓ Catalog is fresh — offline ready');},1200);
});
document.getElementById('btnAddMock').addEventListener('click', async ()=>{
  const mock={
    id:'aether-mock-'+Date.now(),
    brand:'Aether', model:'Concept X1 (Simulated Delta)', aka:'AETHER-X1',
    released:new Date().toISOString().slice(0,10), status:'Concept — Ingested via Daemon',
    image:'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80',
    heroColor:'#1a1030', price:{usd:1499, eur:1599, pkr:499999, segment:'Concept'},
    highlights:['Aether Ingestion Test','Delta Sync OK'],
    display:{size:6.9,type:'LTPO Quad-Curved',panelManufacturer:'Samsung E8',substrate:'LTPO 1-144Hz M14',subpixel:'Diamond PenTile',resolution:'3200x1440',ppi:520,refresh:'1-144Hz',touchSampling:'720Hz',pwm:'3840Hz',brightness:{peak1:3200,sustained100:1800,hbm:2200},hdr:'HDR10+',protection:'Gorilla Armor 2',extra:'Simulated'},
    soc:{chipset:'Snapdragon 8 Gen 4 (Sim)',revision:'SM8750',node:'3nm TSMC N3P',cpu:'1x X5 3.9GHz + 5x A730 +2x A520',gpu:'Adreno 830',npu:'Hexagon 50 TOPS',ram:'16GB LPDDR5X',storage:'512GB UFS 4.0',cooling:'Vapor Chamber 18000mm²',coolingLayers:'4-layer',throttling:'95% sustained'},
    camera:{primary:{sensor:'Sony LYT-900 50MP',size:'1/0.98"',mp:'50MP',pixelSize:'1.6µm',aperture:'f/1.5',focal:'23mm',ois:'Gimbal OIS',lens:'8P',video:'8K60'},ultrawide:{sensor:'IMX858 50MP',size:'1/2.51"',mp:'50MP',aperture:'f/1.8',focal:'12mm'},tele1:{sensor:'IMX858 50MP',size:'1/2.51"',mp:'50MP',aperture:'f/2.4',zoom:'3x',ois:'OIS'},tele2:null,front:{sensor:'32MP',aperture:'f/2.0',af:'AF',video:'4K60'},isp:'Spectra + Daemon',maxBitrate:'150 Mbps',raw:true},
    audio:{dac:'ESS Sabre',speakers:'Quad Dolby Atmos',haptics:'X-Axis 7cc',mics:'4x',codec:'LHDC 5.0'},
    connectivity:{bands5G:'n1/n3/n7/n28/n77/n78/n79 + 6G test',ca:'6CA',wifi:'Wi-Fi 7',bt:'5.4 + UWB + NFC + IR',uwb:true,nfc:true,ir:true,sim:'Dual Nano+eSIM'},
    battery:{capacity:6000,chemistry:'Silicon-Carbon Gen3',wired:'120W Surge 3.0',wireless:'50W + 10W Reverse',chargingIC:'Surge P3',endurance:'16:00h',cycles:'80% after 2000 cycles',reverseOTG:'10W Reverse'},
    software:{launchOS:'Android 15 + AetherOS',updates:'7 OS + 7 Security',bootloader:'Unlockable',treble:'A/B',romRank:'#1 Concept'},
    repairability:{ifixit:'6/10',modular:'High',sarHeadEU:'0.55 W/kg',sarBodyEU:'1.10 W/kg',sarHeadUS:'0.80 W/kg',weight:'218g',thickness:'8.7mm',material:'Titanium + Ceramic'},
    benchmarks:{antutu:2800000,geekbenchSingle:3200,geekbenchMulti:9800,g3DMark:6200,batteryDrain:5.0},
    networkScore:99,cameraScore:98,displayScore:99
  };
  await db.phones.put(mock);
  allPhones.push(mock);
  // update fuse
  fuse = new Fuse(allPhones, {keys:[{name:'brand',weight:0.9},{name:'model',weight:1},{name:'aka',weight:0.6},{name:'highlights',weight:0.7},{name:'display.type',weight:0.4},{name:'soc.chipset',weight:0.6},{name:'camera.primary.sensor',weight:0.5},{name:'price.segment',weight:0.3},{name:'status',weight:0.3}], threshold:0.35, ignoreLocation:true, includeScore:true});
  document.getElementById('countPill').textContent=`${allPhones.length} Devices`;
  document.getElementById('statDevices').textContent=allPhones.length;
  toast('＋ Daemon ingested 1 new device — WebP queued for offline');
  renderCatalog();
});

// offline-pill background
updateOfflinePill();
