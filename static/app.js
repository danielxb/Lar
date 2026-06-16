// Page routing
let currentPage = 'home';

function initNav() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPage = tab.dataset.page;
      renderPage();
    });
  });
}

function renderPage() {
  const content = document.getElementById('page-content');
  if (currentPage === 'home') {
    content.innerHTML = `<div id="home-page"></div>`;
    document.getElementById('addBtn').style.display = 'none';
    document.getElementById('nav').style.display = 'none';
    document.getElementById('footer').style.display = 'none';
    renderHomePage();
  } else if (currentPage === 'finance') {
    document.getElementById('nav').style.display = 'none';
    document.getElementById('footer').style.display = '';
    const ft = state.tab === 'settings' ? 'settings' : (state.tab === 'overview' ? 'overview' : (state.tab === 'income' ? 'income' : 'finance'));
    content.innerHTML = `
      <button class="back-home-btn" id="backHome">🏠</button>
      <div class="tabs" style="margin-top:.5rem">
        <div class="tab ${ft==='overview'?'active':''}" data-tab="overview">Overview</div>
        <div class="tab ${ft==='finance'?'active':''}" data-tab="finance">Expenses</div>
        <div class="tab ${ft==='income'?'active':''}" data-tab="income">Income</div>
        <div class="tab ${ft==='settings'?'active':''}" data-tab="settings">Settings</div>
      </div>
      <div id="finance-overview" style="display:${ft==='overview'?'block':'none'}"></div>
      <div id="finance-income" style="display:${ft==='income'?'block':'none'}"></div>
      <div id="finance-settings" style="display:${ft==='settings'?'block':'none'}"><div id="settings-page"></div></div>
      <div id="finance-detail" style="display:${ft==='finance'?'block':'none'}">
        <div class="overview" id="overview"></div>
        <div class="tabs sub-tabs">
          <div class="tab ${state.tab==='week'?'active':''}" data-subtab="week">Weekly</div>
          <div class="tab ${state.tab==='month'?'active':''}" data-subtab="month">Monthly</div>
          <div class="tab ${state.tab==='year'?'active':''}" data-subtab="year">Annual</div>
        </div>
        <div class="controls" id="controls"></div>
        <div id="view"></div>
        <div class="chart-container" id="chart-container"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem"><div class="filter-pills"><span class="pill ${state.mode==='balance'?'active':''}" data-mode="balance">All</span><span class="pill ${state.mode==='expense'?'active':''}" data-mode="expense">Expenses</span></div><div class="toggle-group"><button class="toggle-btn chart-type-btn ${state.chartType==='bar'?'active':''}" data-chart="bar">Bars</button><button class="toggle-btn chart-type-btn ${state.chartType==='line'?'active':''}" data-chart="line">Line</button></div></div><canvas id="chart"></canvas></div>
        <div id="transactions"></div>
        <div id="analysis-charts"></div>
        <div id="analysis"></div>
        <section class="savings" id="savings-section"></section>
      </div>`;
    document.getElementById('addBtn').style.display = '';
    initFinanceTabs();
    fetch('/api/recurring/apply', {method:'POST'});
    if (ft === 'overview') { renderFinanceOverview(); } else if (ft === 'settings') { renderSettings(); } else if (ft === 'income') { renderIncomeTab(); } else { render(); }
  } else if (currentPage === 'work') {
    document.getElementById('nav').style.display = 'none';
    document.getElementById('footer').style.display = '';
    content.innerHTML = `<button class="back-home-btn" id="backHome">🏠</button><div id="work-page"></div>`;
    document.getElementById('addBtn').style.display = '';
    renderWorkPage();
  } else if (currentPage === 'shopping') {
    document.getElementById('nav').style.display = 'none';
    document.getElementById('footer').style.display = '';
    content.innerHTML = `<button class="back-home-btn" id="backHome">🏠</button><div id="shopping-page"></div>`;
    document.getElementById('addBtn').style.display = 'none';
    renderShoppingPage();
  }
  // Wire back-to-home button
  const backBtn = document.getElementById('backHome');
  if (backBtn) backBtn.addEventListener('click', () => { currentPage = 'home'; renderPage(); });
}

function initFinanceTabs() {
  // Top-level tabs: Overview | Finance | Settings
  document.querySelectorAll('.tabs:not(.sub-tabs) .tab[data-tab]').forEach(t => {
    t.addEventListener('click', () => {
      const tab = t.dataset.tab;
      document.querySelectorAll('.tabs:not(.sub-tabs) .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const fo = document.getElementById('finance-overview');
      const fd = document.getElementById('finance-detail');
      const fs = document.getElementById('finance-settings');
      const fi = document.getElementById('finance-income');
      if (tab === 'overview') {
        state.tab = 'overview';
        fo.style.display = 'block'; fd.style.display = 'none'; fs.style.display = 'none'; fi.style.display = 'none';
        renderFinanceOverview();
      } else if (tab === 'settings') {
        state.tab = 'settings';
        fo.style.display = 'none'; fd.style.display = 'none'; fs.style.display = 'block'; fi.style.display = 'none';
        renderSettings();
      } else if (tab === 'income') {
        state.tab = 'income';
        fo.style.display = 'none'; fd.style.display = 'none'; fs.style.display = 'none'; fi.style.display = 'block';
        renderIncomeTab();
      } else {
        if (!['week','month','year'].includes(state.tab)) state.tab = 'week';
        fo.style.display = 'none'; fd.style.display = 'block'; fs.style.display = 'none'; fi.style.display = 'none';
        render();
      }
    });
  });
  // Sub-tabs: Weekly | Monthly | Annual
  document.querySelectorAll('.sub-tabs .tab[data-subtab]').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.sub-tabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      state.tab = t.dataset.subtab;
      render();
    });
  });
  document.querySelectorAll('.chart-type-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.chart-type-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.chartType = b.dataset.chart;
      render();
    });
  });
  document.querySelectorAll('.chart-container .pill[data-mode]').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.chart-container .pill[data-mode]').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      state.mode = p.dataset.mode;
      render();
    });
  });
}

const API='/api';
let state={tab:'overview',mode:'balance',date:new Date(),txFilter:'all',analysisTab:'categories',person:'all',search:'',chartType:'bar',nwAudOnly:true};

const fmt=(n)=>(n<0?'-':'')+' $'+Math.abs(n).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2});
const isoDate=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(dateStr){
  if(!dateStr)return '';
  const parts=dateStr.split('-');
  if(parts.length<3)return dateStr;
  const d=parseInt(parts[2]),m=parseInt(parts[1])-1,y=parts[0];
  return `${d} ${MONTHS[m]} ${y}`;
}

function weekStart(d){const s=new Date(d);s.setDate(s.getDate()-s.getDay());s.setHours(0,0,0,0);return s}
function weekEnd(d){const e=new Date(weekStart(d));e.setDate(e.getDate()+7);return e}
function monthStart(d){return new Date(d.getFullYear(),d.getMonth(),1)}
function monthEnd(d){return new Date(d.getFullYear(),d.getMonth()+1,1)}
function yearStart(d){return new Date(d.getFullYear(),0,1)}
function yearEnd(d){return new Date(d.getFullYear()+1,0,1)}

async function fetchJSON(url){const r=await fetch(url);if(!r.ok)throw new Error(r.status);return r.json()}
async function getSummary(s,e){return fetchJSON(`${API}/summary?start=${s}&end=${e}&person=${state.person}`)}
async function getDaily(s,e){return fetchJSON(`${API}/daily?start=${s}&end=${e}&person=${state.person}`)}
async function getPurchases(s,e){return fetchJSON(`${API}/purchases?start=${s}&end=${e}&person=${state.person}`)}
async function getSavings(){return fetchJSON(`${API}/savings`)}
async function getRecurring(){return fetchJSON(`${API}/recurring`)}

function getRange(){
  if(state.tab==='week')return[isoDate(weekStart(state.date)),isoDate(weekEnd(state.date))];
  if(state.tab==='month')return[isoDate(monthStart(state.date)),isoDate(monthEnd(state.date))];
  return[isoDate(yearStart(state.date)),isoDate(yearEnd(state.date))];
}

function modeValue(day){
  // Expenses tab: always show expenses only
  return day.expenses||0;
}

function renderOverview(summary){
  document.getElementById('overview').innerHTML=`
    <div class="stat-card"><div class="label">Income</div><div class="value income">${fmt(summary.income)}</div></div>
    <div class="stat-card"><div class="label">Expenses</div><div class="value expense">${fmt(summary.expenses)}</div></div>
    <div class="stat-card"><div class="label">Balance</div><div class="value balance">${fmt(summary.balance)}</div></div>`;
}

function renderControls(){
  const dateVal=isoDate(state.date);
  document.getElementById('controls').innerHTML=`
    <div class="nav-arrows">
      <button id="navPrev">←</button>
      <input type="date" id="datePicker" value="${dateVal}">
      <button id="navNext">→</button>
    </div>
    <div class="toggle-group">
      <button class="toggle-btn ${state.person==='all'?'active':''}" data-person="all">All</button>
      <button class="toggle-btn ${state.person==='person1'?'active':''}" data-person="person1">Person 1</button>
      <button class="toggle-btn ${state.person==='person2'?'active':''}" data-person="person2">Person 2</button>
    </div>
    <button class="export-btn" id="exportBtn">⬇ CSV</button>`;
  document.getElementById('datePicker').addEventListener('change',e=>{state.date=new Date(e.target.value+'T12:00:00');render()});
  document.querySelectorAll('.toggle-btn[data-person]').forEach(b=>b.addEventListener('click',()=>{state.person=b.dataset.person;render()}));
  document.getElementById('navPrev').addEventListener('click',()=>{navStep(-1)});
  document.getElementById('navNext').addEventListener('click',()=>{navStep(1)});
  document.getElementById('exportBtn').addEventListener('click',exportCSV);
}

function navStep(dir){
  const d=state.date;
  if(state.tab==='week')d.setDate(d.getDate()+(dir*7));
  else if(state.tab==='month')d.setMonth(d.getMonth()+dir);
  else d.setFullYear(d.getFullYear()+dir);
  state.date=new Date(d);render();
}

function renderWeek(daily){
  const start=weekStart(state.date),today=isoDate(new Date());
  let h='<div class="calendar">';
  DAYS.forEach(d=>{h+=`<div class="cal-header">${d}</div>`});
  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(d.getDate()+i);
    const key=isoDate(d),val=daily[key]?modeValue(daily[key]):0;
    const cls=key===today?' today':'',amtCls=val>0?'positive':val<0?'negative':'';
    h+=`<div class="cal-day${cls}" data-date="${key}"><div class="day-num">${d.getDate()}</div>${val!==0?`<div class="day-amount ${amtCls}">${fmt(val)}</div>`:''}</div>`;
  }
  h+='</div>';
  document.getElementById('view').innerHTML=h;
}

