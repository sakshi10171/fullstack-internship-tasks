
const CATEGORY_COLORS = {
  productive: '#00d4aa',
  neutral: '#f59e0b',
  unproductive: '#f43f5e'
};

let currentPeriod = 'today';
let allDailyStats = {};
let customClassifications = {};

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getTodayKey() { return new Date().toISOString().split('T')[0]; }

function getPeriodDays() {
  const days = currentPeriod === 'today' ? 1 : currentPeriod === 'week' ? 7 : 30;
  const keys = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().split('T')[0]);
  }
  return keys;
}

function aggregatePeriod() {
  const keys = getPeriodDays();
  const combined = {};
  
  for (const key of keys) {
    const day = allDailyStats[key] || {};
    for (const [domain, data] of Object.entries(day)) {
      if (!combined[domain]) combined[domain] = { seconds: 0, category: data.category, visits: 0 };
      combined[domain].seconds += data.seconds;
      combined[domain].visits += (data.visits || 0);
      // Apply custom classifications
      if (customClassifications[domain]) {
        combined[domain].category = customClassifications[domain];
      }
    }
  }
  return combined;
}

function updateKPIs(data) {
  let total = 0, productive = 0, neutral = 0, unproductive = 0, sites = 0;
  
  for (const d of Object.values(data)) {
    total += d.seconds;
    sites++;
    if (d.category === 'productive') productive += d.seconds;
    else if (d.category === 'neutral') neutral += d.seconds;
    else unproductive += d.seconds;
  }
  
  document.getElementById('kpiTotal').textContent = total > 0 ? formatTime(total) : '0m';
  
  const score = total > 0 ? Math.round((productive / total) * 100) : 0;
  document.getElementById('kpiScore').textContent = `${score}%`;
  document.getElementById('kpiSites').textContent = sites;
  document.getElementById('kpiWasted').textContent = formatTime(unproductive);
  
  // Donut
  const circumference = 339.3;
  let offset = 0;
  
  function setArc(id, seconds, totalSec, color) {
    const el = document.getElementById(id);
    if (!el) return;
    if (totalSec === 0) { el.setAttribute('stroke-dasharray', `0 ${circumference}`); return; }
    const pct = seconds / totalSec;
    const dash = pct * circumference;
    el.setAttribute('stroke-dasharray', `${dash} ${circumference - dash}`);
    el.setAttribute('stroke-dashoffset', -offset);
    offset += dash;
  }
  
  setArc('donutProductive', productive, total, '#00d4aa');
  setArc('donutNeutral', neutral, total, '#f59e0b');
  setArc('donutUnproductive', unproductive, total, '#f43f5e');
  
  document.getElementById('donutScore').textContent = `${score}%`;
  document.getElementById('legendProductive').textContent = formatTime(productive);
  document.getElementById('legendNeutral').textContent = formatTime(neutral);
  document.getElementById('legendUnproductive').textContent = formatTime(unproductive);
}

function updateBarChart() {
  const days = currentPeriod === 'today' ? 1 : currentPeriod === 'week' ? 7 : 14;
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().split('T')[0]);
  }
  
  let maxSecs = 0;
  const dayTotals = keys.map(key => {
    const day = allDailyStats[key] || {};
    let p = 0, n = 0, u = 0;
    for (const d of Object.values(day)) {
      const cat = customClassifications[Object.keys(day)[0]] || d.category;
      if (d.category === 'productive') p += d.seconds;
      else if (d.category === 'neutral') n += d.seconds;
      else u += d.seconds;
    }
    const total = p + n + u;
    if (total > maxSecs) maxSecs = total;
    return { key, p, n, u, total };
  });
  
  const container = document.getElementById('barChart');
  const maxHeight = 160;
  
  container.innerHTML = dayTotals.map(({ key, p, n, u, total }) => {
    const date = new Date(key + 'T12:00:00');
    const label = currentPeriod === 'today' ? 'Today' 
      : date.toLocaleDateString('en', { weekday: 'short' });
    
    const pH = maxSecs > 0 ? (p / maxSecs) * maxHeight : 0;
    const nH = maxSecs > 0 ? (n / maxSecs) * maxHeight : 0;
    const uH = maxSecs > 0 ? (u / maxSecs) * maxHeight : 0;
    
    return `
      <div class="chart-bar-group" title="${label}: ${formatTime(total)}">
        ${u > 0 ? `<div class="chart-bar u" style="height: ${uH}px"></div>` : ''}
        ${n > 0 ? `<div class="chart-bar n" style="height: ${nH}px"></div>` : ''}
        ${p > 0 ? `<div class="chart-bar p" style="height: ${pH}px"></div>` : ''}
        ${total === 0 ? `<div class="chart-bar" style="height: 2px; background: #1c1c2e"></div>` : ''}
        <div class="chart-label">${label.slice(0,3)}</div>
      </div>
    `;
  }).join('');
}

