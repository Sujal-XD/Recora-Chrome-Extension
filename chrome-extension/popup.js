// =============================================================================
// popup.js — UI only. All recording logic lives in background.js.
// The popup syncs state on open, sends commands, and listens for updates.
// =============================================================================

// --- Element References ---
const signInBtn        = document.getElementById('signInBtn');
const logoutBtn        = document.getElementById('logoutBtn');
const recordBtn        = document.getElementById('recordBtn');
const userInfoDiv      = document.getElementById('userInfo');
const statusDiv        = document.getElementById('status');
const loginSection     = document.getElementById('loginSection');
const recorderSection  = document.getElementById('recorderSection');
const micIcon          = document.getElementById('micIcon');
const squareIcon       = document.getElementById('squareIcon');
const timerDisplay     = document.getElementById('timerDisplay');
const consentSection   = document.getElementById('consentSection');
const consentCheckbox  = document.getElementById('consentCheckbox');
const acceptConsentBtn = document.getElementById('acceptConsentBtn');
const tcLink           = document.getElementById('tcLink');
const pauseBtn         = document.getElementById('pauseBtn');
const pauseIcon        = document.getElementById('pauseIcon');
const resumeIcon       = document.getElementById('resumeIcon');
const pauseBtnText     = document.getElementById('pauseBtnText');
// --- Pre-recording form refs ---
const recPreRecordForm = document.getElementById('recPreRecordForm');
const recTitleInput    = document.getElementById('recTitleInput');
const recDescInput     = document.getElementById('recDescInput');
// --- History element refs ---
const navHistory            = document.getElementById('navHistory');
const historySection        = document.getElementById('historySection');
const histListView          = document.getElementById('histListView');
const histTranscriptView    = document.getElementById('histTranscriptView');
const histSummaryView       = document.getElementById('histSummaryView');
const histCardsList         = document.getElementById('histCardsList');
const histTranscriptContent = document.getElementById('histTranscriptContent');
const histSummaryContent    = document.getElementById('histSummaryContent');
const histRefreshBtn        = document.getElementById('histRefreshBtn');
const histBackFromTranscript = document.getElementById('histBackFromTranscript');
const histBackFromSummary   = document.getElementById('histBackFromSummary');
// --- Calendar element refs ---
const mainNav           = document.getElementById('mainNav');
const navRecord         = document.getElementById('navRecord');
const navCalendar       = document.getElementById('navCalendar');
const calendarSection   = document.getElementById('calendarSection');
const calEventsView     = document.getElementById('calEventsView');
const calDetailView     = document.getElementById('calDetailView');
const calCreateView     = document.getElementById('calCreateView');
const calEventsList     = document.getElementById('calEventsList');
const calDetailContent  = document.getElementById('calDetailContent');
const calRefreshBtn     = document.getElementById('calRefreshBtn');
const calNewEventBtn    = document.getElementById('calNewEventBtn');
const calBackFromDetail  = document.getElementById('calBackFromDetail');
const calDeleteEventBtn  = document.getElementById('calDeleteEventBtn');
const calBackFromCreate = document.getElementById('calBackFromCreate');
const calRecordEventBtn = document.getElementById('calRecordEventBtn');
const calCreateForm     = document.getElementById('calCreateForm');
const calEvtTitle       = document.getElementById('calEvtTitle');
const calEvtDate        = document.getElementById('calEvtDate');
const calEvtStart       = document.getElementById('calEvtStart');
const calEvtEnd         = document.getElementById('calEvtEnd');
const calEvtAllDay      = document.getElementById('calEvtAllDay');
const calEvtLocation    = document.getElementById('calEvtLocation');
const calEvtDesc        = document.getElementById('calEvtDesc');
const calTimeRow        = document.getElementById('calTimeRow');
const calCreateSubmit   = document.getElementById('calCreateSubmit');

// ---------------------------------------------------------------------------
// Local UI state
// ---------------------------------------------------------------------------
let currentUser   = null;
let hasConsent    = false;
let isRecording   = false;
let isPaused      = false;
let timerInterval = null;
let elapsedBase   = 0;   // ms already elapsed when popup opened mid-recording
let timerStart    = null; // Date.now() when we last started counting locally
// Calendar state
let calEvents       = [];
let activeCalEvent  = null;
let activeTab       = 'record'; // 'record' | 'calendar'

// ---------------------------------------------------------------------------
// Timer helpers (display only — source of truth is background.js)
// ---------------------------------------------------------------------------
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startLocalTimer(initialElapsedMs = 0) {
  stopLocalTimer();
  elapsedBase = initialElapsedMs;
  timerStart  = Date.now();
  timerDisplay.textContent = formatTime(elapsedBase);
  timerInterval = setInterval(() => {
    timerDisplay.textContent = formatTime(elapsedBase + (Date.now() - timerStart));
  }, 500);
}

function stopLocalTimer() {
  clearInterval(timerInterval);
  timerInterval  = null;
  timerStart     = null;
  timerDisplay.textContent = '00:00';
}

function freezeLocalTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerStart    = null;
  // leave timerDisplay showing its current value
}

// ---------------------------------------------------------------------------
// UI state helpers
// ---------------------------------------------------------------------------
function setRecordingUI(recording) {
  isRecording = recording;
  if (recording) {
    recPreRecordForm.style.display = 'none';
    recordBtn.classList.replace('idle', 'recording');
    micIcon.style.display    = 'none';
    squareIcon.style.display = 'block';
    statusDiv.textContent    = 'Recording...';
    pauseBtn.style.display   = 'flex';
  } else {
    recPreRecordForm.style.display = 'flex';
    recordBtn.classList.replace('recording', 'idle');
    recordBtn.classList.remove('paused');
    timerDisplay.classList.remove('timer-paused');
    micIcon.style.display    = 'block';
    squareIcon.style.display = 'none';
    pauseBtn.style.display   = 'none';
    isPaused = false;
    stopLocalTimer();
  }
}

function setPausedUI(paused) {
  isPaused = paused;
  if (paused) {
    recordBtn.classList.add('paused');
    timerDisplay.classList.add('timer-paused');
    pauseBtn.classList.add('paused');
    pauseIcon.style.display  = 'none';
    resumeIcon.style.display = 'block';
    pauseBtnText.textContent = 'Resume';
    statusDiv.textContent    = 'Paused';
    freezeLocalTimer();
  } else {
    recordBtn.classList.remove('paused');
    timerDisplay.classList.remove('timer-paused');
    pauseBtn.classList.remove('paused');
    pauseIcon.style.display  = 'block';
    resumeIcon.style.display = 'none';
    pauseBtnText.textContent = 'Pause';
    statusDiv.textContent    = 'Recording...';
  }
}

function showTab(tab) {
  activeTab = tab;
  chrome.storage.local.set({ lastActiveTab: tab });
  navRecord.classList.toggle('active',   tab === 'record');
  navCalendar.classList.toggle('active', tab === 'calendar');
  navHistory.classList.toggle('active',  tab === 'history');
  recorderSection.style.display = tab === 'record'   ? 'flex' : 'none';
  calendarSection.style.display = tab === 'calendar' ? 'flex' : 'none';
  historySection.style.display  = tab === 'history'  ? 'flex' : 'none';
}