function renderMonth(daily){
  const start=monthStart(state.date),dim=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
  const firstDay=start.getDay(),today=isoDate(new Date());
  let h='<div class="calendar">';
  DAYS.forEach(d=>{h+=`<div class="cal-header">${d}</div>`});
  for(let i=0;i<firstDay;i++)h+='<div class="cal-day empty"></div>';
  for(let d=1;d<=dim;d++){
    const date=new Date(start.getFullYear(),start.getMonth(),d),key=isoDate(date);
    const val=daily[key]?modeValue(daily[key]):0;
    const cls=key===today?' today':'',amtCls=val>0?'positive':val<0?'negative':'';
    h+=`<div class="cal-day${cls}" data-date="${key}"><div class="day-num">${d}</div>${val!==0?`<div class="day-amount ${amtCls}">${fmt(val)}</div>`:''}</div>`;
  }
  h+='</div>';
  document.getElementById('view').innerHTML=h;
  // Click day -> show that day's expenses
  document.querySelectorAll('.cal-day[data-date]').forEach(el=>el.addEventListener('click',async ()=>{
    const date = el.dataset.date;
    const nextDay = new Date(date+'T12:00:00');
    nextDay.setDate(nextDay.getDate()+1);
    const purchases = await fetchJSON(`${API}/purchases?start=${date}&end=${isoDate(nextDay)}&person=${state.person}`);
    const expenses = purchases.filter(p => p.amount < 0);
    if (!expenses.length) return;
    // Show detail below calendar
    let detail = `<div class="ov-section" style="margin-top:.5rem"><h3>${fmtDate(date)}</h3><div class="ov-list">`;
    expenses.forEach(p => {
      detail += `<div class="ov-list-item"><span>${p.item} <span style="font-size:.6rem;color:var(--text2)">${p.category}</span></span><span style="color:var(--expense)">${fmt(p.amount)}</span></div>`;
    });
    detail += `</div><div style="font-size:.65rem;color:var(--text2);margin-top:.3rem;text-align:right">Total: ${fmt(expenses.reduce((t,p)=>t+p.amount,0))}</div></div>`;
    const existing = document.getElementById('day-detail');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'day-detail';
    div.innerHTML = detail;
    document.getElementById('view').appendChild(div);
  }));
}

function renderYear(daily){
  const year=state.date.getFullYear();
  const months=Array.from({length:12},()=>({income:0,expenses:0}));
  Object.entries(daily).forEach(([date,vals])=>{
    const m=parseInt(date.split('-')[1])-1;
    if(m>=0&&m<12){months[m].income+=vals.income||0;months[m].expenses+=vals.expenses||0}
  });
  let h='<div class="month-grid">';
  months.forEach((m,i)=>{
    const val=m.expenses;
    const color=val>0?'var(--income)':val<0?'var(--expense)':'var(--text2)';
    h+=`<div class="month-card" data-month="${i}"><div class="month-name">${MONTHS[i]}</div><div class="month-amount" style="color:${color}">${val!==0?fmt(val):'—'}</div></div>`;
  });
  h+='</div>';
  document.getElementById('view').innerHTML=h;
  // Click month -> go to monthly view
  document.querySelectorAll('.month-card').forEach(el=>el.addEventListener('click',()=>{
    state.date=new Date(year,parseInt(el.dataset.month),1);state.tab='month';
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelector('[data-tab="month"]').classList.add('active');
    render();
  }));
}

