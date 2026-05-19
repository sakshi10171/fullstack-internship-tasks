// FocusLens Content Script
// Runs on every page to detect activity and page visibility

let isVisible = !document.hidden;
let lastActivity = Date.now();

// Track page visibility
document.addEventListener('visibilitychange', () => {
  isVisible = !document.hidden;
  chrome.runtime.sendMessage({ 
    type: 'VISIBILITY_CHANGE', 
    visible: isVisible,
    url: window.location.href
  }).catch(() => {});
});

// Track user activity (throttled)
let activityTimeout;
function onActivity() {
  lastActivity = Date.now();
  if (activityTimeout) return;
  activityTimeout = setTimeout(() => {
    activityTimeout = null;
    chrome.runtime.sendMessage({ 
      type: 'USER_ACTIVE',
      url: window.location.href
    }).catch(() => {});
  }, 10000); // Throttle to every 10s
}

document.addEventListener('mousemove', onActivity, { passive: true });
document.addEventListener('keydown', onActivity, { passive: true });
document.addEventListener('scroll', onActivity, { passive: true });
document.addEventListener('click', onActivity, { passive: true });