function renderProfileBtn(user) {
  const photoHtml = user.picture
    ? `<img class="profile-avatar" src="${escapeHtml(user.picture)}" alt="">`
    : `<div class="profile-initials">${escapeHtml((user.name || 'U')[0].toUpperCase())}</div>`;

  const photoLgHtml = user.picture
    ? `<img class="profile-dropdown-photo" src="${escapeHtml(user.picture)}" alt="">`
    : `<div class="profile-dropdown-photo-initials">${escapeHtml((user.name || 'U')[0].toUpperCase())}</div>`;

  userInfoDiv.innerHTML = `
    <button class="profile-btn" id="profileAvatarBtn">${photoHtml}</button>
    <div class="profile-dropdown" id="profileDropdown">
      <div class="profile-dropdown-header">
        ${photoLgHtml}
        <div class="profile-dropdown-meta">
          <div class="profile-dropdown-name">${escapeHtml(user.name || '')}</div>
          <div class="profile-dropdown-email">${escapeHtml(user.email || '')}</div>
        </div>
      </div>
      <div class="profile-dropdown-divider"></div>
      <button class="profile-signout-btn" id="profileSignOutBtn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        Sign out
      </button>
    </div>`;

  document.getElementById('profileAvatarBtn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('open');
  };

  document.getElementById('profileSignOutBtn').onclick = () => {
    document.getElementById('profileDropdown').classList.remove('open');
    handleLogout();
  };
}

function updateUI(user) {
  if (user) {
    loginSection.style.display = 'none';
    renderProfileBtn(user);
    chrome.storage.local.get(['hasRecordingConsent', 'lastActiveTab'], (result) => {
      hasConsent = result.hasRecordingConsent || false;
      if (hasConsent) {
        mainNav.style.display        = 'flex';
        consentSection.style.display = 'none';
        const tab = result.lastActiveTab || 'record';
        showTab(tab);
        syncWithBackground();
        if (tab === 'calendar') loadCalendar();
        if (tab === 'history')  loadHistory();
      } else {
        mainNav.style.display         = 'none';
        recorderSection.style.display = 'none';
        calendarSection.style.display = 'none';
        consentSection.style.display  = 'flex';
        acceptConsentBtn.disabled     = !consentCheckbox.checked;
      }
    });
  } else {
    loginSection.style.display     = 'flex';
    recorderSection.style.display  = 'none';
    calendarSection.style.display  = 'none';
    historySection.style.display   = 'none';
    consentSection.style.display   = 'none';
    mainNav.style.display          = 'none';
    userInfoDiv.innerHTML          = '';
  }
}

// ---------------------------------------------------------------------------
// Sync with background on popup open
// ---------------------------------------------------------------------------
function syncWithBackground() {
  chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response) => {
    // Consume any port-closed error (background service worker may be sleeping)
    if (chrome.runtime.lastError) return;
    if (!response) return;
    if (response.isRecording) {
      setRecordingUI(true);
      if (response.isPaused) {
        setPausedUI(true);
        timerDisplay.textContent = formatTime(response.elapsedMs || 0);
      } else {
        setPausedUI(false);
        startLocalTimer(response.elapsedMs);
      }
    } else {
      setRecordingUI(false);
    }
  });
}

// ---------------------------------------------------------------------------
// Listen for push updates from background (upload progress, errors, etc.)
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== 'recordingStateUpdate') return false; // always return false — no async response

  switch (message.status) {
    case 'recording':
      setRecordingUI(true);
      setPausedUI(false);
      startLocalTimer(message.elapsedMs || 0);
      break;
    case 'paused':
      setPausedUI(true);
      timerDisplay.textContent = formatTime(message.elapsedMs || 0);
      break;
    case 'resumed':
      setPausedUI(false);
      startLocalTimer(message.elapsedMs || 0);
      break;
    case 'uploading':
      setRecordingUI(false);
      statusDiv.textContent = 'Processing & uploading...';
      break;
    case 'upload_success':
      statusDiv.textContent = 'Upload successful!';
      break;
    case 'upload_failed':
      statusDiv.textContent = `Upload failed: ${message.error || 'Unknown error'}`;
      break;
    case 'recording_error':
      setRecordingUI(false);
      statusDiv.textContent = `Recording failed: ${message.error || 'Unknown error'}`;
      break;
    case 'transcribing':
      statusDiv.textContent = 'Transcribing...';
      break;
    case 'transcription_done':
      statusDiv.textContent = 'Ready';
      // Always reload history — background may have synced new data to Azure
      // regardless of which tab is currently active.
      loadHistory();
      if (activeTab !== 'history') showTab('history');
      // Push completed recording to Azure — filter to current user only to
      // prevent cross-account contamination in the Azure recordings.json.
      chrome.storage.local.get(['recordings'], (r) => {
        const userRecs = (r.recordings || []).filter(rec => rec.userId === currentUser?.sub);
        azureSyncRecordings(userRecs);
      });
      break;
  }

  return false; // no sendResponse needed
});

// ---------------------------------------------------------------------------
// Record button
// ---------------------------------------------------------------------------
recordBtn.onclick = async () => {
  if (isRecording) {
    // Tell background to stop
    chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (!response?.success) {
        statusDiv.textContent = `Stop failed: ${response?.error || 'Unknown'}`;
      }
    });
  } else {
    if (!hasConsent) {
      recorderSection.style.display = 'none';
      consentSection.style.display  = 'flex';
      acceptConsentBtn.disabled     = !consentCheckbox.checked;
      return;
    }
    initiateRecording();
  }
};

async function initiateRecording() {
  statusDiv.textContent = 'Starting recording...';

  // Request mic permission from the popup context so the browser prompt is visible.
  // The offscreen document's getUserMedia runs hidden, so we must trigger the
  // permission dialog here first.
  try {
    const perm = await navigator.permissions.query({ name: 'microphone' });
    if (perm.state === 'prompt') {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop()); // permission granted, release stream
      } catch (_) {
        statusDiv.textContent = 'Microphone permission denied. Please allow access and try again.';
        return;
      }
    } else if (perm.state === 'denied') {
      statusDiv.textContent = 'Microphone access is blocked. Please allow it in your browser settings.';
      return;
    }
  } catch (_) {
    // permissions.query unavailable in this context — proceed and let offscreen handle it
  }

  // tabCapture.getMediaStreamId() MUST be called from the popup (not background).
  // It produces a one-time streamId that background can reconstruct into a real
  // MediaStream via getUserMedia({ audio: { mandatory: { chromeMediaSourceId } } }).
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) {
      statusDiv.textContent = 'Could not identify active tab.';
      return;
    }

    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        statusDiv.textContent = `Tab capture failed: ${chrome.runtime.lastError?.message || 'No stream ID'}`;
        return;
      }

      const recTitle = recTitleInput.value.trim() ||
        `Recording — ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
      const recDesc = recDescInput.value.trim();

      // Pass the streamId (not the stream itself — streams can't be serialised)
      chrome.runtime.sendMessage(
        { action: 'startRecording', userId: currentUser.sub, userEmail: currentUser.email || '', tabStreamId: streamId, recTitle, recDesc },
        (response) => {
          if (chrome.runtime.lastError) return;
          if (!response?.success) {
            if (response?.error === 'Already recording') {
              // Background is already recording (e.g. service worker restarted mid-recording)
              syncWithBackground();
            } else {
              statusDiv.textContent = `Recording failed: ${response?.error || 'Unknown error'}`;
            }
          }
        }
      );
    });
  });
}

// ---------------------------------------------------------------------------
// Pause button
// ---------------------------------------------------------------------------
pauseBtn.onclick = () => {
  const action = isPaused ? 'resumeRecording' : 'pauseRecording';
  chrome.runtime.sendMessage({ action }, (response) => {
    if (chrome.runtime.lastError) return;
    if (!response?.success) {
      statusDiv.textContent = `${isPaused ? 'Resume' : 'Pause'} failed: ${response?.error || 'Unknown'}`;
    }
  });
};

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------
consentCheckbox.onchange = () => {
  acceptConsentBtn.disabled = !consentCheckbox.checked;
};

acceptConsentBtn.onclick = () => {
  if (!consentCheckbox.checked) return;
  hasConsent = true;
  chrome.storage.local.set({ hasRecordingConsent: true }, () => {
    mainNav.style.display        = 'flex';
    consentSection.style.display = 'none';
    showTab('record');
    statusDiv.textContent        = 'Ready to record.';
  });
};

tcLink.onclick = (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: tcLink.href });
};

// ---------------------------------------------------------------------------
// Navigation tabs
// ---------------------------------------------------------------------------
navRecord.onclick = () => {
  showTab('record');
};

navCalendar.onclick = () => {
  showTab('calendar');
  loadCalendar();
};

// ---------------------------------------------------------------------------
// Calendar — utilities
// ---------------------------------------------------------------------------
function toLocalISOString(dateStr, timeStr) {
  const d    = new Date(`${dateStr}T${timeStr}:00`);
  const off  = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const hh   = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const mm   = String(Math.abs(off) % 60).padStart(2, '0');
  return `${dateStr}T${timeStr}:00${sign}${hh}:${mm}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function removeCachedToken(token) {
  return new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
}

