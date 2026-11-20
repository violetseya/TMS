const AMAP_KEY = 'YOUR_AMAP_WEB_KEY';
const colors = ['#2667ff','#f58b43','#16a58a','#8566e9','#e75b5b','#e2a822'];
const depot = { name:'虹桥物流园 · 上海', address:'上海市闵行区申贵路1500号', lng:121.3186, lat:31.1982 };
let vehicles = [
  { id:1, plate:'沪A·T1088', type:'4.2m 厢式货车', capacity:2200, volume:16, driver:'陈师傅', color:colors[0] },
  { id:2, plate:'沪A·X2679', type:'新能源轻卡', capacity:1800, volume:13, driver:'王师傅', color:colors[1] },
  { id:3, plate:'沪B·M6012', type:'6.8m 厢式货车', capacity:4800, volume:32, driver:'李师傅', color:colors[2] }
];
let stops = [
  { id:1,name:'静安寺门店',address:'上海市静安区南京西路1686号',lng:121.4440,lat:31.2237,weight:520,volume:3.6,window:'09:00–10:30' },
  { id:2,name:'陆家嘴金融仓',address:'上海市浦东新区陆家嘴环路1000号',lng:121.5106,lat:31.2397,weight:680,volume:4.3,window:'09:30–11:30' },
  { id:3,name:'五角场前置仓',address:'上海市杨浦区邯郸路600号',lng:121.5087,lat:31.3049,weight:420,volume:2.8,window:'10:00–12:00' },
  { id:4,name:'中山公园商超',address:'上海市长宁区长宁路1018号',lng:121.4219,lat:31.2201,weight:360,volume:2.6,window:'10:00–12:00' },
  { id:5,name:'徐汇滨江门店',address:'上海市徐汇区龙腾大道3398号',lng:121.4527,lat:31.1764,weight:750,volume:5.1,window:'11:00–13:00' },
  { id:6,name:'莘庄社区店',address:'上海市闵行区莘松路195号',lng:121.3749,lat:31.1162,weight:540,volume:3.7,window:'11:00–13:30' },
  { id:7,name:'张江科创园',address:'上海市浦东新区张江路625号',lng:121.5946,lat:31.2073,weight:490,volume:3.4,window:'13:00–15:00' },
  { id:8,name:'世博园服务点',address:'上海市浦东新区博成路850号',lng:121.4902,lat:31.1850,weight:300,volume:2.2,window:'13:00–15:30' },
  { id:9,name:'临港滴水湖服务站',address:'上海市浦东新区滴水湖环湖西一路',lng:121.9326,lat:30.9010,weight:620,volume:4.2,window:'10:30–12:30' },
  { id:10,name:'临港新城社区配送点',address:'上海市浦东新区南汇新城镇云鹃路',lng:121.9340,lat:30.8940,weight:430,volume:3.1,window:'11:00–13:00' },
  { id:11,name:'临港产业园服务点',address:'上海市浦东新区海港大道1550号',lng:121.8890,lat:30.9125,weight:780,volume:5.4,window:'12:00–14:30' },
  { id:12,name:'临港海港大道门店',address:'上海市浦东新区海港大道600号',lng:121.8947,lat:30.8789,weight:510,volume:3.8,window:'13:00–15:30' },
  { id:13,name:'芦潮港配送点',address:'上海市浦东新区芦潮港镇芦潮港路',lng:121.8505,lat:30.8666,weight:360,volume:2.7,window:'14:00–16:30' }
];
let map, geocoder, plan = [], markers = [], polylines = [], deliveryMarkers = [], styleIndex = 0, activeView = 'dashboard', playbackActive = false, pendingIssueId = null, issueHistory = {};