function renderTransactions(purchases){
  if(state.tab==='year'){document.getElementById('transactions').innerHTML='';return}

  // Fetch grouped view
  const[start,end]=getRange();
  fetch(`${API}/purchases/grouped?start=${start}&end=${end}&person=${state.person}`).then(r=>r.json()).then(grouped=>{
    // Expenses tab: always exclude income entries
    let filtered=grouped.filter(p=>(p.amount||p.total||0)<=0);
    if(state.txFilter==='work')filtered=filtered.filter(p=>p.work_related);

    if(state.search){
      const q=state.search.toLowerCase();
      filtered=filtered.filter(p=>(p.item||p.store||'').toLowerCase().includes(q)||(p.category||'').toLowerCase().includes(q));
    }

    let h=`<div class="section-title"><span>Transactions</span><div class="filter-pills">
      <span class="pill ${state.txFilter==='all'?'active':''}" data-f="all">All</span>
      <span class="pill ${state.txFilter==='expenses'?'active':''}" data-f="expenses">Expenses</span>
      <span class="pill ${state.txFilter==='work'?'active':''}" data-f="work">Work</span>
      ${state.txFilter==='work'?'<button class="export-btn" id="taxExportBtn" style="margin-left:auto;font-size:.65rem">⬇ Tax CSV</button>':''}
    </div></div>
    <input class="search-box" id="txSearch" placeholder="Search transactions..." value="${state.search||''}">
    <div class="tx-list">`;

    filtered.forEach(p=>{
      if(p.type==='receipt'){
        const amtCls=p.total<0?'neg':'pos';
        h+=`<div class="tx-row tx-receipt" data-rid="${p.receipt_id}" style="cursor:pointer"><div><div class="tx-item">${p.store} · ${p.item_count} items</div><div class="tx-meta">${fmtDate(p.date)}${p.time?' · '+p.time:''}</div></div><div class="tx-amount ${amtCls}">${fmt(p.total)}</div></div>`;
        // Hidden detail rows
        h+=`<div class="tx-detail" id="detail-${p.receipt_id}" style="display:none">`;
        p.items.forEach(item=>{
          h+=`<div class="tx-row" style="padding-left:1.5rem;opacity:.8"><div><div class="tx-item" style="font-size:.75rem">${item.item}</div><div class="tx-meta">${item.category.split(':')[1]||item.category}</div></div><div class="tx-amount neg" style="font-size:.75rem">${fmt(item.amount)}</div></div>`;
        });
        h+=`</div>`;
      }else{
        const isIncome=p.amount>0;
        const amtCls=isIncome?'pos':'neg';
        const rBadge=p.recurring?'<span class="badge-r">R</span>':'';
        const wBadge=`<span class="badge-w${p.work_related?' active':''}" data-id="${p.id}" title="Work-related (tax)">W</span>`;
        const personBadge=p.person&&p.person!=='shared'?`<span class="badge-person">${p.person}</span>`:'';
        const cashBadge=p.payment_method==='cash'?' 💵':'';
        const groupInfo=p.original_total?`<span style="font-size:.6rem;color:var(--text2)"> Total ${fmt(p.original_total)}</span>`:'';
        h+=`<div class="tx-row" data-edit='${JSON.stringify({id:p.id,item:p.item,amount:p.amount,category:p.category,person:p.person,work_related:p.work_related,original_total:p.original_total,date:p.date})}'><div><div class="tx-item">${p.item}${rBadge}${wBadge}${personBadge}${cashBadge}</div><div class="tx-meta">${p.category} · ${fmtDate(p.date)}${p.time?' · '+p.time:''}${groupInfo}</div></div><div style="display:flex;align-items:center;gap:.4rem"><span class="tx-amount ${amtCls}">${fmt(p.amount)}</span><button class="tx-del" data-id="${p.id}" title="Delete">✕</button></div></div>`;
      }
    });
    h+='</div>';
    document.getElementById('transactions').innerHTML=h;

    // Toggle receipt detail on click
    document.querySelectorAll('.tx-receipt').forEach(el=>el.addEventListener('click',()=>{
      const detail=document.getElementById('detail-'+el.dataset.rid);
      if(detail)detail.style.display=detail.style.display==='none'?'block':'none';
    }));
    // Delete transaction
    document.querySelectorAll('.tx-del').forEach(btn=>btn.addEventListener('click',async(e)=>{
      e.stopPropagation();
      if(!confirm('Delete this transaction?'))return;
      await fetch(`/api/purchases/${btn.dataset.id}`,{method:'DELETE'});
      renderPage();
    }));
    document.querySelectorAll('.badge-w').forEach(btn=>btn.addEventListener('click',async(e)=>{
      e.stopPropagation();
      const active=btn.classList.contains('active');
      await fetch(`/api/purchases/${btn.dataset.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({work_related:active?0:1})});
      btn.classList.toggle('active');
    }));
    document.querySelectorAll('.tx-row[data-edit]').forEach(row=>row.addEventListener('click',(e)=>{
      if(e.target.closest('.tx-del')||e.target.closest('.badge-w'))return;
      openEditModal(JSON.parse(row.dataset.edit));
    }));
    document.querySelectorAll('.pill[data-f]').forEach(p=>p.addEventListener('click',()=>{state.txFilter=p.dataset.f;renderTransactions(purchases)}));
    const taxBtn=document.getElementById('taxExportBtn');
    if(taxBtn)taxBtn.addEventListener('click',()=>{const[s,e]=getRange();window.open(`/api/tax-export?start=${s}&end=${e}`)});
    document.getElementById('txSearch').addEventListener('input',e=>{state.search=e.target.value;renderTransactions(purchases)});
  });
}

const PIE_COLORS=['#0071e3','#34c759','#ff3b30','#ff9500','#af52de','#5ac8fa','#ffcc00','#ff2d55','#5856d6','#64d2ff','#30b0c7','#ac8e68','#8e8e93','#ff6482'];
let selectedCategory=null;

function renderAnalysisCharts(purchases){
  const expenses=purchases.filter(p=>p.amount<0);
  if(expenses.length===0){document.getElementById('analysis-charts').innerHTML='';return}

  // Major categories
  const cats={};
  expenses.forEach(p=>{const c=p.category.split(':')[0];cats[c]=(cats[c]||0)+Math.abs(p.amount)});
  const catSorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const catTotal=catSorted.reduce((s,[,v])=>s+v,0);

  // Sub-categories for selected (or all)
  const subs={};
  expenses.forEach(p=>{
    const major=p.category.split(':')[0];
    if(selectedCategory&&major!==selectedCategory)return;
    const sub=p.category.includes(':')?p.category.split(':')[1]:major;
    subs[sub]=(subs[sub]||0)+Math.abs(p.amount);
  });
  const subSorted=Object.entries(subs).sort((a,b)=>b[1]-a[1]);
  const subTotal=subSorted.reduce((s,[,v])=>s+v,0);

  const pieTitle=selectedCategory?`${selectedCategory} breakdown`:'All categories';

  document.getElementById('analysis-charts').innerHTML=`
    <div class="analysis-charts">
      <div class="analysis-chart-box"><div style="font-size:.7rem;font-weight:600;margin-bottom:.4rem">${pieTitle} ${selectedCategory?'<span style="cursor:pointer;color:var(--accent)" id="pieReset">✕ clear</span>':''}</div><canvas id="pieChart"></canvas><div class="chart-tooltip" id="pieTip"></div></div>
      <div class="analysis-chart-box"><div style="font-size:.7rem;font-weight:600;margin-bottom:.4rem">Categories <span style="color:var(--text2)">(click to drill down)</span></div><canvas id="hbarChart"></canvas><div class="chart-tooltip" id="hbarTip"></div></div>
    </div>`;

  if(document.getElementById('pieReset')){
    document.getElementById('pieReset').addEventListener('click',()=>{selectedCategory=null;renderAnalysisCharts(purchases)});
  }

  // Draw pie chart
  const pieCanvas=document.getElementById('pieChart');
  const pCtx=pieCanvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const pW=pieCanvas.parentElement.clientWidth-32;
  const pH=160;
  pieCanvas.width=pW*dpr;pieCanvas.height=pH*dpr;
  pieCanvas.style.width=pW+'px';pieCanvas.style.height=pH+'px';
  pCtx.scale(dpr,dpr);

  const cx=pH/2,cy=pH/2,r=Math.min(pH/2-10,pW/3),innerR=r*0.55;
  let startAngle=-Math.PI/2;
  const pieSlices=[];
  subSorted.forEach(([name,val],i)=>{
    const slice=val/subTotal*Math.PI*2;
    pCtx.beginPath();pCtx.moveTo(cx+innerR*Math.cos(startAngle),cy+innerR*Math.sin(startAngle));
    pCtx.arc(cx,cy,r,startAngle,startAngle+slice);
    pCtx.arc(cx,cy,innerR,startAngle+slice,startAngle,true);
    pCtx.fillStyle=PIE_COLORS[i%PIE_COLORS.length];
    pCtx.fill();
    pieSlices.push({name,val,pct:(val/subTotal*100).toFixed(1),start:startAngle,end:startAngle+slice});
    startAngle+=slice;
  });
  // Center text
  pCtx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  pCtx.font='bold 14px -apple-system,sans-serif';pCtx.textAlign='center';
  pCtx.fillText(fmt(-subTotal),cx,cy+2);
  pCtx.font='9px -apple-system,sans-serif';
  pCtx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text2').trim();
  pCtx.fillText('total',cx,cy+14);

  // Legend (right side, left-aligned with color dots)
  const legendX=pH+20;
  subSorted.slice(0,8).forEach(([name,val],i)=>{
    const y=14+i*18;
    pCtx.fillStyle=PIE_COLORS[i%PIE_COLORS.length];
    pCtx.beginPath();pCtx.arc(legendX,y-2,4,0,Math.PI*2);pCtx.fill();
    pCtx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    pCtx.font='10px -apple-system,sans-serif';pCtx.textAlign='left';
    pCtx.fillText(`${name} (${(val/subTotal*100).toFixed(0)}%)`,legendX+10,y+2);
  });

  // Pie hover
  pieCanvas.addEventListener('mousemove',e=>{
    const rect=pieCanvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(pW/rect.width)-cx;
    const my=(e.clientY-rect.top)*(pH/rect.height)-cy;
    const angle=Math.atan2(my,mx);
    const dist=Math.sqrt(mx*mx+my*my);
    const tip=document.getElementById('pieTip');
    if(dist<=r){
      const normA=angle<-Math.PI/2?angle+Math.PI*2:angle;
      const hit=pieSlices.find(s=>{let st=s.start<-Math.PI/2?s.start+Math.PI*2:s.start;let en=s.end<-Math.PI/2?s.end+Math.PI*2:s.end;return normA>=st&&normA<en});
      if(hit){tip.textContent=`${hit.name}: ${hit.pct}% (${fmt(-hit.val)})`;tip.style.opacity='1';tip.style.left=(e.clientX-rect.left+10)+'px';tip.style.top=(e.clientY-rect.top-25)+'px'}
      else tip.style.opacity='0';
    }else tip.style.opacity='0';
  });
  pieCanvas.addEventListener('mouseleave',()=>{document.getElementById('pieTip').style.opacity='0'});

  // Draw horizontal bar chart (major categories)
  const hCanvas=document.getElementById('hbarChart');
  const hCtx=hCanvas.getContext('2d');
  const hW=hCanvas.parentElement.clientWidth-32;
  const hH=160;
  hCanvas.width=hW*dpr;hCanvas.height=hH*dpr;
  hCanvas.style.width=hW+'px';hCanvas.style.height=hH+'px';
  hCtx.scale(dpr,dpr);

  const barH=Math.min(24,hH/(catSorted.length+1));
  const maxVal=catSorted[0]?catSorted[0][1]:1;
  const hBarSlices=[];
  catSorted.forEach(([name,val],i)=>{
    const y=i*(barH+4)+4;
    const bw=(val/maxVal)*(hW-80);
    hCtx.fillStyle=PIE_COLORS[i%PIE_COLORS.length];
    const isSelected=selectedCategory===name;
    if(isSelected){hCtx.shadowColor=PIE_COLORS[i%PIE_COLORS.length];hCtx.shadowBlur=6}
    hCtx.beginPath();hCtx.fillRect(70,y,bw,barH-2);
    hCtx.shadowBlur=0;
    hCtx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    hCtx.font=`${isSelected?'bold ':''}10px -apple-system,sans-serif`;hCtx.textAlign='right';
    hCtx.fillText(name,65,y+barH/2+3);
    hBarSlices.push({name,val,pct:(val/catTotal*100).toFixed(1),y,h:barH,w:bw});
  });

  // Horizontal bar click → drill into pie
  hCanvas.addEventListener('click',e=>{
    const rect=hCanvas.getBoundingClientRect();
    const my=(e.clientY-rect.top)*(hH/rect.height);
    const hit=hBarSlices.find(s=>my>=s.y&&my<=s.y+s.h);
    if(hit){selectedCategory=selectedCategory===hit.name?null:hit.name;renderAnalysisCharts(purchases)}
  });
  hCanvas.style.cursor='pointer';

  // Horizontal bar hover
  hCanvas.addEventListener('mousemove',e=>{
    const rect=hCanvas.getBoundingClientRect();
    const my=(e.clientY-rect.top)*(hH/rect.height);
    const tip=document.getElementById('hbarTip');
    const hit=hBarSlices.find(s=>my>=s.y&&my<=s.y+s.h);
    if(hit){tip.textContent=`${hit.name}: ${hit.pct}% (${fmt(-hit.val)})`;tip.style.opacity='1';tip.style.left=(e.clientX-rect.left+10)+'px';tip.style.top=(e.clientY-rect.top-25)+'px'}
    else tip.style.opacity='0';
  });
  hCanvas.addEventListener('mouseleave',()=>{document.getElementById('hbarTip').style.opacity='0'});
}

function renderAnalysis(purchases){
  const allExpenses=purchases.filter(p=>p.amount<0);
  const expenses=selectedCategory?allExpenses.filter(p=>p.category.split(':')[0]===selectedCategory):allExpenses;

  const cats={};
  allExpenses.forEach(p=>{const c=p.category.split(':')[0];cats[c]=(cats[c]||0)+Math.abs(p.amount)});
  const catSorted=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const catMax=Math.max(...Object.values(cats),1);

  const places={};
  expenses.forEach(p=>{
    let place;
    if(p.receipt_file && p.receipt_file!=='recurring'){
      const parts=p.receipt_file.replace('.pdf','').split('_');
      place=parts.length>=2?parts[1].replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'Unknown';
    } else {
      // Extract place from parentheses: "Item (Store)" → "Store"
      const m=p.item.match(/\(([^)]+)\)$/);
      place=m?m[1]:p.item.split(':')[0].trim();
    }
    if(!places[place])places[place]={total:0,items:[]};
    places[place].total+=Math.abs(p.amount);places[place].items.push(p);
  });
  const placeSorted=Object.entries(places).sort((a,b)=>b[1].total-a[1].total);
  const placeMax=Math.max(...placeSorted.map(([,v])=>v.total),1);

  const subcats={};
  expenses.forEach(p=>{
    const sub=p.category.includes(':')?p.category.split(':')[1]:p.category.split(':')[0];
    if(!subcats[sub])subcats[sub]={total:0,items:[]};
    subcats[sub].total+=Math.abs(p.amount);subcats[sub].items.push(p);
  });
  const subSorted=Object.entries(subcats).sort((a,b)=>b[1].total-a[1].total);
  const subMax=Math.max(...subSorted.map(([,v])=>v.total),1);

  const filterLabel=selectedCategory?` <span style="color:var(--accent);font-size:.65rem">(${selectedCategory}) <span id="catClear" style="cursor:pointer">✕</span></span>`:'';

  let h=`<div class="analysis"><div class="analysis-tabs">
    <div class="analysis-tab ${state.analysisTab==='categories'?'active':''}" data-at="categories">Categories</div>
    <div class="analysis-tab ${state.analysisTab==='places'?'active':''}" data-at="places">Places${filterLabel}</div>
    <div class="analysis-tab ${state.analysisTab==='detailed'?'active':''}" data-at="detailed">Detailed${filterLabel}</div>
  </div><div class="cat-list">`;

  if(state.analysisTab==='categories'){
    catSorted.forEach(([name,val],idx)=>{
      const pct=(val/catMax*100).toFixed(0);
      const isActive=selectedCategory===name;
      h+=`<div class="cat-row" style="cursor:pointer;${isActive?'border-color:var(--accent)':''}" data-cat="${name}"><div><div class="cat-name">${name}${isActive?' ✓':''}</div><div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%"></div></div></div><div class="cat-amount">${fmt(-val)}</div></div>`;
    });
  }else if(state.analysisTab==='places'){
    placeSorted.forEach(([name,data],idx)=>{
      const pct=(data.total/placeMax*100).toFixed(0);
      h+=`<div class="cat-row" style="cursor:pointer" data-expand="place-${idx}"><div><div class="cat-name">${name} <span style="color:var(--text2);font-size:.65rem">(${data.items.length})</span></div><div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%"></div></div></div><div class="cat-amount">${fmt(-data.total)}</div></div>`;
      h+=`<div class="cat-detail" id="place-${idx}" style="display:none">`;
      data.items.slice(0,12).forEach(item=>{const day=item.created?fmtDate(item.created.split(' ')[0]):'';h+=`<div style="display:flex;justify-content:space-between;padding:.2rem .75rem .2rem 1.5rem;font-size:.7rem;opacity:.8"><span>${item.item} <span style="color:var(--text2)">${day}</span></span><span>${fmt(item.amount)}</span></div>`});
      if(data.items.length>12)h+=`<div style="padding:.2rem 1.5rem;font-size:.6rem;color:var(--text2)">+${data.items.length-12} more</div>`;
      h+=`</div>`;
    });
  }else{
    subSorted.forEach(([name,data],idx)=>{
      const pct=(data.total/subMax*100).toFixed(0);
      h+=`<div class="cat-row" style="cursor:pointer" data-expand="sub-${idx}"><div><div class="cat-name">${name} <span style="color:var(--text2);font-size:.65rem">(${data.items.length})</span></div><div class="cat-bar"><div class="cat-bar-fill" style="width:${pct}%"></div></div></div><div class="cat-amount">${fmt(-data.total)}</div></div>`;
      h+=`<div class="cat-detail" id="sub-${idx}" style="display:none">`;
      data.items.forEach(item=>{const day=item.created?fmtDate(item.created.split(' ')[0]):'';const qtyStr=item.qty&&item.unit?` · ${item.qty}${item.unit}`:'';h+=`<div style="display:flex;justify-content:space-between;padding:.2rem .75rem .2rem 1.5rem;font-size:.7rem;opacity:.8"><span>${item.item}<span style="color:var(--text2)">${qtyStr} · ${day}</span></span><span>${fmt(item.amount)}</span></div>`});
      h+=`</div>`;
    });
  }
  h+='</div></div>';

  document.getElementById('analysis').innerHTML=h;
  document.querySelectorAll('.analysis-tab').forEach(t=>t.addEventListener('click',()=>{state.analysisTab=t.dataset.at;renderAnalysis(purchases)}));
  document.querySelectorAll('[data-cat]').forEach(el=>el.addEventListener('click',()=>{selectedCategory=selectedCategory===el.dataset.cat?null:el.dataset.cat;renderAnalysisCharts(purchases);renderAnalysis(purchases)}));
  if(document.getElementById('catClear'))document.getElementById('catClear').addEventListener('click',(e)=>{e.stopPropagation();selectedCategory=null;renderAnalysisCharts(purchases);renderAnalysis(purchases)});
  document.querySelectorAll('[data-expand]').forEach(el=>el.addEventListener('click',()=>{const d=document.getElementById(el.dataset.expand);if(d)d.style.display=d.style.display==='none'?'block':'none'}));
}
async function render(){
  const[start,end]=getRange();
  renderControls();
  try{
    const[summary,daily,purchases,savings]=await Promise.all([getSummary(start,end),getDaily(start,end),getPurchases(start,end),getSavings()]);
    renderOverviewWithComparison(summary);
    if(state.tab==='week')renderWeek(daily);
    else if(state.tab==='month')renderMonth(daily);
    else renderYear(daily);
    renderChart(daily);
    renderTransactions(purchases);
    renderAnalysisCharts(purchases);
    renderAnalysis(purchases);
    renderSavings(savings);
    document.getElementById('footer').innerHTML=`Net: <span style="color:var(--balance)">${fmt(summary.balance)}</span>`;
  }catch(e){
    document.getElementById('view').innerHTML=`<p style="color:var(--expense);text-align:center">Error loading data</p>`;
  }
}

function renderSavings(savings){
  const el=document.getElementById('savings-section');
  if(!savings||savings.length===0){ el.innerHTML=''; return; }
  const everyday=savings.filter(a=>a.account_type==='everyday');
  const other=savings.filter(a=>a.account_type!=='everyday');
  const audTotal=savings.filter(a=>a.include_in_total&&a.currency==='AUD').reduce((s,a)=>s+a.balance,0);

  function row(a){
    return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:.8rem;padding:.4rem 0;border-bottom:1px solid var(--border)">
      <span>${a.account_name} <span style="color:var(--text2);font-size:.65rem">${a.currency}</span></span>
      <span style="font-weight:600">${a.currency==='AUD'?'$':''}${a.balance.toLocaleString('en-AU',{minimumFractionDigits:2})}${a.currency!=='AUD'?' '+a.currency:''}</span>
    </div>`;
  }

  let h=`<h3>Accounts <span style="font-size:.8rem;color:var(--balance)">${fmt(audTotal)} AUD</span></h3><div class="savings-body">`;
  if(everyday.length){h+=`<div style="font-size:.65rem;color:var(--text2);margin:.4rem 0;text-transform:uppercase">Everyday</div>`;everyday.forEach(a=>{h+=row(a)})}
  if(other.length){h+=`<div style="font-size:.65rem;color:var(--text2);margin:.4rem 0;text-transform:uppercase">Savings & Foreign</div>`;other.forEach(a=>{h+=row(a)})}
  h+='</div>';
  el.innerHTML=h;
  el.querySelector('h3').addEventListener('click',()=>el.classList.toggle('collapsed'));
  el.querySelectorAll('.sav-toggle').forEach(t=>t.addEventListener('click',async()=>{
    await fetch(`/api/savings/${t.dataset.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({include_in_total:parseInt(t.dataset.val)})});
    render();
  }));
}