function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'Not signed in'));
      } else {
        resolve(token);
      }
    });
  });
}

async function calendarFetch(url, opts = {}, retryOnForbidden = false) {
  let token;
  try {
    token = await getAuthToken(false);
  } catch (_) {
    token = await getAuthToken(true);
  }
  const makeReq = t => fetch(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${t}` } });
  let res = await makeReq(token);
  if (res.status === 401) {
    await removeCachedToken(token);
    token = await getAuthToken(true);
    res = await makeReq(token);
  } else if (res.status === 403 && retryOnForbidden) {
    // Write operations may need scope re-grant — prompt once interactively
    await removeCachedToken(token);
    token = await getAuthToken(true);
    res = await makeReq(token);
  }
  return res;
}

function formatCalTime(event) {
  if (event.start.date) return 'All day';
  const s    = new Date(event.start.dateTime);
  const e    = new Date(event.end.dateTime);
  const opts = { hour: '2-digit', minute: '2-digit' };
  return `${s.toLocaleTimeString([], opts)} - ${e.toLocaleTimeString([], opts)}`;
}

function formatCalDate(event) {
  const raw   = event.start.date || event.start.dateTime;
  const d     = new Date(raw);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tom   = new Date(today); tom.setDate(today.getDate() + 1);
  const cmp   = new Date(d); cmp.setHours(0, 0, 0, 0);
  if (cmp.getTime() === today.getTime()) return 'Today';
  if (cmp.getTime() === tom.getTime())   return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Calendar — API
// ---------------------------------------------------------------------------
async function fetchEventsFromCalendar(calId, calColor) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const params = new URLSearchParams({
    timeMin:      todayStart.toISOString(),
    timeMax:      new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '50',
  });
  const res = await calendarFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || [])
    .filter(ev => {
      // Strip out blocks that aren't real meetings
      const NON_MEETING = ['outOfOffice', 'focusTime', 'workingLocation', 'birthday'];
      return !NON_MEETING.includes(ev.eventType);
    })
    .map(ev => ({
      ...ev,
      _calendarId:    calId,
      _calendarColor: calColor || null,
      _canDelete:     true,
    }));
}

async function fetchCalendarEvents() {
  // Try to list all calendars (requires calendar.readonly scope).
  // If that fails for any reason, fall back to the primary calendar only.
  let cals = null;
  try {
    const listRes = await calendarFetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader'
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      cals = (listData.items || []).filter(c => {
        if (c.selected === false) return false;
        // Skip holiday calendars (Google's national-holiday calendars have
        // IDs ending with "holiday@group.v.calendar.google.com") and any
        // other read-only calendar whose summary is clearly holidays.
        const id = (c.id || '').toLowerCase();
        const summary = (c.summary || '').toLowerCase();
        if (id.includes('holiday@group.v.calendar.google.com')) return false;
        if (/\bholidays?\b/.test(summary)) return false;
        return true;
      });
    }
  } catch (_) {}

  if (!cals || !cals.length) {
    cals = [{ id: 'primary', backgroundColor: null }];
  }

  const allResults = await Promise.all(
    cals.map(c => fetchEventsFromCalendar(c.id, c.backgroundColor))
  );

  // De-dupe by event id and sort by start time
  const seen = new Set();
  const all  = [];
  for (const evs of allResults) {
    for (const ev of evs) {
      if (!seen.has(ev.id)) { seen.add(ev.id); all.push(ev); }
    }
  }
  all.sort((a, b) => {
    const aT = a.start.dateTime || (a.start.date + 'T00:00:00');
    const bT = b.start.dateTime || (b.start.date + 'T00:00:00');
    return new Date(aT) - new Date(bT);
  });
  return all;
}

async function deleteCalendarEvent(eventId, calendarId = 'primary') {
  const res = await calendarFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
    true  // retry interactively on 403 to prompt for write scope
  );
  if (!res.ok && res.status !== 204) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error?.message || `Delete failed: ${res.status}`);
  }
}

async function postCalendarEvent({ title, startIso, endIso, allDay, location, description }) {
  const body = { summary: title };
  if (allDay) {
    body.start = { date: startIso };
    body.end   = { date: endIso };
  } else {
    body.start = { dateTime: startIso };
    body.end   = { dateTime: endIso };
  }
  if (location)    body.location    = location;
  if (description) body.description = description;

  const res = await calendarFetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    true  // retry interactively on 403 to prompt for write scope
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error?.message || `Create event failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Calendar — views
// ---------------------------------------------------------------------------
function showCalView(view) {
  calEventsView.style.display = view === 'events' ? 'flex' : 'none';
  calDetailView.style.display = view === 'detail' ? 'flex' : 'none';
  calCreateView.style.display = view === 'create' ? 'flex' : 'none';
}

const GCAL_COLORS = {
  '1':'#7986CB','2':'#33B679','3':'#8E24AA','4':'#E67C73','5':'#F6BF26',
  '6':'#F4511E','7':'#039BE5','8':'#616161','9':'#3F51B5','10':'#0B8043','11':'#D50000',
};

function eventColor(ev) {
  return GCAL_COLORS[ev.colorId] || ev._calendarColor || 'var(--primary)';
}

function renderCalEvents(events) {
  if (!events.length) {
    calEventsList.innerHTML = `
      <div class="cal-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25;margin-bottom:0.7rem"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><br>
        No events in the next 30 days
      </div>`;
    return;
  }

  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  let html = '';
  let lastDateKey = '';

  events.forEach((ev, i) => {
    const dateKey = (ev.start.date || ev.start.dateTime || '').slice(0, 10);
    if (dateKey !== lastDateKey) {
      const d    = new Date(dateKey + 'T00:00:00');
      const cmp  = new Date(d); cmp.setHours(0,0,0,0);
      let badge  = '';
      if (cmp.getTime() === today.getTime())    badge = '<span class="cal-today-badge">Today</span>';
      else if (cmp.getTime() === tomorrow.getTime()) badge = '<span class="cal-today-badge cal-tomorrow-badge">Tomorrow</span>';
      const dayName = d.toLocaleDateString([], { weekday: 'long' });
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      html += `<div class="cal-day-header">${badge}<span class="cal-day-name">${escapeHtml(dayName)}</span><span class="cal-day-date">${escapeHtml(dateStr)}</span></div>`;
      lastDateKey = dateKey;
    }

    const color   = eventColor(ev);
    const locHtml = ev.location
      ? `<div class="ev-loc"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(ev.location)}</div>` : '';
    const meetBadge = ev.hangoutLink ? `<span class="ev-meet-badge">Meet</span>` : '';

    html += `
      <div class="ev-row" data-idx="${i}">
        <div class="ev-time">${escapeHtml(formatCalTime(ev))}</div>
        <div class="ev-bar" style="background:${color}"></div>
        <div class="ev-info">
          <div class="ev-title">${escapeHtml(ev.summary || 'Untitled Event')}${meetBadge}</div>
          ${locHtml}
        </div>
        <svg class="ev-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>`;
  });

  calEventsList.innerHTML = html;
  calEventsList.querySelectorAll('.ev-row').forEach(row => {
    row.onclick = () => showEventDetail(calEvents[parseInt(row.dataset.idx)]);
  });
}

function showEventDetail(event) {
  activeCalEvent = event;
  // Hide delete button for calendars where user only has read access
  calDeleteEventBtn.style.display = event._canDelete === false ? 'none' : 'flex';
  showCalView('detail');
  const color     = eventColor(event);
  const locHtml   = event.location
    ? `<a class="cal-detail-location" href="https://maps.google.com/?q=${encodeURIComponent(event.location)}" target="_blank">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
         ${escapeHtml(event.location)}
       </a>` : '';
  const attendees = (event.attendees || []);
  const attHtml   = attendees.length
    ? `<div class="cal-detail-meta" style="margin-top:0.3rem">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
         ${attendees.length} guest${attendees.length !== 1 ? 's' : ''}
       </div>` : '';
  const descHtml  = event.description
    ? `<div class="cal-detail-desc">${escapeHtml(event.description)}</div>` : '';
  const meetHtml  = event.hangoutLink
    ? `<a class="btn-primary hover-lift" href="${escapeHtml(event.hangoutLink)}" target="_blank" style="margin-top:0.6rem;display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.82rem;padding:0.55rem 1rem;text-decoration:none">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.89L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"></path></svg>
         Join Google Meet
       </a>` : '';
  calDetailContent.innerHTML = `
    <div class="cal-detail-name" style="border-left:3px solid ${color};padding-left:0.6rem">${escapeHtml(event.summary || 'Untitled Event')}</div>
    <div class="cal-detail-meta">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      ${escapeHtml(formatCalDate(event))}
    </div>
    <div class="cal-detail-meta">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      ${escapeHtml(formatCalTime(event))}
    </div>
    ${locHtml}${attHtml}${descHtml}${meetHtml}`;
}

async function loadCalendar() {
  showCalView('events');
  calEventsList.innerHTML = '<div class="cal-loading">Loading events…</div>';
  calRefreshBtn.classList.add('spinning');
  try {
    calEvents = await fetchCalendarEvents();
    renderCalEvents(calEvents);
  } catch (err) {
    calEventsList.innerHTML = `<div class="cal-empty"><small>${escapeHtml(err.message)}</small></div>`;
  } finally {
    calRefreshBtn.classList.remove('spinning');
  }
}

// ---------------------------------------------------------------------------
// Calendar — button handlers
// ---------------------------------------------------------------------------
calRefreshBtn.onclick = () => loadCalendar();

calBackFromDetail.onclick = () => showCalView('events');

calDeleteEventBtn.onclick = async () => {
  if (!activeCalEvent) return;
  calDeleteEventBtn.disabled = true;
  try {
    await deleteCalendarEvent(activeCalEvent.id, activeCalEvent._calendarId || 'primary');
    await loadCalendar();
  } catch (err) {
    calDetailContent.innerHTML += `<div class="cal-empty" style="margin-top:0.5rem"><small>${escapeHtml(err.message)}</small></div>`;
    calDeleteEventBtn.disabled = false;
  }
};

calBackFromCreate.onclick = () => showCalView('events');

calEvtAllDay.onchange = () => {
  calTimeRow.style.display = calEvtAllDay.checked ? 'none' : 'flex';
  calEvtStart.required = !calEvtAllDay.checked;
  calEvtEnd.required   = !calEvtAllDay.checked;
};

calNewEventBtn.onclick = () => {
  calEvtTitle.value    = '';
  calEvtDate.value     = new Date().toISOString().slice(0, 10);
  calEvtStart.value    = '';
  calEvtEnd.value      = '';
  calEvtLocation.value = '';
  calEvtDesc.value     = '';
  calEvtAllDay.checked = false;
  calTimeRow.style.display = 'flex';
  calEvtStart.required = true;
  calEvtEnd.required   = true;
  showCalView('create');
};

calRecordEventBtn.onclick = () => {
  showTab('record');
  if (!isRecording) initiateRecording();
};

calCreateForm.onsubmit = async (e) => {
  e.preventDefault();
  const title    = calEvtTitle.value.trim();
  const date     = calEvtDate.value;
  const allDay   = calEvtAllDay.checked;
  const location = calEvtLocation.value.trim();
  const desc     = calEvtDesc.value.trim();
  if (!title || !date) return;
  if (!allDay && (!calEvtStart.value || !calEvtEnd.value)) return;

  calCreateSubmit.disabled    = true;
  calCreateSubmit.textContent = 'Saving…';
  try {
    // All-day events need end = start + 1 day (Google uses half-open [start, end) intervals)
    const allDayEnd = (() => {
      const d = new Date(date + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    await postCalendarEvent({
      title,
      allDay,
      location,
      description: desc,
      startIso: allDay ? date : toLocalISOString(date, calEvtStart.value),
      endIso:   allDay ? allDayEnd : toLocalISOString(date, calEvtEnd.value),
    });
  } catch (err) {
    const errEl = calCreateView.querySelector('.cal-form-error') || document.createElement('p');
    errEl.className    = 'cal-form-error';
    errEl.textContent  = err.message;
    calCreateSubmit.parentElement.insertBefore(errEl, calCreateSubmit);
    calCreateSubmit.disabled    = false;
    calCreateSubmit.textContent = 'Save';
    return;
  }
  calCreateSubmit.disabled    = false;
  calCreateSubmit.textContent = 'Save';
  await loadCalendar();
};

// ---------------------------------------------------------------------------
// History — navigation
// ---------------------------------------------------------------------------
navHistory.onclick = () => { showTab('history'); loadHistory(); };

function showHistView(view) {
  histListView.style.display       = view === 'list'       ? 'flex' : 'none';
  histTranscriptView.style.display = view === 'transcript' ? 'flex' : 'none';
  histSummaryView.style.display    = view === 'summary'    ? 'flex' : 'none';
}

histBackFromTranscript.onclick = () => showHistView('list');
histBackFromSummary.onclick    = () => showHistView('list');
histRefreshBtn.onclick         = () => loadHistory();

// ---------------------------------------------------------------------------
// History — rendering
// ---------------------------------------------------------------------------
let histRecordings = [];

function formatDuration(dur) {
  if (!dur) return '--:--';
  const m = String(dur.audioMinutes || 0).padStart(2, '0');
  const s = String(dur.audioSeconds || 0).padStart(2, '0');
  return `${m}:${s}`;
}

function formatRecDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SPKR_COLORS = ['A','B','C','D','E'];
function speakerColorClass(speaker) {
  const letter = speaker.replace('Speaker ', '').trim();
  return SPKR_COLORS.includes(letter) ? `hist-speaker-${letter}` : 'hist-speaker-A';
}

function renderHistoryCards(recs) {
  if (!recs.length) {
    histCardsList.innerHTML = `
      <div class="hist-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25;display:block;margin:0 auto 0.6rem"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        No recordings yet.<br><small>Recordings appear here after you stop recording.</small>
      </div>`;
    return;
  }

  histCardsList.innerHTML = recs.map((rec, i) => {
    const s = rec.status || 'processing';
    const isDone   = s === 'done';
    const isInProg = s === 'transcribing' || s === 'processing';
    const isFailed = s === 'upload_failed' || s === 'transcription_failed';
    const badgeCls = isDone ? 'done' : isInProg ? 'transcribing' : isFailed ? 'failed' : 'transcribing';
    const badgeLbl = isDone ? 'Done'
                   : s === 'transcribing'        ? 'Transcribing…'
                   : s === 'upload_failed'       ? 'Upload Failed'
                   : s === 'transcription_failed'? 'Transcript Failed'
                   : 'Processing…';
    const hasT = rec.transcript && rec.transcript.length > 0;
    const hasS = rec.summary && (
      (rec.summary.key_points   || []).length +
      (rec.summary.decisions    || []).length +
      (rec.summary.action_items || []).length > 0
    );
    const hasAudio = !!rec.audio_url;
    const hasWav   = !!rec.wav_url;
    const errHtml  = (s === 'transcription_failed' && rec.transcription_error)
      ? `<div class="hist-card-error">${escapeHtml(rec.transcription_error)}</div>` : '';
    return `
      <div class="hist-card">
        <div class="hist-card-header">
          <div class="hist-card-title">${escapeHtml(rec.title || 'Recording')}</div>
          <span class="hist-status-badge ${badgeCls}">${badgeLbl}</span>
        </div>
        ${rec.description ? `<div class="hist-card-desc">${escapeHtml(rec.description)}</div>` : ''}
        <div class="hist-card-meta">
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${escapeHtml(formatRecDate(rec.date))}
          </span>
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${escapeHtml(formatDuration(rec.duration))}
          </span>
        </div>
        ${errHtml}
        <div class="hist-card-actions">
          <button class="hist-action-btn" data-idx="${i}" data-act="transcript" ${!hasT ? 'disabled' : ''}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
            Transcript
          </button>
          <button class="hist-action-btn" data-idx="${i}" data-act="summary" ${!hasS ? 'disabled' : ''}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            Summary
          </button>
          <button class="hist-action-btn" data-idx="${i}" data-act="dl-webm" ${!hasAudio ? 'disabled' : ''}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            WebM
          </button>
          <button class="hist-action-btn" data-idx="${i}" data-act="dl-wav" ${!hasAudio && !hasWav ? 'disabled' : ''}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            WAV
          </button>
          <button class="hist-action-btn danger" data-idx="${i}" data-act="delete">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
            Delete
          </button>
        </div>
      </div>`;
  }).join('');

  histCardsList.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec  = histRecordings[parseInt(btn.dataset.idx)];
      const card = btn.closest('.hist-card');
      if (btn.dataset.act === 'transcript') showTranscriptView(rec);
      if (btn.dataset.act === 'summary')    showSummaryView(rec);
      if (btn.dataset.act === 'dl-webm')    downloadWebm(rec);
      if (btn.dataset.act === 'dl-wav')     downloadWav(btn, rec);
      if (btn.dataset.act === 'delete')     deleteHistRecording(rec.id, card, btn);
    });
  });
}

function openHistAudio(rec) {
  if (rec.audio_url) chrome.tabs.create({ url: rec.audio_url });
}

// WAV encoder: RIFF/PCM from an AudioBuffer
function audioBufferToWav(buffer) {
  const numCh  = buffer.numberOfChannels;
  const sr     = buffer.sampleRate;
  const len    = buffer.length;
  const bitsPS = 16;
  const bytePS = bitsPS / 8;
  const blockAlign = numCh * bytePS;
  const dataLen    = len * blockAlign;
  const ab  = new ArrayBuffer(44 + dataLen);
  const view = new DataView(ab);

  function writeStr(off, str) { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
  function writeU16(off, v)   { view.setUint16(off, v, true); }
  function writeU32(off, v)   { view.setUint32(off, v, true); }

  writeStr(0,  'RIFF');
  writeU32(4,  36 + dataLen);
  writeStr(8,  'WAVE');
  writeStr(12, 'fmt ');
  writeU32(16, 16);          // subchunk1 size
  writeU16(20, 1);           // PCM
  writeU16(22, numCh);
  writeU32(24, sr);
  writeU32(28, sr * blockAlign);
  writeU16(32, blockAlign);
  writeU16(34, bitsPS);
  writeStr(36, 'data');
  writeU32(40, dataLen);

  // Interleave channels as int16
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return ab;
}

async function downloadWav(btn, rec) {
  const safe = (rec.title || 'recording').replace(/[^a-z0-9_\-]/gi, '_');

  // Use pre-converted WAV stored in Azure if available
  if (rec.wav_url) {
    chrome.downloads.download({ url: rec.wav_url, filename: `${safe}.wav`, saveAs: false });
    return;
  }

  // Fallback: convert WebM → WAV in browser (for recordings without wav_url)
  if (!rec.audio_url) { alert('No audio available.'); return; }
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Converting…';
  try {
    const resp = await fetch(rec.audio_url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    const arrayBuf = await resp.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded  = await audioCtx.decodeAudioData(arrayBuf);
    audioCtx.close();
    const wavBuf = audioBufferToWav(decoded);
    const blob   = new Blob([wavBuf], { type: 'audio/wav' });
    const url    = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename: `${safe}.wav`, saveAs: false }, () => {
      URL.revokeObjectURL(url);
    });
  } catch (err) {
    alert(`WAV download failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function downloadWebm(rec) {
  if (rec.audio_url) {
    const safe = (rec.title || 'recording').replace(/[^a-z0-9_\-]/gi, '_');
    chrome.downloads.download({ url: rec.audio_url, filename: `${safe}.webm`, saveAs: false });
  } else {
    alert('No audio URL available.');
  }
}

function deleteHistRecording(recId, cardEl, confirmBtn) {
  if (!confirmBtn._confirmPending) {
    confirmBtn._confirmPending = true;
    confirmBtn.textContent = 'Sure?';
    confirmBtn.style.color  = 'var(--danger)';
    confirmBtn.style.borderColor = 'rgba(239,68,68,0.4)';
    setTimeout(() => {
      if (confirmBtn._confirmPending) {
        confirmBtn._confirmPending = false;
        confirmBtn.textContent = 'Delete';
        confirmBtn.style.color = '';
        confirmBtn.style.borderColor = '';
      }
    }, 3000);
    return;
  }
  // Second click — actually delete
  confirmBtn._confirmPending = false;
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting…';

  // Optimistically remove from in-memory list and re-render
  const snapshot = [...histRecordings]; // keep a copy in case we need to roll back
  histRecordings = histRecordings.filter(r => r.id !== recId);
  renderHistoryCards(histRecordings);

  // Remove from local storage (covers in-progress entries)
  chrome.storage.local.get(['recordings'], result => {
    const recs = (result.recordings || []).filter(r => r.id !== recId);
    chrome.storage.local.set({ recordings: recs });
  });

  // Persist deletion to Azure — roll back and show error if it fails
  azureSyncRecordings(histRecordings).then(ok => {
    if (!ok) {
      // Azure sync failed — restore the list so the recording isn't lost
      histRecordings = snapshot;
      renderHistoryCards(histRecordings);
      // Also restore local storage
      chrome.storage.local.get(['recordings'], result => {
        const recs = result.recordings || [];
        if (!recs.find(r => r.id === recId)) {
          recs.push(snapshot.find(r => r.id === recId));
          chrome.storage.local.set({ recordings: recs });
        }
      });
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'color:var(--danger);font-size:0.78rem;padding:8px 12px;text-align:center;';
      errDiv.textContent   = 'Delete failed — make sure the backend server is running and try again.';
      histCardsList.prepend(errDiv);
      setTimeout(() => errDiv.remove(), 5000);
    }
  });
}

function showTranscriptView(rec) {
  showHistView('transcript');
  if (!rec.transcript || !rec.transcript.length) {
    histTranscriptContent.innerHTML = '<div class="hist-empty">No transcript available.</div>';
    return;
  }
  histTranscriptContent.innerHTML = rec.transcript.map(u => `
    <div class="hist-utterance">
      <div class="hist-speaker-col">
        <span class="hist-speaker-name ${speakerColorClass(u.speaker)}">${escapeHtml(u.speaker)}</span>
        <span class="hist-timestamp">${escapeHtml(u.timestamp)}</span>
      </div>
      <div class="hist-utt-text">${escapeHtml(u.text)}</div>
    </div>`).join('');
}

function showSummaryView(rec) {
  showHistView('summary');
  const s = rec.summary || {};

  function section(title, cls, items, bullet) {
    if (!items || !items.length) return '';
    return `
      <div class="hist-summary-section">
        <div class="hist-summary-section-title ${cls}">${title}</div>
        ${items.map(it => `
          <div class="hist-summary-item">
            <span class="hist-summary-bullet">${bullet}</span>
            <span>${escapeHtml(it)}</span>
          </div>`).join('')}
      </div>`;
  }

  const html =
    section('Key Points',   'kp',  s.key_points,   '▸') +
    section('Decisions',    'dec', s.decisions,    '✓') +
    section('Action Items', 'ai',  s.action_items, '→');

  histSummaryContent.innerHTML = html || '<div class="hist-empty">No summary available yet.</div>';
}

// ---------------------------------------------------------------------------
// Azure metadata sync — stores recordings.json alongside audio in Azure Blob
// so recordings are accessible from any device with the same account.
// ---------------------------------------------------------------------------
const AZURE_BASE = 'https://recorderextension.blob.core.windows.net/meeting-audio';
const BACKEND    = 'https://recora-chrome-extension.onrender.com';

async function azureLoadRecordings() {
  if (!currentUser?.sub) return [];
  try {
    const url = `${AZURE_BASE}/${encodeURIComponent(currentUser.sub)}/recordings.json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

async function azureSyncRecordings(recordings) {
  if (!currentUser?.sub) return false;
  try {
    let token;
    try { token = await getAuthToken(false); } catch (_) { return false; }
    const sasRes = await fetch(`${BACKEND}/generate-upload-sas`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ userId: currentUser.sub, blobName: 'recordings.json' }),
      cache:   'no-store',
    });
    if (!sasRes.ok) return false;
    const { sasToken } = await sasRes.json();

    const json    = JSON.stringify(recordings);
    const byteLen = new TextEncoder().encode(json).length;
    const putRes  = await fetch(`${AZURE_BASE}/${encodeURIComponent(currentUser.sub)}/recordings.json?${sasToken}`, {
      method:  'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type':   'application/json',
        'x-ms-date':      new Date().toUTCString(),
        'x-ms-version':   '2020-04-08',
        'Content-Length': String(byteLen),
      },
      body: json,
    });
    return putRes.ok;
  } catch (_) {
    return false;
  }
}