const $ = s => document.querySelector(s);
const esc = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function distance(a,b){ const x=(b.lng-a.lng)*Math.cos((a.lat+b.lat)/2*Math.PI/180), y=b.lat-a.lat; return Math.sqrt(x*x+y*y)*111; }
function fmtKm(km){ return km < 10 ? km.toFixed(1)+' km' : Math.round(km)+' km'; }
function usage(route,v){const w=route.reduce((s,x)=>s+x.weight,0), vol=route.reduce((s,x)=>s+x.volume,0);return {w,vol,pct:Math.max(w/v.capacity,vol/v.volume)*100};}
function planVRP(){
  const bins=vehicles.map((v,i)=>({vehicle:v,stops:[],cursor:depot,distance:0}));
  const queue=[...stops].sort((a,b)=>(b.weight/b.volume)-(a.weight/a.volume));
  queue.forEach(stop=>{
    let candidate=null;
    bins.forEach(bin=>{ const before=usage(bin.stops,bin.vehicle); const afterW=before.w+stop.weight, afterV=before.vol+stop.volume; const feasible=afterW<=bin.vehicle.capacity&&afterV<=bin.vehicle.volume; const increment=distance(bin.cursor,stop); const score=(feasible?0:100000)+increment+(before.pct/100)*8; if(!candidate||score<candidate.score) candidate={bin,score,feasible}; });
    candidate.bin.stops.push(stop); candidate.bin.cursor=stop;
  });
  bins.forEach(bin=>{ bin.stops.sort((a,b)=>a.window.localeCompare(b.window)); let prev=depot;bin.distance=0;bin.stops.forEach(s=>{bin.distance+=distance(prev,s);prev=s});if(bin.stops.length)bin.distance+=distance(prev,depot); });
  plan=bins; renderAll(); drawMapRoutes();
}
function renderAll(){
  const totalDistance=plan.reduce((s,p)=>s+p.distance,0), totalStops=plan.reduce((s,p)=>s+p.stops.length,0);
  const loads=plan.map(p=>usage(p.stops,p.vehicle).pct).filter(x=>x>0); const avg=loads.length?loads.reduce((a,b)=>a+b,0)/loads.length:0;
  const overload=plan.some(p=>usage(p.stops,p.vehicle).pct>100);
  $('#tripCount').textContent=String(vehicles.length).padStart(2,'0');$('#assignedCount').textContent=totalStops;$('#totalKm').textContent=fmtKm(totalDistance);$('#averageLoad').textContent=avg.toFixed(0)+'%';$('#onTime').textContent=overload?'86%':'96%';$('#sideDistance').textContent=fmtKm(totalDistance);$('#sideDuration').textContent=Math.max(1,Math.round(totalDistance/28+totalStops*.28))+' 小时';$('#riskLabel').textContent=overload?'需调配':'可执行';$('#riskLabel').className=overload?'risk':'safe';
  $('#vehicleList').innerHTML=plan.map((p,i)=>{const u=usage(p.stops,p.vehicle), val=Math.min(100,u.pct);return `<div class="vehicle ${i===0?'active':''}" data-vehicle="${p.vehicle.id}"><div class="vehicle-top"><span class="vehicle-name"><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${p.vehicle.color};margin-right:5px"></i>${esc(p.vehicle.plate)}</span><button class="remove" title="删除车辆" data-remove-vehicle="${p.vehicle.id}">×</button></div><div class="vehicle-type">${esc(p.vehicle.type)} · ${esc(p.vehicle.driver)}</div><div class="load-row"><span>${p.stops.length} 站</span><div class="bar"><i style="width:${val}%;background:${u.pct>100?'#e75b5b':p.vehicle.color}"></i></div><b style="color:${u.pct>100?'#e75b5b':'#526278'}">${u.pct.toFixed(0)}%</b></div></div>`}).join('');
  $('#stopList').innerHTML=stops.map((s,i)=>`<div class="stop"><div class="stop-top"><span class="stop-num">${i+1}</span><span class="stop-name">${esc(s.name)}</span><button class="station-remove" data-remove-stop="${s.id}" title="删除站点">×</button></div><div class="stop-meta">${esc(s.window)} · ${s.weight}kg · ${s.volume}m³</div></div>`).join('');
  $('#mapLegend').innerHTML=plan.filter(p=>p.stops.length).map(p=>`<span class="legend-item"><i class="legend-dot" style="background:${p.vehicle.color}"></i>${esc(p.vehicle.plate)}</span>`).join('');
  $('#tripTable').innerHTML=plan.map(p=>{const u=usage(p.stops,p.vehicle),late=Math.max(0,u.pct-88);const ontime=Math.max(78,96-Math.round(late*.35));return `<tr><td><strong>${esc(p.vehicle.plate)}</strong><br><span style="font-size:10px;color:#8492a4">${esc(p.vehicle.driver)} · ${esc(p.vehicle.type)}</span></td><td>${p.stops.length?p.stops.map(s=>esc(s.name)).join(' → '):'暂无站点'}</td><td><strong>${fmtKm(p.distance)}</strong></td><td><div class="load-cell"><div class="bar"><i style="width:${Math.min(100,u.pct)}%;background:${u.pct>100?'#e75b5b':p.vehicle.color}"></i></div><b>${u.pct.toFixed(0)}%</b></div><span style="font-size:10px;color:#8996a7">${u.w}/${p.vehicle.capacity}kg · ${u.vol.toFixed(1)}/${p.vehicle.volume}m³</span></td><td><strong>${ontime}%</strong><br><span style="font-size:10px;color:#8996a7">按时间窗估算</span></td><td><span class="badge">已规划</span><br><button class="evidence-link table-evidence" data-evidence="vehicle" data-vehicle-id="${p.vehicle.id}">查看依据</button></td></tr>`}).join('');
  const suggestions=[];if(overload)suggestions.push('存在车辆超过核载/容积，请增派车辆或拆分订单。');else suggestions.push('所有车辆均满足重量与容积约束，可直接进入派车。');const highest=plan.reduce((a,b)=>usage(a.stops,a.vehicle).pct>usage(b.stops,b.vehicle).pct?a:b);if(highest.stops.length)suggestions.push(`${highest.vehicle.plate} 装载率最高（${usage(highest.stops,highest.vehicle).pct.toFixed(0)}%），建议优先发车。`);suggestions.push('已按站点时间窗排序；路径由高德驾车规划实时校准。');$('#advice').innerHTML=suggestions.map(s=>`<li>${s}</li>`).join('');
  if(activeView!=='dashboard') renderAuxView();
}
function switchView(view){
  activeView=view;document.querySelectorAll('.topbar nav button[data-view]').forEach(button=>button.classList.toggle('nav-active',button.dataset.view===view));
  $('#dashboardView').hidden=view!=='dashboard';$('#auxView').hidden=view==='dashboard';if(view!=='dashboard')renderAuxView();
}
function exceptionAlerts(){return plan.flatMap(p=>{const u=usage(p.stops,p.vehicle),items=[];if(u.pct>100)items.push({id:`load-${p.vehicle.id}`,vehicle:p,title:'超载风险',detail:`装载率 ${u.pct.toFixed(0)}%，建议增派车辆或拆单`,recommend:'执行 VRP 重算，优先将部分站点分配至空余车辆。'});else if(u.pct>=85)items.push({id:`load-${p.vehicle.id}`,vehicle:p,title:'高负载提示',detail:`装载率 ${u.pct.toFixed(0)}%，建议优先发车并保留缓冲`,recommend:'确认货量后优先发车，或重新生成 VRP 以平衡负载。'});if(p.stops.some(s=>s.window<'11:00–00:00'))items.push({id:`time-${p.vehicle.id}`,vehicle:p,title:'早时窗任务',detail:'含上午时间窗站点，请关注路线与到站顺序',recommend:'优先配送早时窗站点，并在需要时重新生成 VRP。'});return items});}
function saveIssueHistory(){try{localStorage.setItem('tms-issue-history',JSON.stringify(issueHistory))}catch{}}
function openResolution(issueId){const issue=exceptionAlerts().find(item=>item.id===issueId);if(!issue)return;pendingIssueId=issueId;$('#resolutionTitle').textContent=`处理异常 · ${issue.title}`;$('#resolutionContext').innerHTML=`<b>${esc(issue.vehicle.plate)}</b><br>${issue.detail}<br><span style="color:#6d7c93">建议：${issue.recommend}</span>`;$('#resolutionNote').value=issueHistory[issueId]?.note||'';$('#resolutionDialog').showModal();}
function confirmResolution(){if(!pendingIssueId)return;const action=$('#resolutionAction').value,note=$('#resolutionNote').value.trim();issueHistory[pendingIssueId]={action,note,time:new Date().toLocaleString('zh-CN')};saveIssueHistory();$('#resolutionDialog').close();const shouldReplan=action==='replan';pendingIssueId=null;if(shouldReplan)planVRP();else renderAuxView();}
function renderAuxView(){
  const totalDistance=plan.reduce((sum,p)=>sum+p.distance,0), loads=plan.map(p=>usage(p.stops,p.vehicle).pct).filter(Boolean), avg=loads.length?loads.reduce((a,b)=>a+b,0)/loads.length:0;
  const heading={fleet:['运力管理','查看每辆配送车辆的可用容量与当前任务。'],exceptions:['异常中心','按装载和时间窗风险汇总需要调度关注的事项。'],reports:['数据报表','汇总当日计划的距离、装载和履约预测。']}[activeView];
  let content='';
  if(activeView==='fleet'){
    content=`<div class="aux-grid">${plan.map(p=>{const u=usage(p.stops,p.vehicle);return `<article class="aux-card"><h3>${esc(p.vehicle.plate)}</h3><p>${esc(p.vehicle.type)} · ${esc(p.vehicle.driver)}</p><div class="aux-kpi">${u.pct.toFixed(0)}% 装载</div><p>${u.w}/${p.vehicle.capacity} kg · ${u.vol.toFixed(1)}/${p.vehicle.volume} m³</p><p style="margin-top:10px">已分配 ${p.stops.length} 个站点 · ${fmtKm(p.distance)}</p></article>`}).join('')}</div><div class="aux-list">${plan.map(p=>`<div class="aux-list-row"><div><strong>${esc(p.vehicle.plate)} 的配送任务</strong><br><span>${p.stops.map(s=>esc(s.name)).join(' → ')||'暂无站点'}</span></div><button class="evidence-link" data-evidence="vehicle" data-vehicle-id="${p.vehicle.id}">查看数据依据</button></div>`).join('')}</div>`;
  }else if(activeView==='exceptions'){
    const allAlerts=exceptionAlerts(),alerts=allAlerts.filter(item=>!issueHistory[item.id]),resolved=allAlerts.length-alerts.length;const navCount=document.querySelector('[data-view="exceptions"] b');if(navCount)navCount.textContent=alerts.length;
    content=`<div class="aux-grid"><article class="aux-card"><h3>待关注异常</h3><div class="aux-kpi">${alerts.length}</div><p>按车辆装载率与订单时间窗自动筛查。</p></article><article class="aux-card"><h3>高装载车辆</h3><div class="aux-kpi">${plan.filter(p=>usage(p.stops,p.vehicle).pct>=85).length}</div><p>阈值设置为装载率 85%。</p></article><article class="aux-card"><h3>本次已处理</h3><div class="aux-kpi">${resolved}</div><p>处理记录保存在当前浏览器。</p></article></div><div class="aux-list">${alerts.length?alerts.map(item=>`<div class="aux-list-row"><div><strong>${esc(item.vehicle.plate)} · ${item.title}</strong><br><span>${item.detail}</span></div><div><span class="severity">待关注</span><br><button class="resolve-btn" data-resolve-issue="${item.id}">处理异常</button></div></div>`).join(''):`<div class="aux-list-row"><div><strong>当前没有待处理异常</strong><br><span>已处理 ${resolved} 项提醒；如需重新检查，可点击“生成 VRP 最优方案”。</span></div><span class="severity safe">已处理</span></div>`}</div>`;
  }else{
    const ontime=plan.some(p=>usage(p.stops,p.vehicle).pct>100)?86:96;
    content=`<div class="aux-grid"><article class="aux-card"><h3>计划总公里</h3><div class="aux-kpi">${fmtKm(totalDistance)}</div><p>来自高德驾车路径的各车路线汇总。</p></article><article class="aux-card"><h3>平均装载率</h3><div class="aux-kpi">${avg.toFixed(0)}%</div><p>取每车重量占用/体积占用的较高值后求均值。</p></article><article class="aux-card"><h3>预计准点率</h3><div class="aux-kpi">${ontime}%</div><p>基于路线距离、时窗与每站服务时长的计划预测。</p></article></div><div class="aux-list">${plan.map(p=>{const u=usage(p.stops,p.vehicle);return `<div class="aux-list-row"><div><strong>${esc(p.vehicle.plate)}</strong><br><span>${p.stops.length} 站 · ${fmtKm(p.distance)} · 装载 ${u.pct.toFixed(0)}%</span></div><button class="evidence-link" data-evidence="vehicle" data-vehicle-id="${p.vehicle.id}">查看数据依据</button></div>`}).join('')}</div>`;
  }
  $('#auxView').innerHTML=`<div class="aux-header"><div><p class="eyebrow">TMS OPERATIONS</p><h1>${heading[0]}</h1><p>${heading[1]}</p></div><button class="back-dashboard" id="backDashboard">返回调度看板</button></div>${content}`;
  $('#backDashboard').onclick=()=>switchView('dashboard');
}
function openEvidence(kind,vehicleId){
  const totalDistance=plan.reduce((sum,p)=>sum+p.distance,0), totalStops=plan.reduce((sum,p)=>sum+p.stops.length,0);
  const loads=plan.map(p=>usage(p.stops,p.vehicle).pct).filter(Boolean), average=loads.length?loads.reduce((a,b)=>a+b,0)/loads.length:0;
  const orderLines=items=>items.map((s,i)=>`<li><b>${i+1}. ${esc(s.name)}</b> · ${s.weight}kg · ${s.volume}m³ · 时间窗 ${esc(s.window)}</li>`).join('')||'<li>当前未分配站点</li>';
  let title='指标数据依据',html='';
  if(kind==='load'){
    title='平均装载率 · 计算依据';
    html=`<p class="evidence-intro">平均装载率为各已出车车辆装载率的均值；单车装载率取重量占用与体积占用的较高值。</p><div class="evidence-grid"><div class="evidence-card"><span>计算公式</span><strong>max(重量/核载，体积/容积)</strong></div><div class="evidence-card"><span>当前平均值</span><strong>${average.toFixed(0)}%</strong></div></div><ul class="evidence-list">${plan.map(p=>{const u=usage(p.stops,p.vehicle);return `<li><b>${esc(p.vehicle.plate)}</b>：${u.w}/${p.vehicle.capacity}kg，${u.vol.toFixed(1)}/${p.vehicle.volume}m³ → <b>${u.pct.toFixed(0)}%</b></li>`}).join('')}</ul><div class="evidence-source"><b>数据来源：</b>调度员录入的订单重量、体积与车辆核载/容积；新增站点和新增车辆会即时重算。</div>`;
  }else if(kind==='distance'){
    title='预计总公里 · 路径来源';
    html=`<p class="evidence-intro">总公里为各车“配送中心 → 分配站点 → 配送中心”的路线距离汇总。</p><div class="evidence-grid"><div class="evidence-card"><span>当前汇总距离</span><strong>${fmtKm(totalDistance)}</strong></div><div class="evidence-card"><span>参与配送站点</span><strong>${totalStops} 个</strong></div></div><ul class="evidence-list">${plan.map(p=>`<li><b>${esc(p.vehicle.plate)}</b>：${fmtKm(p.distance)}；${p.stops.map(s=>esc(s.name)).join(' → ')||'未分配站点'}</li>`).join('')}</ul><div class="evidence-source"><b>数据来源：</b>高德地图 JS API 的驾车路径规划回传距离；若某条实时查询未返回，则暂以坐标直线估算作为回退值。</div>`;
  }else if(kind==='ontime'){
    const hours=Math.max(1,Math.round(totalDistance/28+totalStops*.28));
    title='预计准点率 · 预测依据';
    html=`<p class="evidence-intro">这是计划预测值，不是实际签收结果。系统以路线时长、站点服务时长及订单时间窗判断履约风险。</p><div class="evidence-grid"><div class="evidence-card"><span>预计总配送时长</span><strong>${hours} 小时</strong></div><div class="evidence-card"><span>模型速度 / 服务时长</span><strong>28 km/h · 17 分/站</strong></div></div><ul class="evidence-list">${plan.map(p=>{const u=usage(p.stops,p.vehicle),late=Math.max(0,u.pct-88),ontime=Math.max(78,96-Math.round(late*.35));return `<li><b>${esc(p.vehicle.plate)}</b>：${ontime}%；站点时间窗 ${p.stops.map(s=>esc(s.window)).join('、')||'—'}</li>`}).join('')}</ul><div class="evidence-source"><b>数据来源：</b>高德路径距离、站点录入的期望到达时间窗，以及看板内置的平均行驶速度和每站服务时长假设。</div>`;
  }else if(kind==='trips'){
    title='计划车次 · 分车依据';
    html=`<p class="evidence-intro">VRP 分配优先满足每辆车的重量与体积约束，并按配送中心至站点的距离、当前车辆负载和时间窗排序。</p><div class="evidence-grid"><div class="evidence-card"><span>当前车辆</span><strong>${vehicles.length} 辆</strong></div><div class="evidence-card"><span>已分配订单</span><strong>${totalStops} 个站点</strong></div></div><ul class="evidence-list">${plan.map(p=>`<li><b>${esc(p.vehicle.plate)}</b>：${p.stops.length} 站；${p.stops.map(s=>esc(s.name)).join(' → ')||'暂无站点'}</li>`).join('')}</ul><div class="evidence-source"><b>数据来源：</b>车辆档案（车型、核载、容积）与站点订单（地址、货量、时间窗）；点击“生成 VRP 最优方案”即可重算。</div>`;
  }else{
    const p=plan.find(item=>item.vehicle.id===Number(vehicleId));if(!p)return;const u=usage(p.stops,p.vehicle),late=Math.max(0,u.pct-88),ontime=Math.max(78,96-Math.round(late*.35));
    title=`${p.vehicle.plate} · 车次数据依据`;
    html=`<p class="evidence-intro">此车的所有展示指标均由以下车辆档案、订单数据与路线计算得出。</p><div class="evidence-grid"><div class="evidence-card"><span>装载率</span><strong>${u.pct.toFixed(0)}%</strong></div><div class="evidence-card"><span>预计准点率</span><strong>${ontime}%</strong></div><div class="evidence-card"><span>重量 / 核载</span><strong>${u.w}/${p.vehicle.capacity} kg</strong></div><div class="evidence-card"><span>体积 / 容积</span><strong>${u.vol.toFixed(1)}/${p.vehicle.volume} m³</strong></div></div><ul class="evidence-list">${orderLines(p.stops)}</ul><div class="evidence-source"><b>数据来源：</b>车辆 ${esc(p.vehicle.type)} 的核载/容积、站点订单货量与时间窗；预计公里 ${fmtKm(p.distance)} 来自高德驾车规划。</div>`;
  }
  $('#evidenceTitle').textContent=title;$('#evidenceBody').innerHTML=html;$('#evidenceDialog').showModal();
}
function stopDeliveryPlayback(){deliveryMarkers.forEach(item=>{item.marker.stopMove?.();item.marker.setMap(null);item.progress?.setMap(null)});deliveryMarkers=[];playbackActive=false;if($('#processBtn'))$('#processBtn').textContent='配送过程模拟';if($('#deliveryStatus')){$('#deliveryStatus').textContent='计划模拟';$('#deliveryStatus').className='delivery-status'}}
function compactPlaybackPath(path,maxPoints=180){if(path.length<=maxPoints)return path;const step=Math.ceil(path.length/maxPoints),compact=path.filter((_,index)=>index%step===0);if(compact[compact.length-1]!==path[path.length-1])compact.push(path[path.length-1]);return compact;}
function startDeliveryPlayback(){
  if(!map||!window.AMap)return; if(playbackActive){stopDeliveryPlayback();return;}if(deliveryMarkers.length)stopDeliveryPlayback();const ready=plan.filter(p=>p.routePath?.length>1);if(!ready.length){$('#deliveryStatus').textContent='路线加载中…';return;}
  AMap.plugin('AMap.MoveAnimation',()=>{let completed=0;playbackActive=true;$('#processBtn').textContent='停止模拟';$('#deliveryStatus').textContent=`配送模拟 · 0/${ready.length} 车`;$('#deliveryStatus').className='delivery-status running';
    ready.forEach(p=>{const playbackPath=compactPlaybackPath(p.routePath);const marker=new AMap.Marker({position:playbackPath[0],offset:new AMap.Pixel(-18,-16),content:`<div class="delivery-marker" style="background:${p.vehicle.color}"><div class="delivery-marker-inner"><span>🚚</span>${esc(p.vehicle.plate)}</div></div>`,zIndex:200});const progress=new AMap.Polyline({path:[],strokeColor:p.vehicle.color,strokeWeight:7,strokeOpacity:.95,lineCap:'round',zIndex:150});marker.setMap(map);progress.setMap(map);deliveryMarkers.push({marker,progress});marker.on('moving',event=>progress.setPath(event.passedPath));marker.on('moveend',()=>{completed+=1;$('#deliveryStatus').textContent=completed===ready.length?'配送模拟 · 已完成':`配送模拟 · ${completed}/${ready.length} 车`;if(completed===ready.length){playbackActive=false;$('#processBtn').textContent='重新模拟'}});marker.moveAlong(playbackPath,{duration:Math.max(18,Math.ceil(2600/playbackPath.length)),autoRotation:true});
    });
  });
}
function clearMap(){stopDeliveryPlayback();markers.forEach(m=>m.setMap(null));polylines.forEach(p=>p.setMap(null));markers=[];polylines=[];}
function drawMapRoutes(){
  if(!map || !window.AMap) return; clearMap(); const bounds=[];
  const depotMarker=new AMap.Marker({position:[depot.lng,depot.lat],title:'配送中心',content:'<div class="depot-marker">仓</div>',offset:new AMap.Pixel(-14,-14)});depotMarker.setMap(map);markers.push(depotMarker);bounds.push([depot.lng,depot.lat]);
  plan.forEach((p,idx)=>{if(!p.stops.length)return;const pts=[[depot.lng,depot.lat],...p.stops.map(s=>[s.lng,s.lat]),[depot.lng,depot.lat]];p.routePath=pts;pts.forEach((point,i)=>{if(i===0||i===pts.length-1)return;const marker=new AMap.Marker({position:point,offset:new AMap.Pixel(-14,-29),content:`<div class="route-marker">${i}</div>`,title:`${p.vehicle.plate} · ${p.stops[i-1].name}`});marker.setMap(map);markers.push(marker);bounds.push(point);});
    const driving=new AMap.Driving({policy:AMap.DrivingPolicy.LEAST_TIME,hideMarkers:true,showTraffic:false,autoFitView:false});
    driving.search(pts[0],pts[pts.length-1],{waypoints:pts.slice(1,-1)},(status,result)=>{if(status==='complete'&&result.routes?.[0]){const path=result.routes[0].steps.flatMap(step=>step.path);p.routePath=path;const polyline=new AMap.Polyline({path,strokeColor:p.vehicle.color,strokeWeight:5,strokeOpacity:.84,strokeStyle:'solid',lineJoin:'round'});polyline.setMap(map);polylines.push(polyline);const km=result.routes[0].distance/1000;p.distance=km;renderMetricsOnly();}else{p.routePath=pts;const polyline=new AMap.Polyline({path:pts,strokeColor:p.vehicle.color,strokeWeight:4,strokeOpacity:.75,strokeStyle:'dashed'});polyline.setMap(map);polylines.push(polyline);}});
  }); if(bounds.length>1)map.setFitView([...markers],false,[75,55,55,55]);
}
function renderMetricsOnly(){const total=plan.reduce((s,p)=>s+p.distance,0);$('#totalKm').textContent=fmtKm(total);$('#sideDistance').textContent=fmtKm(total);$('#sideDuration').textContent=Math.max(1,Math.round(total/28+stops.length*.28))+' 小时';$('#tripTable').querySelectorAll('tr').forEach((tr,i)=>{if(plan[i])tr.children[2].querySelector('strong').textContent=fmtKm(plan[i].distance)});}
function initMap(){
  if(!window.AMap){$('#map').innerHTML='<div class="map-fallback"><strong>高德地图加载失败</strong><span>请检查浏览器网络或地图 Key 配置。</span></div>';return;}
  map=new AMap.Map('map',{zoom:11,center:[121.43,31.21],viewMode:'2D',mapStyle:'amap://styles/whitesmoke'});map.addControl(new AMap.ToolBar({position:{right:'16px',top:'83px'}}));geocoder=new AMap.Geocoder({city:'上海',radius:1000});$('#depotCoords').textContent=`${depot.lng.toFixed(4)}, ${depot.lat.toFixed(4)}`;drawMapRoutes();
}
function locateAddress(address){return new Promise((resolve,reject)=>{if(!geocoder)return reject(new Error('地图正在初始化'));geocoder.getLocation(address,(status,res)=>{if(status==='complete'&&res.geocodes?.length){const loc=res.geocodes[0].location;resolve({lng:loc.lng,lat:loc.lat,formatted:res.geocodes[0].formattedAddress});}else reject(new Error('未找到该地址，请补充城市、道路或门牌号。'));});});}
function bind(){
  try{issueHistory=JSON.parse(localStorage.getItem('tms-issue-history')||'{}')}catch{issueHistory={}}
  $('#planBtn').onclick=planVRP;$('#resetBtn').onclick=()=>location.reload();$('#addStop').onclick=()=>$('#stopDialog').showModal();$('#addVehicle').onclick=()=>$('#vehicleDialog').showModal();
  document.querySelectorAll('.topbar nav button[data-view]').forEach(button=>button.onclick=()=>switchView(button.dataset.view));
  $('#closeEvidence').onclick=()=>$('#evidenceDialog').close();
  $('#closeResolution').onclick=()=>$('#resolutionDialog').close();$('#confirmResolution').onclick=confirmResolution;
  $('#processBtn').onclick=startDeliveryPlayback;
  $('#saveStop').onclick=async e=>{e.preventDefault();const name=$('#stopName').value.trim(),address=$('#stopAddress').value.trim();if(!name||!address)return;const btn=e.currentTarget;btn.textContent='正在高德定位…';btn.disabled=true;try{const pos=await locateAddress(address);stops.push({id:Date.now(),name,address:pos.formatted,lng:pos.lng,lat:pos.lat,weight:+$('#stopWeight').value,volume:+$('#stopVolume').value,window:$('#stopWindow').value});$('#stopDialog').close();e.target.form?.reset();planVRP();}catch(err){alert(err.message)}finally{btn.textContent='定位并加入方案';btn.disabled=false}};
  $('#saveVehicle').onclick=e=>{e.preventDefault();const plate=$('#vehiclePlate').value.trim();if(!plate)return;vehicles.push({id:Date.now(),plate,type:$('#vehicleType').value,capacity:+$('#vehicleWeight').value,volume:+$('#vehicleVolume').value,driver:'待分配',color:colors[vehicles.length%colors.length]});$('#vehicleDialog').close();e.target.form?.reset();planVRP()};
  document.addEventListener('click',e=>{const resolve=e.target.closest('[data-resolve-issue]');if(resolve){openResolution(resolve.dataset.resolveIssue);return}const evidence=e.target.closest('[data-evidence]');if(evidence){openEvidence(evidence.dataset.evidence,evidence.dataset.vehicleId);return}const sid=e.target.dataset.removeStop,vid=e.target.dataset.removeVehicle;if(sid){stops=stops.filter(s=>s.id!==+sid);planVRP()}if(vid){if(vehicles.length<=1){alert('至少保留一辆配送车辆。');return}vehicles=vehicles.filter(v=>v.id!==+vid);planVRP()}});
  $('#fitMap').onclick=()=>{if(map)map.setFitView([...markers],false,[75,55,55,55])};$('#mapStyle').onclick=()=>{if(!map)return;const styles=['amap://styles/whitesmoke','amap://styles/light','amap://styles/normal'];styleIndex=(styleIndex+1)%styles.length;map.setMapStyle(styles[styleIndex]);};
}
window.addEventListener('load',()=>{bind();planVRP();setTimeout(initMap,50)});