function renderChart(daily){
  const canvas=document.getElementById('chart');
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const rect=canvas.parentElement.getBoundingClientRect();
  const w=rect.width-16;
  const h=140;
  canvas.width=w*dpr;canvas.height=h*dpr;
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.scale(dpr,dpr);

  let labels=[],values=[];
  if(state.tab==='week'){
    const start=weekStart(state.date);
    for(let i=0;i<7;i++){
      const d=new Date(start);d.setDate(d.getDate()+i);
      const key=isoDate(d);
      labels.push(DAYS[i]);
      values.push(daily[key]?modeValue(daily[key]):0);
    }
  }else if(state.tab==='month'){
    const start=monthStart(state.date);
    const dim=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
    for(let d=1;d<=dim;d++){
      const date=new Date(start.getFullYear(),start.getMonth(),d);
      const key=isoDate(date);
      labels.push(d%5===1?d.toString():'');
      values.push(daily[key]?modeValue(daily[key]):0);
    }
  }else{
    const months=Array.from({length:12},()=>({income:0,expenses:0}));
    Object.entries(daily).forEach(([date,vals])=>{
      const m=parseInt(date.split('-')[1])-1;
      if(m>=0&&m<12){months[m].income+=vals.income||0;months[m].expenses+=vals.expenses||0}
    });
    labels=MONTHS;
    values=months.map(m=>state.mode==='income'?m.income:state.mode==='expense'?m.expenses:m.income+m.expenses);
  }

  const max=Math.max(...values.map(Math.abs),1);
  const n=values.length;
  const padTop=10,padBot=18;
  const chartH=h-padTop-padBot;
  const barW=w/n;
  const gap=n>12?1:barW*0.15;

  ctx.clearRect(0,0,w,h);
  // Zero line
  const zeroY=padTop+chartH/2;
  ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
  ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,zeroY);ctx.lineTo(w,zeroY);ctx.stroke();

  const incColor=getComputedStyle(document.documentElement).getPropertyValue('--income').trim();
  const expColor=getComputedStyle(document.documentElement).getPropertyValue('--expense').trim();
  const txtColor=getComputedStyle(document.documentElement).getPropertyValue('--text2').trim();

  values.forEach((v,i)=>{
    const barH=(Math.abs(v)/max)*(chartH/2);
    const x=i*barW+gap/2;
    const bw=barW-gap;
    if(state.chartType==='line'){
      const px=i*barW+barW/2;
      const py=v>=0?zeroY-barH:zeroY+barH;
      if(i===0){ctx.beginPath();ctx.moveTo(px,py);ctx.strokeStyle=v>=0?incColor:expColor;ctx.lineWidth=2}
      else{ctx.lineTo(px,py)}
      if(i===values.length-1)ctx.stroke();
      // Dot
      ctx.fillStyle=v>=0?incColor:expColor;
      ctx.beginPath();ctx.arc(px,py,2.5,0,Math.PI*2);ctx.fill();
    } else {
      if(v>=0){ctx.fillStyle=incColor;ctx.fillRect(x,zeroY-barH,bw,barH)}
      else{ctx.fillStyle=expColor;ctx.fillRect(x,zeroY,bw,barH)}
    }
    // Labels
    if(labels[i]){
      ctx.fillStyle=txtColor;
      ctx.font=`${n>12?'8':'10'}px -apple-system,sans-serif`;
      ctx.textAlign='center';
      ctx.fillText(labels[i],i*barW+barW/2,h-3);
    }
  });
}