function mergeRecordings(local, drive) {
  const map = new Map();
  for (const r of local) map.set(r.id, r);
  for (const r of drive) {
    const existing = map.get(r.id);
    if (!existing) {
      map.set(r.id, r);
    } else if (r.status === 'done' && existing.status !== 'done') {
      map.set(r.id, { ...r });
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function loadHistory() {
  showHistView('list');
  histRefreshBtn.classList.add('spinning');
  try {
    // Azure is the source of truth — scoped to currentUser.sub.
    const azureRecs = await azureLoadRecordings();

    const localResult = await new Promise(resolve =>
      chrome.storage.local.get(['recordings'], resolve)
    );

    // Include recordings that are:
    //   a) still being processed/transcribing (not in Azure yet), OR
    //   b) recently finished but not yet synced to Azure (race condition:
    //      transcription_done fires before syncMetadataToAzure completes)
    const azureIds = new Set(azureRecs.map(r => r.id));
    const localToShow = (localResult.recordings || []).filter(r =>
      r.userId === currentUser?.sub &&
      (r.status === 'processing' || r.status === 'transcribing' || !azureIds.has(r.id))
    );

    histRecordings = mergeRecordings(localToShow, azureRecs);
    renderHistoryCards(histRecordings);
  } catch (err) {
    histCardsList.innerHTML = `<div class="hist-empty"><small>${escapeHtml(err.message)}</small></div>`;
  } finally {
    histRefreshBtn.classList.remove('spinning');
  }
}

// ---------------------------------------------------------------------------
// Sign in / Sign out
// ---------------------------------------------------------------------------
signInBtn.onclick = () => {
  statusDiv.textContent = 'Signing in...';
  // Call getAuthToken directly — no clearAllCachedAuthTokens here so:
  //   • The Google account picker opens instantly (no extra async round-trip)
  //   • Chrome reuses the existing OAuth grant; users are NOT re-prompted for
  //     calendar/profile scopes on every login (they granted them once already)
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      statusDiv.textContent = `Sign-in failed: ${chrome.runtime.lastError?.message || 'Unknown error'}`;
      return;
    }
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(userInfo => {
        chrome.storage.local.get(['lastUserId'], stored => {
          const finish = () => {
            chrome.storage.local.set({ cachedUser: userInfo, lastUserId: userInfo.sub });
            currentUser = userInfo;
            updateUI(currentUser);
          };
          if (stored.lastUserId && stored.lastUserId !== userInfo.sub) {
            // Different account — clear local recordings so the new user
            // starts with a clean slate (their own recordings load from Azure)
            chrome.storage.local.remove(['recordings'], finish);
          } else {
            finish();
          }
        });
      })
      .catch(() => { statusDiv.textContent = 'Failed to fetch user info.'; });
  });
};