function updateTopSites(data) {
  const sites = Object.entries(data)
    .sort(([, a], [, b]) => b.seconds - a.seconds)
    .slice(0, 10);
  
  const container = document.getElementById('topSitesContainer');
  document.getElementById('topSitesPeriod').textContent = 
    currentPeriod === 'today' ? 'TODAY' : currentPeriod === 'week' ? 'THIS WEEK' : 'LAST 30 DAYS';
  
  if (sites.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">No data yet</div><div class="empty-sub">Start browsing to see analytics</div></div>`;
    return;
  }
  
  const maxSecs = sites[0]?.[1]?.seconds || 1;
  
  container.innerHTML = `
    <table class="sites-table">
      <thead>
        <tr>
          <th>Domain</th>
          <th>Category</th>
          <th class="bar-cell"></th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        ${sites.map(([domain, data]) => {
          const color = CATEGORY_COLORS[data.category] || '#6b6b8a';
          const pct = Math.round((data.seconds / maxSecs) * 100);
          const initial = domain.charAt(0).toUpperCase();
          return `
            <tr class="sites-row">
              <td>
                <div class="domain-cell">
                  <div class="domain-favicon">${initial}</div>
                  <div>
                    <div class="domain-name">${domain}</div>
                    <div class="domain-visits">${data.visits || 0} visits</div>
                  </div>
                </div>
              </td>
              <td><span class="category-pill ${data.category}">${data.category}</span></td>
              <td class="bar-cell">
                <div class="inline-bar">
                  <div class="inline-bar-fill" style="width:${pct}%; background:${color}"></div>
                </div>
              </td>
              <td class="time-cell">${formatTime(data.seconds)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function updateHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  const days = 28;
  const cells = [];
  
  // Find max for color scaling
  let maxSeconds = 1;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const day = allDailyStats[key] || {};
    const total = Object.values(day).reduce((s, d) => s + d.seconds, 0);
    if (total > maxSeconds) maxSeconds = total;
  }
  
  // Build cells in week order (fill from current day backwards)
  const today = new Date();
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - days + 1);
  
  // Pad to start of week
  const startOffset = startDay.getDay();
  for (let i = 0; i < startOffset; i++) {
    cells.push({ empty: true });
  }
  
  for (let i = 0; i < days; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const day = allDailyStats[key] || {};
    const total = Object.values(day).reduce((s, d) => s + d.seconds, 0);
    
    let p = 0;
    for (const item of Object.values(day)) {
      if (item.category === 'productive') p += item.seconds;
    }
    
    const intensity = total > 0 ? total / maxSeconds : 0;
    const score = total > 0 ? (p / total) : 0;
    
    cells.push({ total, intensity, score, key, date: d });
  }
  
  grid.innerHTML = cells.map(cell => {
    if (cell.empty) return `<div></div>`;
    
    let bg = '#1c1c2e';
    if (cell.total > 0) {
      const alpha = 0.2 + cell.intensity * 0.8;
      if (cell.score >= 0.6) bg = `rgba(0,212,170,${alpha.toFixed(2)})`;
      else if (cell.score >= 0.3) bg = `rgba(245,158,11,${alpha.toFixed(2)})`;
      else bg = `rgba(244,63,94,${alpha.toFixed(2)})`;
    }
    
    const label = cell.date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    return `<div class="heatmap-day" title="${label}: ${formatTime(cell.total)}" style="background:${bg}"></div>`;
  }).join('');
}

function updateClassifyList() {
  const container = document.getElementById('classifyList');
  const entries = Object.entries(customClassifications);
  
  if (entries.length === 0) {
    container.innerHTML = `<div class="empty" style="padding: 20px"><div class="empty-sub">Add custom rules to classify sites</div></div>`;
    return;
  }
  
  container.innerHTML = entries.map(([domain, cat]) => `
    <div class="classify-row">
      <div class="classify-left">
        <span class="category-pill ${cat}">${cat}</span>
        <span>${domain}</span>
      </div>
      <button class="btn-delete" data-domain="${domain}">✕</button>
    </div>
  `).join('');
  
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      delete customClassifications[btn.dataset.domain];
      chrome.storage.local.set({ customClassifications });
      renderAll();
    });
  });
}

function renderAll() {
  const data = aggregatePeriod();
  updateKPIs(data);
  updateBarChart();
  updateTopSites(data);
  updateHeatmap();
  updateClassifyList();
}

async function init() {
  const result = await chrome.storage.local.get(['dailyStats', 'customClassifications']);
  allDailyStats = result.dailyStats || {};
  customClassifications = result.customClassifications || {};
  renderAll();
}

// Period switching
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    
    const labels = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days' };
    document.getElementById('chartPeriodLabel').textContent = labels[currentPeriod];
    
    renderAll();
  });
});

// Add custom classification
document.getElementById('btnAddClassify').addEventListener('click', () => {
  const domain = document.getElementById('addDomain').value.trim().replace('www.', '').toLowerCase();
  const category = document.getElementById('addCategory').value;
  
  if (!domain) return;
  
  customClassifications[domain] = category;
  chrome.storage.local.set({ customClassifications });
  document.getElementById('addDomain').value = '';
  renderAll();
});

document.getElementById('addDomain').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAddClassify').click();
});

init();

// Live refresh every 10 seconds
setInterval(async () => {
  const result = await chrome.storage.local.get(['dailyStats']);
  allDailyStats = result.dailyStats || {};
  renderAll();
}, 10000);
</script>