// Add modal with quick-add
document.getElementById('addBtn').addEventListener('click',()=>{
  const overlay=document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML=`<div class="modal"><h3>Quick Add</h3>
    <input id="m-quick" class="form-input" placeholder="coffee 5.50 or woolworths 97 groceries shared" autofocus style="font-size:1rem;padding:.7rem">
    <div style="font-size:.65rem;color:var(--text2);margin:.3rem 0">Examples: "uber 18.50" · "salary 3000" · "woolworths 85 shared"</div>
    <button class="btn-primary" id="m-quick-save" style="width:100%;margin-top:.5rem">Add</button>
    <div style="text-align:center;margin-top:.75rem"><span style="font-size:.7rem;color:var(--accent);cursor:pointer" id="m-show-full">or use full form ↓</span></div>
    <div id="m-full-form" style="display:none;margin-top:.75rem">
      <label>Type<select id="m-type"><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label>Item<input id="m-item" placeholder="e.g. Groceries, Rent" class="form-input"></label>
      <label>Amount<input id="m-amount" type="number" step="0.01" placeholder="0.00" class="form-input"></label>
      <label>Category<input id="m-cat" placeholder="e.g. food, bills, housing" class="form-input"></label>
      <label>Person<select id="m-person" class="form-input"><option value="shared">Shared</option><option value="person1">Person 1</option><option value="person2">Person 2</option></select></label>
      <button class="btn-primary" id="m-full-save" style="width:100%;margin-top:.5rem">Save</button>
    </div>
    <div class="modal-actions"><button class="btn-cancel" id="m-cancel" style="width:100%;margin-top:.5rem">Cancel</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#m-cancel').addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
  overlay.querySelector('#m-show-full').addEventListener('click',()=>{overlay.querySelector('#m-full-form').style.display='block'});
  // Quick add
  const quickSave=async()=>{
    const text=overlay.querySelector('#m-quick').value.trim();
    if(!text)return;
    const resp=await fetch('/api/purchases/quick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    if(resp.ok){overlay.remove();renderPage();}
    else{const err=await resp.json();alert(err.error||'Parse failed');}
  };
  overlay.querySelector('#m-quick-save').addEventListener('click',quickSave);
  overlay.querySelector('#m-quick').addEventListener('keydown',e=>{if(e.key==='Enter')quickSave()});
  // Full form save
  overlay.querySelector('#m-full-save').addEventListener('click',async()=>{
    const type=overlay.querySelector('#m-type').value;
    const item=overlay.querySelector('#m-item').value;
    const amount=parseFloat(overlay.querySelector('#m-amount').value);
    const cat=overlay.querySelector('#m-cat').value||'uncategorized';
    const person=overlay.querySelector('#m-person').value;
    if(!item||isNaN(amount))return;
    const amt=type==='expense'?-Math.abs(amount):Math.abs(amount);
    await fetch('/api/purchases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item,amount:amt,category:cat,person})});
    overlay.remove();renderPage();
  });
});

// Edit transaction modal
function openEditModal(p){
  const overlay=document.createElement('div');
  overlay.className='modal-overlay';
  const isIncome=p.amount>0;
  const dateVal=p.date||'';
  overlay.innerHTML=`<div class="modal"><h3>Edit Transaction</h3>
    <label>Item<input id="e-item" value="${p.item}" class="form-input"></label>
    <label>Amount<input id="e-amount" type="number" step="0.01" value="${Math.abs(p.amount)}" class="form-input"></label>
    <label>Type<select id="e-type"><option value="expense"${!isIncome?' selected':''}>Expense</option><option value="income"${isIncome?' selected':''}>Income</option></select></label>
    <label>Category<input id="e-cat" value="${p.category}" class="form-input"></label>
    <label>Date<input id="e-date" type="date" value="${dateVal}" class="form-input"></label>
    <label>Person<select id="e-person" class="form-input"><option value="shared"${p.person==='shared'?' selected':''}>Shared</option><option value="person1"${p.person==='person1'?' selected':''}>Person 1</option><option value="person2"${p.person==='person2'?' selected':''}>Person 2</option><option value="group"${p.person==='group'?' selected':''}>Group</option></select></label>
    <label>Work-related<input id="e-wr" type="checkbox"${p.work_related?' checked':''}></label>
    <div class="modal-actions" style="margin-top:.75rem"><button class="btn-primary" id="e-save" style="flex:1">Save</button><button class="btn-cancel" id="e-cancel" style="flex:1">Cancel</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#e-cancel').addEventListener('click',()=>overlay.remove());
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
  overlay.querySelector('#e-save').addEventListener('click',async()=>{
    const item=overlay.querySelector('#e-item').value;
    const amount=parseFloat(overlay.querySelector('#e-amount').value);
    const type=overlay.querySelector('#e-type').value;
    const cat=overlay.querySelector('#e-cat').value;
    const date=overlay.querySelector('#e-date').value;
    const person=overlay.querySelector('#e-person').value;
    const wr=overlay.querySelector('#e-wr').checked?1:0;
    if(!item||isNaN(amount))return;
    const amt=type==='expense'?-Math.abs(amount):Math.abs(amount);
    const body={item,amount:amt,category:cat,person,work_related:wr};
    if(date)body.created=date;
    await fetch(`/api/purchases/${p.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    overlay.remove();renderPage();
  });
}

// Theme toggle
const themeBtn=document.getElementById('themeBtn');
let theme=localStorage.getItem('lar-theme')||'auto';
function applyTheme(){
  if(theme==='dark'){document.documentElement.style.colorScheme='dark';document.documentElement.setAttribute('data-theme','dark');themeBtn.textContent='☀️'}
  else if(theme==='light'){document.documentElement.style.colorScheme='light';document.documentElement.setAttribute('data-theme','light');themeBtn.textContent='🌙'}
  else{document.documentElement.style.colorScheme='';document.documentElement.removeAttribute('data-theme');themeBtn.textContent=window.matchMedia('(prefers-color-scheme:dark)').matches?'☀️':'🌙'}
}
applyTheme();
themeBtn.addEventListener('click',()=>{
  theme=theme==='dark'?'light':theme==='light'?'auto':'dark';
  localStorage.setItem('lar-theme',theme);applyTheme();
});

// CSV export
function exportCSV(){
  const[start,end]=getRange();
  fetch(`${API}/purchases?start=${start}&end=${end}&person=${state.person}`).then(r=>r.json()).then(data=>{
    const header='Date,Item,Amount,Category,Person\n';
    const rows=data.map(p=>`${p.created},"${p.item}",${p.amount},${p.category},${p.person||'shared'}`).join('\n');
    const blob=new Blob([header+rows],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`finance_${start}_${end}.csv`;a.click();
  });
}

// Month-over-month comparison
async function renderOverviewWithComparison(summary){
  // Get previous period for comparison
  let prevStart,prevEnd;
  if(state.tab==='week'){
    const ps=new Date(weekStart(state.date));ps.setDate(ps.getDate()-7);
    prevStart=isoDate(ps);prevEnd=isoDate(weekStart(state.date));
  }else if(state.tab==='month'){
    const pm=new Date(state.date);pm.setMonth(pm.getMonth()-1);
    prevStart=isoDate(monthStart(pm));prevEnd=isoDate(monthStart(state.date));
  }else{
    const py=new Date(state.date);py.setFullYear(py.getFullYear()-1);
    prevStart=isoDate(yearStart(py));prevEnd=isoDate(yearStart(state.date));
  }
  let prev={income:0,expenses:0,balance:0};
  try{prev=await fetchJSON(`${API}/summary?start=${prevStart}&end=${prevEnd}&person=${state.person}`)}catch(e){}

  function pct(cur,prv){if(!prv)return'';const p=((cur-prv)/Math.abs(prv||1)*100).toFixed(0);return p>0?`<span style="color:var(--income);font-size:.65rem">↑${p}%</span>`:`<span style="color:var(--expense);font-size:.65rem">↓${Math.abs(p)}%</span>`}

  const periodLabel = state.tab==='week'?'This Week':state.tab==='month'?'This Month':'This Year';
  const vsLabel = state.tab==='week'?'vs last week':state.tab==='month'?'vs last month':'vs last year';
  document.getElementById('overview').innerHTML=`
    <div class="stat-card"><div class="label">Expenses ${pct(summary.expenses,prev.expenses)}</div><div class="value expense">${fmt(summary.expenses)}</div><div style="font-size:.55rem;color:var(--text2)">${periodLabel} · ${vsLabel}</div></div>`;
}

// Shopping List page
async function renderShoppingPage() {
  const items = await fetchJSON(`${API}/shopping`);
  const el = document.getElementById('shopping-page');
  const unchecked = items.filter(i=>!i.checked);
  const checked = items.filter(i=>i.checked);

  el.innerHTML = `
    <div class="ov-section">
      <div class="inline-form" style="flex-direction:row">
        <input type="text" id="shop-input" class="form-input" placeholder="Add item..." style="flex:3">
        <button class="btn-primary" id="shop-add" style="flex:1">Add</button>
      </div>
    </div>
    <div class="ov-section">
      <h3>To Buy (${unchecked.length})</h3>
      <div class="ov-list">
        ${unchecked.map(i => `<div class="shop-item" data-id="${i.id}">
          <span class="shop-check" data-id="${i.id}">☐</span>
          <span class="shop-name">${i.item}</span>
          <span style="font-size:.6rem;color:var(--text2)">${i.added_by}</span>
          <button class="shop-del" data-id="${i.id}">✕</button>
        </div>`).join('') || '<p class="settings-empty">List is empty 🎉</p>'}
      </div>
    </div>
    ${checked.length ? `<div class="ov-section">
      <div class="settings-header"><h3>Done (${checked.length})</h3><button class="settings-add" id="shop-clear">Clear done</button></div>
      <div class="ov-list">
        ${checked.map(i => `<div class="shop-item checked" data-id="${i.id}">
          <span class="shop-check" data-id="${i.id}">☑</span>
          <span class="shop-name" style="text-decoration:line-through;opacity:.5">${i.item}</span>
        </div>`).join('')}
      </div>
    </div>` : ''}`;

  // Add item
  const addItem = async () => {
    const val = document.getElementById('shop-input').value.trim();
    if (!val) return;
    await fetch('/api/shopping', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({item: val})});
    renderShoppingPage();
  };
  document.getElementById('shop-add').addEventListener('click', addItem);
  document.getElementById('shop-input').addEventListener('keydown', e => { if(e.key==='Enter') addItem() });
  // Toggle check
  el.querySelectorAll('.shop-check').forEach(btn => btn.addEventListener('click', async () => {
    await fetch(`/api/shopping/${btn.dataset.id}`, {method:'PUT'});
    renderShoppingPage();
  }));
  // Delete
  el.querySelectorAll('.shop-del').forEach(btn => btn.addEventListener('click', async () => {
    await fetch(`/api/shopping/${btn.dataset.id}`, {method:'DELETE'});
    renderShoppingPage();
  }));
  // Clear done
  if (document.getElementById('shop-clear')) {
    document.getElementById('shop-clear').addEventListener('click', async () => {
      await fetch('/api/shopping/clear', {method:'POST'});
      renderShoppingPage();
    });
  }
}

// Work page
async function renderWorkPage() {
  const now = new Date();
  if (!window.workState) window.workState = {tab:'week', date: new Date()};
  const ws = window.workState;

  // Fetch range based on view
  let fetchStart, fetchEnd;
  if(ws.tab==='week'){
    fetchStart=weekStart(ws.date);fetchEnd=new Date(fetchStart);fetchEnd.setDate(fetchEnd.getDate()+7);
  } else if(ws.tab==='month'){
    fetchStart=new Date(ws.date.getFullYear(),ws.date.getMonth(),1);fetchEnd=new Date(ws.date.getFullYear(),ws.date.getMonth()+1,1);
  } else {
    fetchStart=new Date(ws.date.getFullYear(),0,1);fetchEnd=new Date(ws.date.getFullYear()+1,0,1);
  }
  const logs = await fetchJSON(`${API}/worklog?start=${isoDate(fetchStart)}&end=${isoDate(fetchEnd)}`);
  const byDate = {}; logs.forEach(l => { byDate[l.date] = l; });
  const totalHours = logs.reduce((t,l) => t+l.hours, 0);
  const totalCash = logs.reduce((t,l) => t+(l.cash_amount||0), 0);
  const totalInvoice = logs.reduce((t,l) => t+(l.invoice_amount||0), 0);
  const defaultRate = logs.find(l=>l.rate)?.rate || 30;

  const el = document.getElementById('work-page');

  // Period label
  let periodLabel;
  if(ws.tab==='week'){
    const s=weekStart(ws.date),e=new Date(s);e.setDate(e.getDate()+6);
    periodLabel=`${fmtDate(isoDate(s))} – ${fmtDate(isoDate(e))}`;
  } else if(ws.tab==='month'){
    periodLabel=`${ws.date.toLocaleString('default',{month:'long'})} ${ws.date.getFullYear()}`;
  } else {
    periodLabel=`${ws.date.getFullYear()}`;
  }

  // Calendar HTML
  let calH='';
  const today=isoDate(new Date());
  if(ws.tab==='week'){
    const start=weekStart(ws.date);
    calH='<div class="calendar">';
    DAYS.forEach(d=>{calH+=`<div class="cal-header">${d}</div>`});
    for(let i=0;i<7;i++){
      const d=new Date(start);d.setDate(d.getDate()+i);
      const key=isoDate(d),entry=byDate[key];
      const cls=key===today?' today':'';
      calH+=`<div class="cal-day${cls}"><div class="day-num">${d.getDate()}</div>`;
      if(entry){
        calH+=`<div class="day-amount positive">${entry.hours}h</div>`;
        const cash=entry.cash_amount||0,inv=entry.invoice_amount||0;
        if(cash)calH+=`<div style="font-size:.55rem;color:var(--text2)">💵$${cash}</div>`;
        if(inv)calH+=`<div style="font-size:.55rem;color:var(--text2)">📄$${inv}</div>`;
      }
      calH+=`</div>`;
    }
    calH+='</div>';
  } else if(ws.tab==='month'){
    const mStart=new Date(ws.date.getFullYear(),ws.date.getMonth(),1);
    const dim=new Date(mStart.getFullYear(),mStart.getMonth()+1,0).getDate();
    const firstDay=mStart.getDay();
    calH='<div class="calendar">';
    DAYS.forEach(d=>{calH+=`<div class="cal-header">${d}</div>`});
    for(let i=0;i<firstDay;i++)calH+='<div class="cal-day empty"></div>';
    for(let d=1;d<=dim;d++){
      const key=isoDate(new Date(mStart.getFullYear(),mStart.getMonth(),d));
      const entry=byDate[key],cls=key===today?' today':'';
      calH+=`<div class="cal-day${cls}" data-wdate="${key}" style="cursor:pointer"><div class="day-num">${d}</div>`;
      if(entry){
        calH+=`<div class="day-amount positive">${entry.hours}h</div>`;
        if(entry.cash_amount)calH+=`<div style="font-size:.5rem;color:var(--text2)">💵${entry.cash_amount}</div>`;
        if(entry.invoice_amount)calH+=`<div style="font-size:.5rem;color:var(--text2)">📄${entry.invoice_amount}</div>`;
      }
      calH+=`</div>`;
    }
    calH+='</div>';
  } else {
    // Annual - group by month
    const months=Array.from({length:12},()=>({hours:0,cash:0,inv:0}));
    logs.forEach(l=>{const m=parseInt(l.date.split('-')[1])-1;months[m].hours+=l.hours;months[m].cash+=(l.cash_amount||0);months[m].inv+=(l.invoice_amount||0)});
    calH='<div class="month-grid">';
    months.forEach((m,i)=>{
      calH+=`<div class="month-card" data-wmonth="${i}" style="cursor:pointer"><div class="month-name">${MONTHS[i]}</div><div class="month-amount" style="color:${m.hours?'var(--income)':'var(--text2)'}">${m.hours?m.hours+'h':'—'}</div>${m.hours?`<div style="font-size:.55rem;color:var(--text2)">${fmt(m.cash+m.inv)}</div>`:''}</div>`;
    });
    calH+='</div>';
  }

  el.innerHTML = `
    <div class="overview-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="ov-card">
        <div class="ov-label">Hours</div>
        <div class="ov-value income">${totalHours.toFixed(1)}h</div>
        <div class="ov-sub">${fmt(totalHours*defaultRate)}</div>
      </div>
      <div class="ov-card">
        <div class="ov-label">Breakdown</div>
        <div class="ov-value balance">${fmt(totalCash+totalInvoice)}</div>
        <div class="ov-sub">💵${fmt(totalCash)} · 📄${fmt(totalInvoice)}</div>
      </div>
    </div>

    <div class="tabs">
      <div class="tab ${ws.tab==='week'?'active':''}" data-wt="week">Weekly</div>
      <div class="tab ${ws.tab==='month'?'active':''}" data-wt="month">Monthly</div>
      <div class="tab ${ws.tab==='year'?'active':''}" data-wt="year">Annual</div>
    </div>
    <div class="nav-arrows" style="margin-bottom:.5rem">
      <button id="work-prev">←</button>
      <span style="font-size:.8rem;font-weight:500;flex:1;text-align:center">${periodLabel}</span>
      <button id="work-next">→</button>
    </div>
    <div id="work-cal">${calH}</div>

    <div class="ov-section" style="margin-top:1rem">
      <h3>Log Hours</h3>
      <div class="inline-form">
        <div class="form-row">
          <input type="date" id="work-date" class="form-input" value="${isoDate(now)}" style="flex:2">
          <input type="number" id="work-hours" class="form-input" placeholder="Hours" step="0.5" style="flex:1">
          <input type="number" id="work-rate" class="form-input" placeholder="Rate" value="${defaultRate}" step="1" style="flex:1">
        </div>
        <div class="form-row">
          <input type="number" id="work-cash" class="form-input" placeholder="Cash $" step="0.01" style="flex:1">
          <input type="number" id="work-invoice" class="form-input" placeholder="Invoice (auto)" step="0.01" style="flex:1" disabled>
          <button class="btn-primary" id="work-save">Log</button>
        </div>
      </div>
    </div>
    ${ws.tab==='week' && totalInvoice > 0 ? `<div class="ov-section" style="margin-top:.8rem">
      <button class="btn-primary" id="work-gen-invoice" style="width:100%">📄 Generate Invoice — ${fmt(totalInvoice)}</button>
    </div>` : ''}
  `;

  // Events
  document.querySelectorAll('[data-wt]').forEach(t=>t.addEventListener('click',()=>{ws.tab=t.dataset.wt;renderWorkPage()}));
  const genInvBtn = document.getElementById('work-gen-invoice');
  if (genInvBtn) genInvBtn.addEventListener('click', async () => {
    const weekOf = isoDate(weekStart(ws.date));
    const r = await fetch('/api/invoices/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({week_of: weekOf})});
    const d = await r.json();
    if (d.ok || d.id) { alert(`Invoice generated for week of ${fmtDate(weekOf)}`); }
    else { alert(d.error || 'Failed to generate invoice'); }
  });
  document.getElementById('work-prev').addEventListener('click',()=>{
    if(ws.tab==='week')ws.date.setDate(ws.date.getDate()-7);
    else if(ws.tab==='month')ws.date.setMonth(ws.date.getMonth()-1);
    else ws.date.setFullYear(ws.date.getFullYear()-1);
    renderWorkPage();
  });
  document.getElementById('work-next').addEventListener('click',()=>{
    if(ws.tab==='week')ws.date.setDate(ws.date.getDate()+7);
    else if(ws.tab==='month')ws.date.setMonth(ws.date.getMonth()+1);
    else ws.date.setFullYear(ws.date.getFullYear()+1);
    renderWorkPage();
  });
  document.querySelectorAll('[data-wdate]').forEach(c=>c.addEventListener('click',()=>{ws.date=new Date(c.dataset.wdate+'T12:00:00');ws.tab='week';renderWorkPage()}));
  document.querySelectorAll('[data-wmonth]').forEach(c=>c.addEventListener('click',()=>{ws.date=new Date(ws.date.getFullYear(),parseInt(c.dataset.wmonth),1);ws.tab='month';renderWorkPage()}));

  // Auto-calc invoice
  ['work-cash','work-hours','work-rate'].forEach(id=>{
    document.getElementById(id).addEventListener('input',()=>{
      const h=parseFloat(document.getElementById('work-hours').value)||0;
      const r=parseFloat(document.getElementById('work-rate').value)||0;
      const c=parseFloat(document.getElementById('work-cash').value)||0;
      document.getElementById('work-invoice').value=Math.max(0,h*r-c).toFixed(2);
    });
  });
  document.getElementById('work-save').addEventListener('click',async()=>{
    const date=document.getElementById('work-date').value;
    const hours=parseFloat(document.getElementById('work-hours').value);
    const rate=parseFloat(document.getElementById('work-rate').value)||null;
    const cash=parseFloat(document.getElementById('work-cash').value)||0;
    if(!date||isNaN(hours)||hours<=0)return;
    const invoice=Math.max(0,(hours*(rate||0))-cash);
    await fetch('/api/worklog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person:'person2',date,hours,rate,cash_amount:cash,invoice_amount:invoice})});
    renderWorkPage();
  });
}

// Overview page
// ─── Home Page ───────────────────────────────────────────────────────────────
async function renderHomePage() {
  // Fetch snippets for cards
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(),now.getMonth()+1,0).getDate()}`;
  const [summary, weather, system, shopping] = await Promise.all([
    fetchJSON(`${API}/summary?start=${monthStart}&end=${monthEnd}`).catch(()=>({income:0,expenses:0})),
    fetchJSON(`${API}/weather`).catch(()=>null),
    fetchJSON(`${API}/system`).catch(()=>null),
    fetchJSON(`${API}/shopping`).catch(()=>[])
  ]);

  const weatherSnippet = weather && weather.current ? `${weather.current.temperature_2m}° · ${weather.current.wind_speed_10m} km/h` : 'Loading...';
  const systemSnippet = system && !system.error ? `RAM ${system.memory.pct}% · Disk ${system.disk.pct}` : 'Offline';
  const shoppingCount = shopping.filter(s => !s.done).length;
  const containers = system && system.containers ? system.containers.length : 0;

  document.getElementById('home-page').innerHTML = `
    <div class="home-grid">
      <div class="home-card home-card-finance" data-nav="finance">
        <div class="home-card-emoji">💰</div>
        <div class="home-card-title">Finance</div>
        <div class="home-card-snippet">Spent ${fmt(summary.expenses)} this month</div>
      </div>
      <div class="home-card home-card-weather" data-expand="weather">
        <div class="home-card-emoji">🌤️</div>
        <div class="home-card-title">Weather</div>
        <div class="home-card-snippet">${weatherSnippet}</div>
        <div class="home-card-detail" style="display:none">
          ${weather && weather.daily ? `<div style="display:flex;gap:.3rem;margin-top:.5rem;overflow-x:auto">
            ${weather.daily.time.map((d,i) => `<div style="text-align:center;font-size:.6rem;min-width:3rem">
              <div style="color:var(--text2)">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d+'T00:00').getDay()]}</div>
              <div style="font-weight:600">${weather.daily.temperature_2m_max[i]}°</div>
              <div style="color:var(--text2)">${weather.daily.temperature_2m_min[i]}°</div>
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>
      <div class="home-card home-card-system" data-expand="system">
        <div class="home-card-emoji">🖥️</div>
        <div class="home-card-title">System</div>
        <div class="home-card-snippet">${systemSnippet}</div>
        <div class="home-card-detail" style="display:none">
          ${system && !system.error ? `<div style="font-size:.65rem;margin-top:.5rem;line-height:1.6">
            <div>CPU: ${system.cpu.replace('CPU usage: ','')}</div>
            <div>RAM: ${system.memory.used_gb}/${system.memory.total_gb} GB</div>
            <div>Disk: ${system.disk.used} / ${system.disk.total}</div>
            ${system.containers.map(c => `<div style="color:var(--text2)">🟢 ${c}</div>`).join('')}
          </div>` : ''}
        </div>
      </div>
      <div class="home-card home-card-services" data-expand="services">
        <div class="home-card-emoji">🔗</div>
        <div class="home-card-title">Services</div>
        <div class="home-card-snippet">${containers} containers running</div>
        <div class="home-card-detail" style="display:none">
          <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem">
            <span style="font-size:.65rem;color:var(--text2)">Configure service links in settings</span>
          </div>
        </div>
      </div>
      <div class="home-card home-card-shopping" data-nav="shopping">
        <div class="home-card-emoji">🛒</div>
        <div class="home-card-title">Shopping</div>
        <div class="home-card-snippet">${shoppingCount} item${shoppingCount!==1?'s':''} on list</div>
      </div>
      <div class="home-card home-card-work" data-nav="work">
        <div class="home-card-emoji">💼</div>
        <div class="home-card-title">Work</div>
        <div class="home-card-snippet">Hours & invoices</div>
      </div>
    </div>
  `;

  // Wire card interactions
  document.querySelectorAll('.home-card[data-nav]').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.nav;
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelector(`.nav-tab[data-page="${page}"]`).classList.add('active');
      currentPage = page;
      renderPage();
    });
  });
  document.querySelectorAll('.home-card[data-expand]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.svc-link')) return; // don't collapse when clicking service links
      const detail = card.querySelector('.home-card-detail');
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
      card.classList.toggle('expanded');
    });
  });
}