function handleLogout() {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    void chrome.runtime.lastError;
    const cleanup = () => {
      currentUser = null;
      hasConsent  = false;
      chrome.storage.local.set({ hasRecordingConsent: false, lastActiveTab: 'record', cachedUser: null });
      updateUI(null);
      stopLocalTimer();
    };
    if (token) {
      fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
      chrome.identity.removeCachedAuthToken({ token }, cleanup);
    } else {
      cleanup();
    }
  });
}
logoutBtn.onclick = handleLogout;

// Close profile dropdown when clicking anywhere outside it
document.addEventListener('click', () => {
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.classList.remove('open');
});

// ---------------------------------------------------------------------------
// Init on popup open
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Read cache + consent together so we can show the dashboard instantly (no flash)
  chrome.storage.local.get(['hasRecordingConsent', 'cachedUser'], (stored) => {
    hasConsent = stored.hasRecordingConsent || false;

    // Show UI from cache immediately — eliminates the 2-second login-screen flash
    if (stored.cachedUser) {
      currentUser = stored.cachedUser;
      updateUI(currentUser);
    }

    // Verify the token is still valid in the background
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      void chrome.runtime.lastError;
      if (!token) {
        // Session expired — clear stale cache and show login screen
        chrome.storage.local.set({ cachedUser: null });
        currentUser = null;
        updateUI(null);
        return;
      }
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(userInfo => {
          const accountChanged = stored.cachedUser && userInfo.sub !== stored.cachedUser.sub;
          const finish = () => {
            currentUser = userInfo;
            chrome.storage.local.set({ cachedUser: userInfo, lastUserId: userInfo.sub });
            if (!stored.cachedUser || accountChanged) updateUI(currentUser);
          };
          if (accountChanged) {
            // Different account — wipe local recordings BEFORE rendering so the
            // new user never sees the previous user's history
            chrome.storage.local.remove(['recordings'], finish);
          } else {
            finish();
          }
        })
        .catch(() => {
          chrome.storage.local.set({ cachedUser: null });
          currentUser = null;
          updateUI(null);
        });
    });
  });
});

