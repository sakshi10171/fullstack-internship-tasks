// FocusLens Popup Script

const CATEGORY_COLORS = {
  productive: '#00d4aa',
  neutral: '#f59e0b',
  unproductive: '#f43f5e',
  system: '#6b6b8a'
};

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function formatSessionTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

async function loadPopup() {
  // Get current tracking info
  chrome.runtime.sendMessage({ type: 'GET_CURRENT' }, (response) => {
    if (response) {
      const domain = document.getElementById('currentDomain');
      const category = document.getElementById('currentCategory');
      
      domain.textContent = response.domain || 'No active tab';
      category.textContent = response.category 
        ? (response.category.charAt(0).toUpperCase() + response.category.slice(1)) 
        : '—';
      
      if (response.category) {
        category.className = `category-badge ${response.category}`;
      }
      
      // Update session time every second
      let sessionSecs = response.sessionSeconds || 0;
      document.getElementById('sessionTime').textContent = formatSessionTime(sessionSecs);
      
      setInterval(() => {
        sessionSecs++;
        document.getElementById('sessionTime').textContent = formatSessionTime(sessionSecs);
      }, 1000);
    }
  });

  // Load today's stats
  const today = getTodayKey();
  const result = await chrome.storage.local.get(['dailyStats']);
  const todayData = (result.dailyStats || {})[today] || {};
  
  let totalSeconds = 0;
  let productiveSeconds = 0;
  let neutralSeconds = 0;
  let unproductiveSeconds = 0;
  let siteCount = 0;
  
  for (const [domain, data] of Object.entries(todayData)) {
    totalSeconds += data.seconds;
    siteCount++;
    if (data.category === 'productive') productiveSeconds += data.seconds;
    else if (data.category === 'neutral') neutralSeconds += data.seconds;
    else if (data.category === 'unproductive') unproductiveSeconds += data.seconds;
  }
  
  // Update summary cards
  const totalHrs = totalSeconds / 3600;
  document.getElementById('totalHours').textContent = totalHrs >= 1 
    ? `${totalHrs.toFixed(1)}h` 
    : `${Math.round(totalSeconds / 60)}m`;
  
  const score = totalSeconds > 0 
    ? Math.round((productiveSeconds / totalSeconds) * 100) 
    : 0;
  
  const scoreEl = document.getElementById('productivityScore');
  scoreEl.textContent = `${score}%`;
  scoreEl.className = 'score-value ' + (score >= 60 ? 'good' : score >= 30 ? 'mid' : 'bad');
  
  document.getElementById('sitesVisited').textContent = siteCount;
  
  // Update productivity bar
  if (totalSeconds > 0) {
    document.getElementById('barProductive').style.width = `${(productiveSeconds / totalSeconds) * 100}%`;
    document.getElementById('barNeutral').style.width = `${(neutralSeconds / totalSeconds) * 100}%`;
    document.getElementById('barUnproductive').style.width = `${(unproductiveSeconds / totalSeconds) * 100}%`;
  }
  
  // Top sites
  const sites = Object.entries(todayData)
    .sort(([, a], [, b]) => b.seconds - a.seconds)
    .slice(0, 5);
  
  const container = document.getElementById('topSites');
  
  if (sites.length === 0) {
    container.innerHTML = '<div class="no-data">No data yet — start browsing!</div>';
    return;
  }
  
  const maxSeconds = sites[0]?.[1]?.seconds || 1;
  
  container.innerHTML = sites.map(([domain, data]) => {
    const color = CATEGORY_COLORS[data.category] || '#6b6b8a';
    const pct = Math.round((data.seconds / maxSeconds) * 100);
    return `
      <div class="site-row">
        <div class="site-dot" style="background: ${color}"></div>
        <div class="site-info">
          <div class="site-domain">${domain}</div>
          <div class="site-bar">
            <div class="site-bar-fill" style="width: ${pct}%; background: ${color}"></div>
          </div>
        </div>
        <div class="site-time">${formatTime(data.seconds)}</div>
      </div>
    `;
  }).join('');
}

// Button listeners
document.getElementById('btnDashboard').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
  window.close();
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('Clear all tracked data? This cannot be undone.')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_DATA' }, () => {
      loadPopup();
    });
  }
});

// Load on startup
loadPopup();