// ─── Income Tab ──────────────────────────────────────────────────────────────
async function renderIncomeTab() {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(),now.getMonth()+1,0).getDate()}`;
  const purchases = await fetchJSON(`${API}/purchases?start=${monthStart}&end=${monthEnd}`);
  const income = purchases.filter(p => p.amount > 0);
  const totalIncome = income.reduce((t,p) => t + p.amount, 0);
  const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()];

  // Group by source
  const sources = {};
  income.forEach(p => {
    const src = p.category || 'Other';
    sources[src] = (sources[src] || 0) + p.amount;
  });
  const srcSorted = Object.entries(sources).sort((a,b) => b[1] - a[1]);

  document.getElementById('finance-income').innerHTML = `
    <div class="ov-section" style="margin-top:.5rem">
      <h3>Income — ${monthName}</h3>
      <div class="ov-card" style="margin-bottom:.8rem">
        <div class="ov-label">Total received</div>
        <div class="ov-value income">${fmt(totalIncome)}</div>
      </div>
      ${srcSorted.length ? `<div class="ov-bars">
        ${srcSorted.map(([src, amt]) => {
          const pct = Math.min(100, amt / totalIncome * 100);
          return `<div class="ov-bar-row">
            <span class="ov-bar-label">${src}</span>
            <div class="ov-bar-track"><div class="ov-bar-fill" style="width:${pct}%;background:var(--income)"></div></div>
            <span class="ov-bar-amt" style="color:var(--income)">${fmt(amt)}</span>
          </div>`;
        }).join('')}
      </div>` : ''}
      <div class="ov-list" style="margin-top:.8rem">
        ${income.map(p => `<div class="ov-list-item"><span>${p.item} <span style="font-size:.6rem;color:var(--text2)">${fmtDate(p.created.split(' ')[0])} · ${p.person}</span></span><span style="color:var(--income)">${fmt(p.amount)}</span></div>`).join('') || '<p class="settings-empty">No income this month</p>'}
      </div>
    </div>
  `;
}

// ─── Finance Overview ────────────────────────────────────────────────────────
async function renderFinanceOverview() {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(),now.getMonth()+1,0).getDate()}`;
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate()-7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate()-14);
  const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);

  const [summary, savings, recurring, rates, recent, thisWeek, lastWeek, thisFortnight, lastFortnight] = await Promise.all([
    fetchJSON(`${API}/summary?start=${monthStart}&end=${monthEnd}`),
    getSavings(),
    getRecurring(),
    fetchJSON(`${API}/rates`),
    fetchJSON(`${API}/purchases?start=${monthStart}&end=${monthEnd}`),
    fetchJSON(`${API}/summary?start=${isoDate(weekAgo)}&end=${isoDate(now)}`),
    fetchJSON(`${API}/summary?start=${isoDate(twoWeeksAgo)}&end=${isoDate(weekAgo)}`),
    fetchJSON(`${API}/summary?start=${isoDate(twoWeeksAgo)}&end=${isoDate(now)}`),
    fetchJSON(`${API}/summary?start=${isoDate(fourWeeksAgo)}&end=${isoDate(twoWeeksAgo)}`)
  ]);

  // Last month for comparison
  const lastMonthEnd = monthStart;
  const lm = new Date(now); lm.setMonth(lm.getMonth()-1);
  const lastMonthStart = `${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,'0')}-01`;
  let lastMonth = {income:0, expenses:0};
  try { lastMonth = await fetchJSON(`${API}/summary?start=${lastMonthStart}&end=${lastMonthEnd}`); } catch(e) {}
  let budgets = [];
  try { budgets = await fetchJSON(`${API}/budgets`); } catch(e) {}
  let goals = [];
  try { goals = await fetchJSON(`${API}/goals`); } catch(e) {}

  const audTotal = savings.filter(s=>s.currency==='AUD').reduce((t,s)=>t+s.balance, 0);
  const convertedTotal = savings.reduce((t,s) => t + s.balance * (rates[s.currency]||1), 0);
  const expenseCats = Object.entries(summary.categories||{}).filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]).slice(0,7);
  const daysInMonth = new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const dayOfMonth = now.getDate();
  const dailyAvg = summary.expenses ? (summary.expenses / dayOfMonth) : 0;
  const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()];

  const fnExpenses = thisFortnight.expenses || 0;
  const fnLastExpenses = lastFortnight.expenses || 0;
  const fnPct = fnLastExpenses ? ((fnExpenses - fnLastExpenses) / Math.abs(fnLastExpenses) * 100).toFixed(0) : 0;
  const moPct = lastMonth.expenses ? ((summary.expenses - lastMonth.expenses) / Math.abs(lastMonth.expenses) * 100).toFixed(0) : 0;

  function arrow(pct, inverse) {
    if (!pct || pct == 0) return '';
    const up = inverse ? pct < 0 : pct > 0;
    return `<span style="font-size:.6rem;font-weight:600;color:var(--${up?'income':'expense'})">${up?'\u2191':'\u2193'}${Math.abs(pct)}%</span>`;
  }

  const recurringSpend = recent.filter(p => p.amount < 0 && (p.receipt_file||'').startsWith('recurring')).reduce((t,p) => t + p.amount, 0);
  const discretionarySpend = summary.expenses - recurringSpend;

  const dowSpend = [0,0,0,0,0,0,0];
  recent.filter(p => p.amount < 0).forEach(p => {
    const d = new Date(p.created.split(' ')[0] + 'T00:00');
    dowSpend[d.getDay()] += Math.abs(p.amount);
  });
  const dowNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dowMax = Math.max(...dowSpend, 1);

  const everyday = savings.filter(s=>s.account_type==='everyday');
  const savingsAccts = savings.filter(s=>s.account_type!=='everyday');
  const bills = recurring.filter(r=>r.amount<0);
  function toMonthly(r) {
    const f = r.frequency;
    if (f==='weekly') return r.amount * 4.33;
    if (f==='fortnightly') return r.amount * 2.17;
    if (f==='quarterly') return r.amount / 3;
    if (f==='yearly') return r.amount / 12;
    return r.amount;
  }
  const monthlyBills = bills.reduce((t,r) => t + toMonthly(r), 0);

  document.getElementById('finance-overview').innerHTML = `
    <div class="overview-grid">
      <div class="ov-card">
        <div class="ov-label">Fortnight ${arrow(fnPct, true)}</div>
        <div class="ov-value expense">${fmt(fnExpenses)}</div>
        <div class="ov-sub">vs prev 14 days</div>
      </div>
      <div class="ov-card">
        <div class="ov-label">${monthName} ${arrow(moPct, true)}</div>
        <div class="ov-value expense">${fmt(summary.expenses)}</div>
        <div class="ov-sub">vs last month</div>
      </div>
      <div class="ov-card">
        <div class="ov-label">Daily avg</div>
        <div class="ov-value expense">${fmt(dailyAvg)}</div>
        <div class="ov-sub">${dayOfMonth} days in</div>
      </div>
      <div class="ov-card">
        <div class="ov-label">Net Worth</div>
        <div class="ov-value balance">${fmt(state.nwAudOnly?audTotal:convertedTotal)}</div>
        <div class="ov-sub">${state.nwAudOnly?'AUD only':'\u2248 all in AUD'}</div>
      </div>
    </div>

    ${expenseCats.length ? `<div class="ov-section">
      <h3>Where it goes</h3>
      <div class="ov-bars">
        ${expenseCats.map(([cat, amt]) => {
          const pct = Math.min(100, Math.abs(amt) / Math.abs(summary.expenses||1) * 100);
          return `<div class="ov-bar-row">
            <span class="ov-bar-label">${cat}</span>
            <div class="ov-bar-track"><div class="ov-bar-fill" style="width:${pct}%"></div></div>
            <span class="ov-bar-amt">${fmt(amt)} <span style="color:var(--text2);font-size:.55rem">${pct.toFixed(0)}%</span></span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <div class="ov-section">
      <h3>Fixed vs Discretionary</h3>
      <div style="display:flex;gap:.5rem">
        <div style="flex:1;text-align:center;padding:.5rem;background:var(--card);border-radius:.5rem">
          <div style="font-size:.6rem;color:var(--text2)">Recurring</div>
          <div style="font-weight:600;color:var(--expense)">${fmt(recurringSpend)}</div>
        </div>
        <div style="flex:1;text-align:center;padding:.5rem;background:var(--card);border-radius:.5rem">
          <div style="font-size:.6rem;color:var(--text2)">Discretionary</div>
          <div style="font-weight:600;color:var(--expense)">${fmt(discretionarySpend)}</div>
        </div>
      </div>
    </div>

    <div class="ov-section">
      <h3>Spending by day</h3>
      <div style="display:flex;gap:.2rem;align-items:flex-end;height:60px">
        ${dowSpend.map((v,i) => {
          const h = Math.max(4, v/dowMax*50);
          return `<div style="flex:1;text-align:center"><div style="background:var(--accent);border-radius:3px 3px 0 0;height:${h}px;margin:0 auto;width:80%"></div><div style="font-size:.5rem;color:var(--text2);margin-top:2px">${dowNames[i]}</div></div>`;
        }).join('')}
      </div>
    </div>

    ${budgets.length ? `<div class="ov-section">
      <h3>Budgets</h3>
      <div class="ov-bars">
        ${budgets.map(b => {
          const color = b.pct >= 100 ? 'var(--expense)' : b.pct >= 80 ? '#ff9500' : 'var(--accent)';
          return `<div class="ov-bar-row">
            <span class="ov-bar-label">${b.category}</span>
            <div class="ov-bar-track"><div class="ov-bar-fill" style="width:${b.pct}%;background:${color}"></div></div>
            <span class="ov-bar-amt" style="color:${color}">${fmt(-b.spent)} / ${fmt(b.monthly_limit)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <div class="ov-section">
      <h3>Bills & Subscriptions</h3>
      <div class="ov-list">
        ${bills.length ? bills.map(r => `<div class="ov-list-item"><span>${r.item} <span style="font-size:.6rem;color:var(--text2)">${r.frequency}</span></span><span style="color:var(--expense)">${fmt(r.amount)}</span></div>`).join('') : '<p class="settings-empty">None set up</p>'}
      </div>
      ${bills.length ? `<div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--text2);margin-top:.5rem;padding-top:.4rem;border-top:1px solid var(--border)">
        <span>Monthly: <span style="color:var(--expense)">${fmt(monthlyBills)}</span></span>
        <span>Fortnightly: <span style="color:var(--expense)">${fmt(monthlyBills/2.17)}</span></span>
      </div>` : ''}
    </div>

    ${everyday.length||savingsAccts.length ? `<div class="ov-section">
      <h3>Accounts</h3>
      <div class="ov-list">
        ${everyday.map(s => `<div class="ov-list-item"><span>${s.account_name}</span><span class="balance">${s.currency} ${s.balance.toLocaleString('en-AU',{minimumFractionDigits:2})}</span></div>`).join('')}
        ${savingsAccts.map(s => {
          const audEquiv = s.currency !== 'AUD' ? ` <span style="color:var(--text2);font-size:.65rem">\u2248 AUD ${(s.balance*(rates[s.currency]||1)).toLocaleString('en-AU',{minimumFractionDigits:0,maximumFractionDigits:0})}</span>` : '';
          return `<div class="ov-list-item"><span>${s.account_name}</span><span class="balance">${s.currency} ${s.balance.toLocaleString('en-AU',{minimumFractionDigits:2})}${audEquiv}</span></div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;
  const nwCard=document.querySelectorAll('#finance-overview .ov-card')[3];
  if(nwCard){nwCard.style.cursor='pointer';nwCard.addEventListener('click',()=>{state.nwAudOnly=!state.nwAudOnly;renderFinanceOverview()});}
}

// Settings page
async function renderSettings() {
  const [recurring, savings, budgets, goals] = await Promise.all([getRecurring(), getSavings(), fetchJSON(`${API}/budgets`), fetchJSON(`${API}/goals`)]);
  const el = document.getElementById('settings-page');

  const everyday = savings.filter(s => s.account_type === 'everyday');
  const savingsAccts = savings.filter(s => s.account_type !== 'everyday');

  function acctHTML(list, type) {
    return list.map(s => `
      <div class="settings-item" data-id="${s.id}">
        <div class="settings-item-info">
          <span class="settings-item-name">${s.account_name}</span>
          <span class="settings-item-detail">${s.currency} ${s.balance.toLocaleString('en-AU', {minimumFractionDigits:2})}</span>
        </div>
        <div class="settings-item-actions">
          <button class="settings-edit-bal" data-id="${s.id}" data-name="${s.account_name}" data-bal="${s.balance}">✎</button>
          <button class="settings-del-acct" data-id="${s.id}">✕</button>
        </div>
      </div>`).join('');
  }

  const recurringHTML = recurring.map(r => {
    const isIncome = r.amount > 0;
    const amtDisplay = isIncome ? `<span class="income">+ ${fmt(r.amount)}</span>` : `<span class="expense">${fmt(r.amount)}</span>`;
    return `
    <div class="settings-item" data-id="${r.id}">
      <div class="settings-item-info">
        <span class="settings-item-name">${r.item}</span>
        <span class="settings-item-detail">${amtDisplay} · ${r.frequency} · ${r.person||'shared'} · ${r.category}${r.start_date ? ' · from '+fmtDate(r.start_date) : ''}</span>
      </div>
      <div class="settings-item-actions">
        <button class="settings-remind-rec" data-id="${r.id}" title="Toggle reminder">${r.remind?'🔔':'🔕'}</button>
        <button class="settings-edit-rec" data-id="${r.id}" data-item="${r.item}" data-amount="${Math.abs(r.amount)}" data-type="${r.amount>0?'income':'expense'}" data-cat="${r.category}" data-freq="${r.frequency}" data-person="${r.person||'shared'}" data-start="${r.start_date||''}">✎</button>
        <button class="settings-del" data-type="recurring" data-id="${r.id}">✕</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <section class="settings-section">
      <div class="settings-header"><h3>💳 Everyday Accounts</h3></div>
      <div class="settings-list">${acctHTML(everyday, 'everyday') || '<p class="settings-empty">No everyday accounts</p>'}</div>
      <div class="settings-add-form" id="add-everyday-form"></div>
      <button class="settings-add" id="show-add-everyday">+ Add Account</button>
    </section>

    <section class="settings-section">
      <div class="settings-header"><h3>🏦 Savings & Foreign</h3></div>
      <div class="settings-list">${acctHTML(savingsAccts, 'savings') || '<p class="settings-empty">No savings accounts</p>'}</div>
      <div class="settings-add-form" id="add-savings-form"></div>
      <button class="settings-add" id="show-add-savings">+ Add Account</button>
    </section>

    <section class="settings-section">
      <div class="settings-header"><h3>🔄 Recurring</h3></div>
      <div class="settings-list">${recurringHTML || '<p class="settings-empty">No recurring items</p>'}</div>
      <div class="settings-add-form" id="add-recurring-form"></div>
      <button class="settings-add" id="show-add-recurring">+ Add Recurring</button>
    </section>

    <section class="settings-section">
      <div class="settings-header"><h3>📊 Budgets (optional)</h3></div>
      <div class="settings-list">
        ${budgets.map(b => `<div class="settings-item"><div class="settings-item-info"><span class="settings-item-name">${b.category}</span><span class="settings-item-detail">${fmt(b.monthly_limit)}/${b.frequency||'monthly'} · alerts: ${b.alert_thresholds||'90,100'}%</span></div><button class="settings-del-budget" data-id="${b.id}">✕</button></div>`).join('') || '<p class="settings-empty">No budgets set — spending is unlimited</p>'}
      </div>
      <div class="settings-add-form" id="add-budget-form"></div>
      <button class="settings-add" id="show-add-budget">+ Set Budget</button>
    </section>
    <section class="settings-section">
      <h3>Savings Goals</h3>
      ${goals.map(g => `<div class="settings-item"><div class="settings-item-info"><span class="settings-item-name">${g.name}</span><span class="settings-item-detail">${fmt(g.current)} / ${fmt(g.target)}${g.deadline?' · by '+fmtDate(g.deadline):''}</span></div><button class="settings-del-goal" data-id="${g.id}">✕</button></div>`).join('') || '<p class="settings-empty">No goals set</p>'}
      <button class="settings-add" id="show-add-goal">+ Add Goal</button>
    </section>`;

  // Inline add forms
  document.getElementById('show-add-everyday').addEventListener('click', () => showAccountForm('add-everyday-form', 'everyday'));
  document.getElementById('show-add-savings').addEventListener('click', () => showAccountForm('add-savings-form', 'savings'));
  document.getElementById('show-add-recurring').addEventListener('click', () => showRecurringForm());

  // Budget handlers
  document.getElementById('show-add-budget').addEventListener('click', () => {
    const container = document.getElementById('add-budget-form');
    container.innerHTML = `<div class="inline-form"><div class="form-row">
      <input type="text" placeholder="Category" id="budget-cat" class="form-input" style="flex:2">
      <input type="number" placeholder="Limit ($)" id="budget-limit" class="form-input" style="flex:1">
      <select id="budget-freq" class="form-input" style="flex:1"><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly" selected>Monthly</option><option value="yearly">Yearly</option></select>
      <button class="btn-primary" id="budget-save">Set</button>
    </div><div class="form-row" style="margin-top:.3rem">
      <input type="text" placeholder="Alert at % (e.g. 50,70,90,100)" id="budget-alerts" class="form-input" value="90,100">
    </div></div>`;
    document.getElementById('budget-save').addEventListener('click', () => {
      const cat = document.getElementById('budget-cat').value;
      const limit = parseFloat(document.getElementById('budget-limit').value);
      const frequency = document.getElementById('budget-freq').value;
      const alert_thresholds = document.getElementById('budget-alerts').value;
      if (!cat || isNaN(limit)) return;
      fetch('/api/budgets', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({category: cat, monthly_limit: limit, frequency, alert_thresholds})}).then(() => renderSettings());
    });
  });
  el.querySelectorAll('.settings-del-budget').forEach(btn => {
    btn.addEventListener('click', () => fetch(`/api/budgets/${btn.dataset.id}`, {method:'DELETE'}).then(() => renderSettings()));
  });

  // Goals
  document.getElementById('show-add-goal').addEventListener('click', () => {
    const name = prompt('Goal name (e.g. "Holiday", "Emergency Fund"):');
    if (!name) return;
    const target = parseFloat(prompt('Target amount ($):'));
    if (isNaN(target)) return;
    const deadline = prompt('Deadline (YYYY-MM-DD, or leave empty):') || null;
    fetch('/api/goals', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, target, deadline})}).then(() => renderSettings());
  });
  el.querySelectorAll('.settings-del-goal').forEach(btn => {
    btn.addEventListener('click', () => fetch(`/api/goals/${btn.dataset.id}`, {method:'DELETE'}).then(() => renderSettings()));
  });

  // Edit balance
  el.querySelectorAll('.settings-edit-bal').forEach(btn => {
    btn.addEventListener('click', () => {
      const newBal = prompt(`Update balance for ${btn.dataset.name}:`, btn.dataset.bal);
      if (newBal !== null && !isNaN(parseFloat(newBal))) {
        fetch(`/api/savings/${btn.dataset.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({balance: parseFloat(newBal)})}).then(() => renderSettings());
      }
    });
  });

  // Delete account
  el.querySelectorAll('.settings-del-acct').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this account?')) {
        fetch(`/api/savings/${btn.dataset.id}`, {method:'DELETE'}).then(() => renderSettings());
      }
    });
  });

  // Delete recurring
  el.querySelectorAll('.settings-del').forEach(btn => {
    btn.addEventListener('click', () => {
      fetch(`/api/recurring/${btn.dataset.id}`, {method:'DELETE'}).then(() => renderSettings());
    });
  });

  // Toggle remind
  el.querySelectorAll('.settings-remind-rec').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const current = btn.textContent === '🔔' ? 1 : 0;
      await fetch(`/api/recurring/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({remind: current ? 0 : 1})});
      renderSettings();
    });
  });
  // Edit recurring
  el.querySelectorAll('.settings-edit-rec').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = document.getElementById('add-recurring-form');
      container.innerHTML = `
        <div class="inline-form">
          <input type="text" value="${btn.dataset.item}" id="rec-edit-item" class="form-input">
          <div class="form-row">
            <input type="number" step="0.01" value="${btn.dataset.amount}" id="rec-edit-amount" class="form-input" style="flex:2">
            <select id="rec-edit-type" class="form-input" style="flex:1">
              <option value="expense" ${btn.dataset.type==='expense'?'selected':''}>Expense</option>
              <option value="income" ${btn.dataset.type==='income'?'selected':''}>Income</option>
            </select>
          </div>
          <div class="form-row">
            <input type="text" value="${btn.dataset.cat}" id="rec-edit-cat" class="form-input" style="flex:2">
            <select id="rec-edit-freq" class="form-input" style="flex:1">
              <option value="monthly" ${btn.dataset.freq==='monthly'?'selected':''}>Monthly</option>
              <option value="weekly" ${btn.dataset.freq==='weekly'?'selected':''}>Weekly</option>
              <option value="fortnightly" ${btn.dataset.freq==='fortnightly'?'selected':''}>Fortnightly</option>
              <option value="quarterly" ${btn.dataset.freq==='quarterly'?'selected':''}>Quarterly</option>
              <option value="yearly" ${btn.dataset.freq==='yearly'?'selected':''}>Yearly</option>
            </select>
          </div>
          <div class="form-row">
            <select id="rec-edit-person" class="form-input" style="flex:1">
              <option value="shared" ${btn.dataset.person==='shared'?'selected':''}>Shared</option>
              <option value="person1" ${btn.dataset.person==='person1'?'selected':''}>Person 1</option>
              <option value="person2" ${btn.dataset.person==='person2'?'selected':''}>Person 2</option>
            </select>
            <input type="date" id="rec-edit-start" class="form-input" style="flex:1" value="${btn.dataset.start}">
          </div>
          <div class="form-row">
            <button class="btn-primary" id="rec-edit-save">Update</button>
            <button class="btn-cancel" id="rec-edit-cancel">Cancel</button>
          </div>
        </div>`;
      document.getElementById('rec-edit-cancel').addEventListener('click', () => { container.innerHTML = ''; });
      document.getElementById('rec-edit-save').addEventListener('click', () => {
        const item = document.getElementById('rec-edit-item').value;
        const amount = parseFloat(document.getElementById('rec-edit-amount').value);
        const type = document.getElementById('rec-edit-type').value;
        const cat = document.getElementById('rec-edit-cat').value || 'bills';
        const freq = document.getElementById('rec-edit-freq').value;
        const person = document.getElementById('rec-edit-person').value;
        const startDate = document.getElementById('rec-edit-start').value;
        if (!item || isNaN(amount)) return;
        const amt = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
        fetch(`/api/recurring/${btn.dataset.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({item, amount: amt, category: cat, person, frequency: freq, start_date: startDate})}).then(() => renderSettings());
      });
    });
  });
}