// // --- Element References ---
// const signInBtn = document.getElementById("signInBtn");
// const logoutBtn = document.getElementById("logoutBtn");
// const recordBtn = document.getElementById("recordBtn");
// const userInfoDiv = document.getElementById("userInfo");
// const statusDiv = document.getElementById("status");
// const loginSection = document.getElementById("loginSection");
// const recorderSection = document.getElementById("recorderSection");
// const micIcon = document.getElementById("micIcon");
// const squareIcon = document.getElementById("squareIcon");
// const timerDisplay = document.getElementById("timerDisplay"); // ADDED

// // New Consent Elements
// const consentSection = document.getElementById("consentSection");
// const consentCheckbox = document.getElementById("consentCheckbox");
// const acceptConsentBtn = document.getElementById("acceptConsentBtn");
// const tcLink = document.getElementById("tcLink");


// let currentUser = null;
// let mediaRecorder;
// let recordedChunks = [];
// let recordingStartTime = null;
// let audioPlayback = null; // New variable to hold the Audio element for playback
// let audioContext = null;
// let micStreamGlobal = null; // Store mic stream to stop tracks later
// let hasConsent = false; // New variable to track user consent
// let timerInterval; // ADDED for the timer

// // --- Helper Functions ---
// const blobToBase64 = (blob) => {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onloadend = () => resolve(reader.result);
//     reader.onerror = reject;
//     reader.readAsDataURL(blob);
//   });
// };

