// ==========================================
// FocusLens Background Service Worker
// ==========================================

// Website classification database
const SITE_CATEGORIES = {
  productive: {
    color: '#00d4aa',
    label: 'Productive',
    sites: [
      'github.com', 'gitlab.com', 'stackoverflow.com', 'developer.mozilla.org',
      'docs.google.com', 'notion.so', 'figma.com', 'linear.app', 'jira.atlassian.com',
      'trello.com', 'asana.com', 'leetcode.com', 'hackerrank.com', 'codepen.io',
      'replit.com', 'vercel.com', 'netlify.com', 'aws.amazon.com', 'cloud.google.com',
      'azure.microsoft.com', 'npmjs.com', 'pypi.org', 'medium.com', 'dev.to',
      'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'pluralsight.com',
      'docs.anthropic.com', 'openai.com', 'huggingface.co', 'kaggle.com',
      'confluence.atlassian.com', 'slack.com', 'zoom.us', 'meet.google.com',
      'calendar.google.com', 'gmail.com', 'outlook.com', 'drive.google.com'
    ]
  },
  neutral: {
    color: '#f59e0b',
    label: 'Neutral',
    sites: [
      'google.com', 'bing.com', 'duckduckgo.com', 'wikipedia.org', 'news.ycombinator.com',
      'reddit.com', 'quora.com', 'amazon.com', 'ebay.com', 'maps.google.com',
      'weather.com', 'translate.google.com', 'arxiv.org', 'researchgate.net'
    ]
  },
  unproductive: {
    color: '#f43f5e',
    label: 'Unproductive',
    sites: [
      'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
      'snapchat.com', 'pinterest.com', 'tumblr.com', 'reddit.com/r/memes',
      'youtube.com', 'netflix.com', 'twitch.tv', 'disneyplus.com', 'hulu.com',
      'primevideo.com', 'hbomax.com', 'peacocktv.com', 'espn.com', 'nfl.com',
      'buzzfeed.com', 'dailymail.co.uk', 'tmz.com', 'perez.com'
    ]
  }
};

// Track current state
let activeTabId = null;
let activeUrl = null;
let sessionStart = null;
let trackingInterval = null;

// Get category for a URL
function classifyUrl(url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return 'system';
  
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    for (const [category, data] of Object.entries(SITE_CATEGORIES)) {
      if (data.sites.some(site => hostname === site || hostname.endsWith('.' + site))) {
        return category;
      }
    }
    
    return 'neutral'; // default
  } catch {
    return 'system';
  }
}

// Get domain from URL
function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Get today's date key
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Get week key (year + week number)
function getWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}

// Save time for current session
async function saveSession(url, seconds) {
  if (!url || seconds < 1 || url.startsWith('chrome://')) return;
  
  const domain = getDomain(url);
  const category = classifyUrl(url);
  const today = getTodayKey();
  const week = getWeekKey();
  
  const result = await chrome.storage.local.get(['dailyStats', 'weeklyStats', 'allTime']);
  
  let dailyStats = result.dailyStats || {};
  let weeklyStats = result.weeklyStats || {};
  let allTime = result.allTime || {};
  
  // Daily stats
  if (!dailyStats[today]) dailyStats[today] = {};
  if (!dailyStats[today][domain]) dailyStats[today][domain] = { seconds: 0, category, visits: 0 };
  dailyStats[today][domain].seconds += seconds;
  dailyStats[today][domain].category = category;
  
  // Weekly stats
  if (!weeklyStats[week]) weeklyStats[week] = {};
  if (!weeklyStats[week][domain]) weeklyStats[week][domain] = { seconds: 0, category, visits: 0 };
  weeklyStats[week][domain].seconds += seconds;
  weeklyStats[week][domain].category = category;
  
  // All time
  if (!allTime[domain]) allTime[domain] = { seconds: 0, category, visits: 0 };
  allTime[domain].seconds += seconds;
  allTime[domain].category = category;
  
  // Keep only last 30 days of daily stats
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  for (const key of Object.keys(dailyStats)) {
    if (new Date(key) < cutoff) delete dailyStats[key];
  }
  
  // Keep only last 12 weeks
  const weekKeys = Object.keys(weeklyStats).sort();
  if (weekKeys.length > 12) {
    for (const old of weekKeys.slice(0, weekKeys.length - 12)) {
      delete weeklyStats[old];
    }
  }
  
  await chrome.storage.local.set({ dailyStats, weeklyStats, allTime });
}