function showAccountForm(containerId, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="inline-form">
      <input type="text" placeholder="Account name" id="${containerId}-name" class="form-input">
      <div class="form-row">
        <input type="number" step="0.01" placeholder="Balance" id="${containerId}-bal" class="form-input" style="flex:2">
        <select id="${containerId}-cur" class="form-input" style="flex:1">
          <option value="AUD">AUD</option>
          <option value="EUR">EUR</option>
          <option value="BRL">BRL</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
        </select>
      </div>
      <div class="form-row">
        <button class="btn-primary" id="${containerId}-save">Save</button>
        <button class="btn-cancel" id="${containerId}-cancel">Cancel</button>
      </div>
    </div>`;
  document.getElementById(`${containerId}-cancel`).addEventListener('click', () => { container.innerHTML = ''; });
  document.getElementById(`${containerId}-save`).addEventListener('click', () => {
    const name = document.getElementById(`${containerId}-name`).value;
    const bal = parseFloat(document.getElementById(`${containerId}-bal`).value) || 0;
    const cur = document.getElementById(`${containerId}-cur`).value;
    if (!name) return;
    fetch('/api/savings', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({account_name: name, balance: bal, currency: cur, account_type: type})}).then(() => renderSettings());
  });
}

function showRecurringForm() {
  const container = document.getElementById('add-recurring-form');
  container.innerHTML = `
    <div class="inline-form">
      <input type="text" placeholder="Item name (e.g. Rent, Netflix)" id="rec-item" class="form-input">
      <div class="form-row">
        <input type="number" step="0.01" placeholder="Amount" id="rec-amount" class="form-input" style="flex:2">
        <select id="rec-type" class="form-input" style="flex:1">
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <div class="form-row">
        <input type="text" placeholder="Category" id="rec-cat" class="form-input" style="flex:2">
        <select id="rec-freq" class="form-input" style="flex:1">
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <div class="form-row">
        <select id="rec-person" class="form-input" style="flex:1">
          <option value="shared">Shared</option>
          <option value="person1">Person 1</option>
          <option value="person2">Person 2</option>
        </select>
        <input type="date" id="rec-start" class="form-input" style="flex:1" value="${new Date().toISOString().split('T')[0]}" title="Start date">
      </div>
      <div class="form-row">
        <button class="btn-primary" id="rec-save">Save</button>
        <button class="btn-cancel" id="rec-cancel">Cancel</button>
      </div>
    </div>`;
  document.getElementById('rec-cancel').addEventListener('click', () => { container.innerHTML = ''; });
  document.getElementById('rec-save').addEventListener('click', () => {
    const item = document.getElementById('rec-item').value;
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const type = document.getElementById('rec-type').value;
    const cat = document.getElementById('rec-cat').value || 'bills';
    const freq = document.getElementById('rec-freq').value;
    const person = document.getElementById('rec-person').value;
    const startDate = document.getElementById('rec-start').value;
    if (!item || isNaN(amount)) return;
    const amt = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
    fetch('/api/recurring', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({item, amount: amt, category: cat, person, frequency: freq, start_date: startDate})}).then(() => renderSettings());
  });
}

// Demo mode toggle (switches entire database)
const demoBtn = document.getElementById('demoBtn');
let demoActive = false;
fetch('/api/demo/status').then(r=>r.json()).then(d=>{demoActive=d.demo;updateDemoBtn()});
function updateDemoBtn() { demoBtn.classList.toggle('active', demoActive); }
demoBtn.addEventListener('click', async () => {
  const r = await fetch('/api/demo/toggle', {method:'POST'});
  const d = await r.json();
  demoActive = d.mode === 'demo';
  updateDemoBtn();
  renderPage();
});

// Roadmap modal
document.getElementById('roadmapBtn').addEventListener('click', async () => {
  const r = await fetch('/api/roadmap');
  const text = await r.text();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:600px;max-height:80vh;overflow-y:auto"><h3>🗺️ Roadmap</h3><pre style="font-size:.7rem;white-space:pre-wrap;color:var(--text);font-family:-apple-system,sans-serif;line-height:1.5">${text.replace(/</g,'&lt;')}</pre><div class="modal-actions"><button class="btn-cancel" id="rm-close" style="width:100%;margin-top:.5rem">Close</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#rm-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
});

initNav();
renderPage();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/static/sw.js');

// Drag & drop receipt upload
const dropZone=document.getElementById('dropZone');
let dragCounter=0;
document.addEventListener('dragenter',e=>{e.preventDefault();dragCounter++;dropZone.classList.add('active')});
document.addEventListener('dragleave',e=>{e.preventDefault();dragCounter--;if(dragCounter<=0){dropZone.classList.remove('active');dragCounter=0}});
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',async e=>{
  e.preventDefault();dropZone.classList.remove('active');dragCounter=0;
  const files=e.dataTransfer.files;
  if(!files.length)return;
  for(const file of files){
    const form=new FormData();form.append('file',file);
    const resp=await fetch('/api/receipt/upload',{method:'POST',body:form});
    if(resp.ok){
      const d=await resp.json();
      // Auto-process if PDF
      if(file.name.endsWith('.pdf')){
        await fetch('/api/receipt/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:d.filename})});
      }
      alert(`✓ Uploaded${file.name.endsWith('.pdf')?' & processed':''}: ${file.name}`);
      renderPage();
    }
  }
});