// const formatTime = (seconds) => {
//   const minutes = Math.floor(seconds / 60);
//   const remainingSeconds = seconds % 60;
//   return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
// };

// const updateTimer = () => {
//   if (recordingStartTime) {
//     const elapsedTimeInSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);
//     timerDisplay.textContent = formatTime(elapsedTimeInSeconds);
//   }
// };

// const updateUI = (user) => {
//   if (user) {
//     // User is logged in
//     loginSection.style.display = 'none';
//     logoutBtn.style.display = 'flex';
//     userInfoDiv.innerHTML = `
//       <p class="user-name">${user.name}</p>
//       <p class="user-email">${user.email}</p>
//     `;
//     // Check consent status and show appropriate section
//     chrome.storage.local.get(['hasRecordingConsent'], (result) => {
//       hasConsent = result.hasRecordingConsent || false;
//       if (hasConsent) {
//         recorderSection.style.display = 'flex';
//         consentSection.style.display = 'none';
//         statusDiv.textContent = 'Ready to record.';
//         timerDisplay.textContent = '00:00'; // Reset timer display
//       } else {
//         recorderSection.style.display = 'none';
//         consentSection.style.display = 'flex';
//         statusDiv.textContent = 'Please accept consent to record.';
//         acceptConsentBtn.disabled = !consentCheckbox.checked; // Ensure button state is correct
//       }
//     });
//   } else {
//     // User is logged out
//     loginSection.style.display = 'flex';
//     recorderSection.style.display = 'none';
//     consentSection.style.display = 'none'; // Hide consent section if logged out
//     logoutBtn.style.display = 'none';
//     userInfoDiv.innerHTML = '';
//   }
// };

// const setRecordingState = (isRecording) => {
//   if (isRecording) {
//     recordBtn.classList.remove('idle');
//     recordBtn.classList.add('recording');
//     micIcon.style.display = 'none';
//     squareIcon.style.display = 'block';
//     statusDiv.textContent = 'Recording...';
//   } else {
//     recordBtn.classList.remove('recording');
//     recordBtn.classList.add('idle');
//     micIcon.style.display = 'block';
//     squareIcon.style.display = 'none';
//     // Clear and reset timer when not recording
//     clearInterval(timerInterval);
//     timerDisplay.textContent = '00:00';
//   }
// };

// //  Request Microphone Permission Function - MODIFIED
// const requestMicrophonePermission = async () => {
//   statusDiv.textContent = 'Checking microphone permission...';
//   try {
//     const permissionStatus = await navigator.permissions.query({ name: 'microphone' });

//     if (permissionStatus.state === 'granted') {
//       statusDiv.textContent = 'Microphone permission already granted.';
//       return true;
//     } else if (permissionStatus.state === 'prompt') {
//       statusDiv.textContent = "Microphone permission needs to be granted in a new tab.";
//       return false;
//     } else { // 'denied'
//       statusDiv.textContent = "Microphone permission denied. Please allow it in the new tab.";
//       return false;
//     }
//   } catch (err) {
//     console.error("Error querying microphone permission:", err);
//     statusDiv.textContent = `Error checking mic permission: ${err.message}`;
//     return false;
//   }
// };

// // --- Core Recording Function (OPTIMIZED) ---
// const startRecording = async () => {
//   setRecordingState(true);
//   statusDiv.textContent = 'Preparing to record...';

//   // 0. Check for microphone permission first
//   const hasPermission = await requestMicrophonePermission();
//   if (!hasPermission) {
//     statusDiv.textContent = 'Microphone permission required. Opening request page...';
//     chrome.tabs.create({ url: chrome.runtime.getURL('permission-request.html') });
//     setRecordingState(false);
//     return;
//   }
//   statusDiv.textContent = 'Starting recording...';

//   try {
//     // 1. Get Microphone Stream with enhanced constraints
//     micStreamGlobal = await navigator.mediaDevices.getUserMedia({
//       audio: {
//         echoCancellation: true,
//         noiseSuppression: true,
//         autoGainControl: true, // Attempt hardware normalization
//         sampleRate: 48000,
//         channelCount: 2
//       }
//     });

//     // 2. Get Tab Audio Stream
//     const tabStream = await new Promise((resolve, reject) => {
//       chrome.tabCapture.capture({ audio: true }, (stream) => {
//         if (chrome.runtime.lastError) {
//           reject(new Error(chrome.runtime.lastError.message));
//         } else if (!stream) {
//           reject(new Error('Could not capture tab audio.'));
//         } else {
//           resolve(stream);
//         }
//       });
//     });