// Record a visit
async function recordVisit(url) {
  if (!url || url.startsWith('chrome://')) return;
  const domain = getDomain(url);
  const today = getTodayKey();
  
  const result = await chrome.storage.local.get(['dailyStats']);
  let dailyStats = result.dailyStats || {};
  if (!dailyStats[today]) dailyStats[today] = {};
  if (!dailyStats[today][domain]) dailyStats[today][domain] = { seconds: 0, category: classifyUrl(url), visits: 0 };
  dailyStats[today][domain].visits += 1;
  await chrome.storage.local.set({ dailyStats });
}

// Start tracking a URL
function startTracking(tabId, url) {
  stopTracking(); // Stop any existing session
  
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return;
  
  activeTabId = tabId;
  activeUrl = url;
  sessionStart = Date.now();
  recordVisit(url);
  
  // Save every 5 seconds
  trackingInterval = setInterval(async () => {
    if (activeUrl && sessionStart) {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      await saveSession(activeUrl, elapsed);
      sessionStart = Date.now(); // Reset to avoid double-counting
    }
  }, 5000);
}

// Stop tracking
function stopTracking() {
  if (activeUrl && sessionStart) {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    if (elapsed > 0) saveSession(activeUrl, elapsed);
  }
  
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  
  activeTabId = null;
  activeUrl = null;
  sessionStart = null;
}

// Tab event listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    startTracking(activeInfo.tabId, tab.url);
  } catch {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    startTracking(tabId, changeInfo.url);
  } else if (changeInfo.status === 'complete' && tab.active) {
    startTracking(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) stopTracking();
});

// Window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopTracking();
  } else {
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab) startTracking(tab.id, tab.url);
    } catch {}
  }
});

// Idle state changes
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    stopTracking();
  } else if (state === 'active') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) startTracking(tabs[0].id, tabs[0].url);
    });
  }
});

// Set idle detection threshold (5 minutes)
chrome.idle.setDetectionInterval(300);

// Weekly report alarm
chrome.alarms.create('weeklyReport', { periodInMinutes: 10080 }); // 7 days

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'weeklyReport') {
    const week = getWeekKey();
    const result = await chrome.storage.local.get(['weeklyStats']);
    const weekData = (result.weeklyStats || {})[week] || {};
    
    let totalSeconds = 0;
    let productiveSeconds = 0;
    
    for (const site of Object.values(weekData)) {
      totalSeconds += site.seconds;
      if (site.category === 'productive') productiveSeconds += site.seconds;
    }
    
    const score = totalSeconds > 0 ? Math.round((productiveSeconds / totalSeconds) * 100) : 0;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '📊 Weekly Productivity Report',
      message: `This week: ${Math.round(totalSeconds / 3600)}h tracked. Productivity score: ${score}%. Open FocusLens for full report.`
    });
  }
});

// Message handler for popup/dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT') {
    sendResponse({
      url: activeUrl,
      domain: activeUrl ? getDomain(activeUrl) : null,
      category: activeUrl ? classifyUrl(activeUrl) : null,
      sessionSeconds: sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0
    });
  } else if (message.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
  } else if (message.type === 'CLEAR_DATA') {
    chrome.storage.local.clear(() => sendResponse({ success: true }));
    return true;
  }
  return true;
});

console.log('FocusLens background worker started');