//     // 3. Initialize AudioContext at high sample rate for clarity
//     audioContext = new (window.AudioContext || window.webkitAudioContext)({
//         sampleRate: 48000,
//     });

//     const destination = audioContext.createMediaStreamDestination();
//     const merger = audioContext.createChannelMerger(2);

//     // --- GAIN NODES (Volume Boosters) ---
//     // Boost Microphone volume by 250%
//     const micGain = audioContext.createGain();
//     micGain.gain.value = 2.0; 

//     // Boost Tab Audio volume slightly by 120%
//     const tabGain = audioContext.createGain();
//     tabGain.gain.value = 1.2;

//     // Connect Tab Audio through Gain to left channel
//     const tabSource = audioContext.createMediaStreamSource(tabStream);
//     tabSource.connect(tabGain);
//     const tabSplitter = audioContext.createChannelSplitter(1);
//     tabGain.connect(tabSplitter);
//     tabSplitter.connect(merger, 0, 0); 

//     // Connect Mic through Gain to right channel
//     const micSource = audioContext.createMediaStreamSource(micStreamGlobal);
//     micSource.connect(micGain);
//     const micSplitter = audioContext.createChannelSplitter(1);
//     micGain.connect(micSplitter);
//     micSplitter.connect(merger, 0, 1); 

//     merger.connect(destination);

//     // Playback for monitoring
//     audioPlayback = new Audio();
//     audioPlayback.srcObject = tabStream; 
//     audioPlayback.play().catch(error => {
//       console.warn("Monitor error:", error);
//     });

//     // 4. Create MediaRecorder with High Bitrate and Opus Codec
//     const recorder = new MediaRecorder(destination.stream, {
//       mimeType: 'audio/webm;codecs=opus', 
//       audioBitsPerSecond: 256000 // High-fidelity bitrate
//     });
//     mediaRecorder = recorder;
//     recordedChunks = [];
//     recordingStartTime = Date.now();
//     timerInterval = setInterval(updateTimer, 1000);

//     recorder.ondataavailable = (e) => {
//       if (e.data.size > 0) {
//         recordedChunks.push(e.data);
//       }
//     };

//     recorder.onstop = async () => {
//       setRecordingState(false);
//       clearInterval(timerInterval);
//       timerDisplay.textContent = '00:00';
//       statusDiv.textContent = 'Processing & uploading...';

//       if (micStreamGlobal) {
//         micStreamGlobal.getTracks().forEach(track => track.stop());
//         micStreamGlobal = null;
//       }
//       tabStream.getTracks().forEach(track => track.stop());
      
//       if (audioPlayback) {
//         audioPlayback.pause();
//         audioPlayback.srcObject = null;
//         audioPlayback = null;
//       }
//       if (audioContext) {
//         audioContext.close();
//         audioContext = null;
//       }

//       const blob = new Blob(recordedChunks, { type: 'audio/webm' });
//       const elapsedMs = Date.now() - recordingStartTime;
//       const minutes = Math.floor(elapsedMs / 60000);
//       const seconds = Math.floor((elapsedMs % 60000) / 1000);

//       try {
//         const base64Data = await blobToBase64(blob);
//         chrome.runtime.sendMessage(
//           {
//             action: "uploadAudioBlob",
//             user_id: currentUser.sub,
//             blobData: base64Data,
//             duration: { audioMinutes: minutes, audioSeconds: seconds }
//           },
//           (response) => {
//             if (response && response.success) {
//               statusDiv.textContent = 'Upload successful!';
//             } else {
//               statusDiv.textContent = `Upload failed: ${response?.error || 'Unknown error'}`;
//             }
//           }
//         );
//       } catch (error) {
//         statusDiv.textContent = 'Failed to process audio.';
//       }
//     };

//     recorder.start();
//     statusDiv.textContent = 'Recording...';

//   } catch (error) {
//     setRecordingState(false);
//     clearInterval(timerInterval);
//     timerDisplay.textContent = '00:00';
//     console.error("Recording setup error:", error);
//     statusDiv.textContent = `Recording failed: ${error.message}`;
//     if (micStreamGlobal) micStreamGlobal.getTracks().forEach(track => track.stop());
//     if (audioContext) audioContext.close();
//     audioContext = null;
//     micStreamGlobal = null;
//   }
// };


// // --- Event Listeners ---
// signInBtn.onclick = () => {
//   statusDiv.textContent = 'Signing in...';
//   chrome.identity.getAuthToken({ interactive: true }, (token) => {
//     if (chrome.runtime.lastError || !token) {
//       statusDiv.textContent = `Sign-in failed: ${chrome.runtime.lastError?.message || 'Unknown error'}`;
//       return;
//     }
//     fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
//       headers: { Authorization: `Bearer ${token}` }
//     })
//       .then(response => response.json())
//       .then(userInfo => {
//         currentUser = userInfo;
//         updateUI(currentUser);
//       })
//       .catch(() => {
//         statusDiv.textContent = 'Failed to fetch user info.';
//       });
//   });
// };

// logoutBtn.onclick = () => {
//   chrome.identity.getAuthToken({ interactive: false }, (token) => {
//     if (token) {
//       fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
//       chrome.identity.removeCachedAuthToken({ token }, () => {
//         currentUser = null;
//         hasConsent = false; 
//         chrome.storage.local.set({ hasRecordingConsent: false });
//         updateUI(null);
//       });
//     }
//   });
// };

// recordBtn.onclick = async () => {
//   if (recordBtn.classList.contains('recording')) {
//     if (mediaRecorder) {
//       mediaRecorder.stop();
//     }
//     clearInterval(timerInterval);
//   } else {
//     if (hasConsent) {
//       startRecording();
//     } else {
//       recorderSection.style.display = 'none';
//       consentSection.style.display = 'flex';
//       statusDiv.textContent = 'Please accept consent to record.';
//       acceptConsentBtn.disabled = !consentCheckbox.checked;
//     }
//   }
// };

// consentCheckbox.onchange = () => {
//   acceptConsentBtn.disabled = !consentCheckbox.checked;
// };

// acceptConsentBtn.onclick = () => {
//   if (consentCheckbox.checked) {
//     hasConsent = true;
//     chrome.storage.local.set({ hasRecordingConsent: true }, () => {
//       consentSection.style.display = 'none';
//       recorderSection.style.display = 'flex';
//       statusDiv.textContent = 'Consent accepted. Ready to record.';
//       startRecording(); 
//     });
//   }
// };

// tcLink.onclick = (e) => {
//   e.preventDefault();
//   chrome.tabs.create({ url: tcLink.href });
// };

// document.addEventListener('DOMContentLoaded', () => {
//   chrome.identity.getAuthToken({ interactive: false }, (token) => {
//     if (token) {
//       fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
//         headers: { Authorization: `Bearer ${token}` }
//       })
//         .then(response => response.json())
//         .then(userInfo => {
//           currentUser = userInfo;
//           updateUI(currentUser);
//         })
//         .catch((error) => {
//           console.error("Error fetching user info:", error);
//           currentUser = null;
//           updateUI(null);
//         });
//     } else {
//       currentUser = null;
//       updateUI(null);
//     }
//   });

//   chrome.storage.local.get(['hasRecordingConsent'], (result) => {
//     hasConsent = result.hasRecordingConsent || false;
//     if (!hasConsent && consentSection.style.display === 'flex') {
//       consentCheckbox.checked = false;
//       acceptConsentBtn.disabled = true;
//     }
//   });
// });