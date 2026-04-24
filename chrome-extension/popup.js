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
const navHistory        = document.getElementById('navHistory');
const historySection    = document.getElementById('historySection');
const histListView      = document.getElementById('histListView');
const histCardsList     = document.getElementById('histCardsList');
const histRefreshBtn    = document.getElementById('histRefreshBtn');
const histDetailView    = document.getElementById('histDetailView');
const histBackFromDetail = document.getElementById('histBackFromDetail');
const histDetailHeading = document.getElementById('histDetailHeading');
const histDetailContent = document.getElementById('histDetailContent');
// --- Folders element refs ---
const navFolders        = document.getElementById('navFolders');
const foldersSection    = document.getElementById('foldersSection');
const foldersListView   = document.getElementById('foldersListView');
const folderDetailView  = document.getElementById('folderDetailView');
const folderFormView    = document.getElementById('folderFormView');
const foldersList       = document.getElementById('foldersList');
const folderDetailRecords = document.getElementById('folderDetailRecords');
const folderDetailName  = document.getElementById('folderDetailName');
const folderNewBtn      = document.getElementById('folderNewBtn');
const folderBackBtn     = document.getElementById('folderBackBtn');
const folderEditBtn     = document.getElementById('folderEditBtn');
const folderDeleteBtn   = document.getElementById('folderDeleteBtn');
const folderFormBackBtn = document.getElementById('folderFormBackBtn');
const folderFormTitle   = document.getElementById('folderFormTitle');
const folderFormName    = document.getElementById('folderFormName');
const folderFormColors  = document.getElementById('folderFormColors');
const folderFormIcons   = document.getElementById('folderFormIcons');
const folderFormSaveBtn = document.getElementById('folderFormSaveBtn');
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
const calRecordEventBtn  = document.getElementById('calRecordEventBtn');
const calRescheduleBtn   = document.getElementById('calRescheduleBtn');
const calNextMeetBtn     = document.getElementById('calNextMeetBtn');
const calFormHeading     = document.getElementById('calFormHeading');
const calCreateForm      = document.getElementById('calCreateForm');
const calGuestChips      = document.getElementById('calGuestChips');
const calGuestInput      = document.getElementById('calGuestInput');
const calAddMeetBtn      = document.getElementById('calAddMeetBtn');
const calMeetLabel       = document.getElementById('calMeetLabel');
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
let calEvents        = [];
let activeCalEvent   = null;
let activeTab        = 'record'; // 'record' | 'calendar'
let calFormMode      = 'create'; // 'create' | 'reschedule'
let calRecordingsMap = {};        // calEventRecordings from storage, kept in sync
let calFormGuests    = [];        // array of email strings for current form
let calFormAddMeet   = false;     // whether to create Google Meet link

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
  navFolders.classList.toggle('active',  tab === 'folders');
  recorderSection.style.display = tab === 'record'   ? 'flex' : 'none';
  calendarSection.style.display = tab === 'calendar' ? 'flex' : 'none';
  historySection.style.display  = tab === 'history'  ? 'flex' : 'none';
  foldersSection.style.display  = tab === 'folders'  ? 'flex' : 'none';
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
    foldersSection.style.display   = 'none';
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
      // Save calendar-event → recording link if session was triggered from calendar
      chrome.storage.local.get(['pendingCalEventLink'], stored => {
        if (stored.pendingCalEventLink && message.recId) {
          const linkKey = `callink_${stored.pendingCalEventLink.id}`;
          chrome.storage.local.get(['calEventRecordings'], r => {
            const map = r.calEventRecordings || {};
            map[linkKey] = { recordingId: message.recId, event: stored.pendingCalEventLink };
            chrome.storage.local.set({ calEventRecordings: map });
          });
          chrome.storage.local.remove(['pendingCalEventLink']);
        }
      });
      loadHistory();
      if (activeTab !== 'history') showTab('history');
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
  const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
  return `${s.toLocaleTimeString([], opts)} – ${e.toLocaleTimeString([], opts)}`;
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

async function postCalendarEvent({ title, startIso, endIso, allDay, location, description, attendees, addMeet }) {
  const body = { summary: title };
  if (allDay) {
    body.start = { date: startIso };
    body.end   = { date: endIso };
  } else {
    body.start = { dateTime: startIso };
    body.end   = { dateTime: endIso };
  }
  if (location)      body.location    = location;
  if (description)   body.description = description;
  if (attendees?.length) body.attendees = attendees.map(e => ({ email: e }));
  if (addMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `meet_${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events${addMeet ? '?conferenceDataVersion=1' : ''}`;
  const res = await calendarFetch(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    true
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error?.message || `Create event failed: ${res.status}`);
  }
  return res.json();
}

async function patchCalendarEvent(eventId, calendarId, { title, startIso, endIso, allDay, location, description, attendees, addMeet }) {
  const body = { summary: title };
  if (allDay) {
    body.start = { date: startIso };
    body.end   = { date: endIso };
  } else {
    body.start = { dateTime: startIso };
    body.end   = { dateTime: endIso };
  }
  if (location    !== undefined) body.location    = location;
  if (description !== undefined) body.description = description;
  if (attendees?.length) body.attendees = attendees.map(e => ({ email: e }));
  if (addMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `meet_${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const qs = addMeet ? '?conferenceDataVersion=1' : '';
  const res = await calendarFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}${qs}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    true
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail?.error?.message || `Reschedule failed: ${res.status}`);
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

function renderCalEvents(events, recordingsMap = {}) {
  if (!events.length) {
    calEventsList.innerHTML = `
      <div class="cal-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25;margin-bottom:0.7rem"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><br>
        No events in the next 30 days
      </div>`;
    return;
  }

  const now      = new Date();
  const todayDay = new Date(now); todayDay.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayDay); tomorrow.setDate(todayDay.getDate() + 1);

  // Split: completed = today's timed events that ended OR were recorded
  const upcoming  = []; // { ev, idx, isRecorded }
  const completed = []; // { ev, idx, isRecorded }
  events.forEach((ev, idx) => {
    const isRecorded = Object.values(recordingsMap).some(v => v.event?.id === ev.id);
    if (ev.end?.dateTime) {
      const endDt    = new Date(ev.end.dateTime);
      const startDay = new Date(ev.start.dateTime); startDay.setHours(0, 0, 0, 0);
      if (startDay.getTime() === todayDay.getTime() && (endDt < now || isRecorded)) {
        completed.push({ ev, idx, isRecorded });
        return;
      }
    }
    upcoming.push({ ev, idx, isRecorded });
  });

  // Build HTML helper for a single event row
  function evRowHtml(ev, idx, isDone, isRecorded) {
    const color    = eventColor(ev);
    const locHtml  = ev.location
      ? `<div class="ev-loc"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(ev.location)}</div>` : '';
    const meetBadge = ev.hangoutLink ? `<span class="ev-meet-badge">Meet</span>` : '';
    const recBadge  = isRecorded
      ? `<span class="ev-recorded-btn"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Recorded</span>`
      : '';
    const rowClass   = isDone ? 'ev-row ev-row--completed' : 'ev-row';
    const barOpacity = isDone ? 'opacity:0.35;' : '';
    const chevron    = isDone ? '' : `<svg class="ev-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    return `
      <div class="${rowClass}" data-idx="${idx}">
        <div class="ev-time${isDone ? ' ev-time--done' : ''}">${escapeHtml(formatCalTime(ev))}</div>
        <div class="ev-bar" style="background:${color};${barOpacity}"></div>
        <div class="ev-info">
          <div class="ev-title">${escapeHtml(ev.summary || 'Untitled Event')}${meetBadge}${recBadge}</div>
          ${locHtml}
        </div>
        ${chevron}
      </div>`;
  }

  let html = '';

  // — Upcoming section —
  if (upcoming.length) {
    html += `<div class="cal-section-header"><span class="cal-section-label">Upcoming</span></div>`;
    let lastDateKey = '';
    upcoming.forEach(({ ev, idx, isRecorded }) => {
      const dateKey = (ev.start.date || ev.start.dateTime || '').slice(0, 10);
      if (dateKey !== lastDateKey) {
        const d   = new Date(dateKey + 'T00:00:00');
        const cmp = new Date(d); cmp.setHours(0, 0, 0, 0);
        let badge = '';
        if (cmp.getTime() === todayDay.getTime())   badge = '<span class="cal-today-badge">Today</span>';
        else if (cmp.getTime() === tomorrow.getTime()) badge = '<span class="cal-today-badge cal-tomorrow-badge">Tomorrow</span>';
        const dayName = d.toLocaleDateString([], { weekday: 'long' });
        const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        html += `<div class="cal-day-header">${badge}<span class="cal-day-name">${escapeHtml(dayName)}</span><span class="cal-day-date">${escapeHtml(dateStr)}</span></div>`;
        lastDateKey = dateKey;
      }
      html += evRowHtml(ev, idx, false, isRecorded);
    });
  } else if (!completed.length) {
    html += `<div class="cal-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.2;display:block;margin:0 auto 0.5rem"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>No upcoming events</div>`;
  }

  // — Completed Today section —
  if (completed.length) {
    html += `
      <div class="cal-completed-header" style="margin-top:${upcoming.length ? '0.6rem' : '0'}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span class="cal-completed-badge">Done</span>
        <span class="cal-completed-label">Completed Today</span>
      </div>`;
    completed.forEach(({ ev, idx, isRecorded }) => { html += evRowHtml(ev, idx, true, isRecorded); });
  }

  calEventsList.innerHTML = html;
  calEventsList.querySelectorAll('.ev-row').forEach(row => {
    row.onclick = () => showEventDetail(calEvents[parseInt(row.dataset.idx)]);
  });
}

function showEventDetail(event) {
  activeCalEvent = event;
  calDeleteEventBtn.style.display = event._canDelete === false ? 'none' : 'flex';

  const isRecorded = Object.values(calRecordingsMap).some(v => v.event?.id === event.id);
  if (isRecorded) {
    calRecordEventBtn.disabled = true;
    calRecordEventBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Already Recorded`;
    calNextMeetBtn.style.display = 'flex';
  } else {
    calRecordEventBtn.disabled = false;
    calRecordEventBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg> Record this Meeting`;
    calNextMeetBtn.style.display = 'none';
  }

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
    const [evts, stored] = await Promise.all([
      fetchCalendarEvents(),
      new Promise(r => chrome.storage.local.get(['calEventRecordings'], r)),
    ]);
    calEvents        = evts;
    calRecordingsMap = stored.calEventRecordings || {};
    renderCalEvents(calEvents, calRecordingsMap);
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

// ---------------------------------------------------------------------------
// Calendar — guest chips + Meet toggle
// ---------------------------------------------------------------------------
function renderGuestChips() {
  calGuestChips.innerHTML = calFormGuests.map((email, i) => `
    <span class="cal-guest-chip">
      <span class="cal-guest-chip-text">${escapeHtml(email)}</span>
      <button type="button" class="cal-guest-chip-remove" data-i="${i}" aria-label="Remove">×</button>
    </span>`).join('');
  calGuestChips.querySelectorAll('.cal-guest-chip-remove').forEach(btn => {
    btn.onclick = () => {
      calFormGuests.splice(parseInt(btn.dataset.i), 1);
      renderGuestChips();
    };
  });
}

function addGuestFromInput() {
  const email = calGuestInput.value.trim().toLowerCase();
  if (!email) return;
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) { calGuestInput.setCustomValidity('Invalid email'); calGuestInput.reportValidity(); return; }
  calGuestInput.setCustomValidity('');
  if (!calFormGuests.includes(email)) {
    calFormGuests.push(email);
    renderGuestChips();
  }
  calGuestInput.value = '';
}

calGuestInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addGuestFromInput(); }
});
calGuestInput.addEventListener('blur', () => { if (calGuestInput.value.trim()) addGuestFromInput(); });

function updateMeetToggle() {
  if (calFormAddMeet) {
    calAddMeetBtn.textContent  = 'Remove';
    calAddMeetBtn.classList.add('cal-meet-toggle--active');
    calMeetLabel.textContent   = 'Google Meet added';
  } else {
    calAddMeetBtn.textContent  = 'Add';
    calAddMeetBtn.classList.remove('cal-meet-toggle--active');
    calMeetLabel.textContent   = 'Add Google Meet';
  }
}

calAddMeetBtn.onclick = () => { calFormAddMeet = !calFormAddMeet; updateMeetToggle(); };

function resetFormExtras() {
  calFormGuests  = [];
  calFormAddMeet = false;
  renderGuestChips();
  updateMeetToggle();
}

// ---------------------------------------------------------------------------
// Calendar — Next Meet
// ---------------------------------------------------------------------------
calNextMeetBtn.onclick = () => {
  if (!activeCalEvent) return;
  calFormMode = 'create';
  calFormHeading.textContent = 'Next Meet';

  calEvtTitle.value = activeCalEvent.summary ? `Follow-up: ${activeCalEvent.summary}` : '';

  const isAllDay = !!activeCalEvent.start.date;
  const pad2     = n => String(n).padStart(2, '0');

  let origDate;
  if (isAllDay) {
    const [y, m, d] = activeCalEvent.start.date.split('-').map(Number);
    origDate = new Date(y, m - 1, d);
  } else {
    origDate = new Date(activeCalEvent.start.dateTime);
  }
  origDate.setDate(origDate.getDate() + 7);
  calEvtDate.value = `${origDate.getFullYear()}-${pad2(origDate.getMonth() + 1)}-${pad2(origDate.getDate())}`;

  calEvtAllDay.checked     = isAllDay;
  calTimeRow.style.display = isAllDay ? 'none' : 'flex';
  calEvtStart.required     = !isAllDay;
  calEvtEnd.required       = !isAllDay;
  if (!isAllDay) {
    const s = new Date(activeCalEvent.start.dateTime);
    const e = new Date(activeCalEvent.end.dateTime);
    calEvtStart.value = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    calEvtEnd.value   = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
  }

  calFormGuests = (activeCalEvent.attendees || [])
    .map(a => a.email)
    .filter(e => e && !e.endsWith('calendar.google.com'));
  renderGuestChips();

  calEvtLocation.value = activeCalEvent.location || '';
  calEvtDesc.value     = '';
  calFormAddMeet       = true;
  updateMeetToggle();

  showCalView('create');
};

calBackFromCreate.onclick = () => {
  if (calFormMode === 'reschedule') {
    showCalView('detail');
  } else {
    showCalView('events');
  }
};

calRescheduleBtn.onclick = () => {
  if (!activeCalEvent) return;
  calFormMode = 'reschedule';
  calFormHeading.textContent = 'Reschedule';
  calEvtTitle.value    = activeCalEvent.summary || '';
  calEvtLocation.value = activeCalEvent.location || '';
  calEvtDesc.value     = activeCalEvent.description || '';

  // Pre-fill guests from existing event attendees
  calFormGuests = (activeCalEvent.attendees || [])
    .map(a => a.email)
    .filter(e => e && !e.endsWith('calendar.google.com'));
  renderGuestChips();

  // Pre-fill Meet state: active if event already has a Meet link
  calFormAddMeet = !!activeCalEvent.hangoutLink;
  updateMeetToggle();

  const isAllDay = !!activeCalEvent.start.date;
  calEvtAllDay.checked = isAllDay;
  calTimeRow.style.display = isAllDay ? 'none' : 'flex';
  calEvtStart.required = !isAllDay;
  calEvtEnd.required   = !isAllDay;

  const pad2 = n => String(n).padStart(2, '0');
  if (isAllDay) {
    calEvtDate.value = activeCalEvent.start.date;
  } else {
    const s = new Date(activeCalEvent.start.dateTime);
    const e = new Date(activeCalEvent.end.dateTime);
    calEvtDate.value  = `${s.getFullYear()}-${pad2(s.getMonth()+1)}-${pad2(s.getDate())}`;
    calEvtStart.value = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
    calEvtEnd.value   = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
  }
  showCalView('create');
};

calEvtAllDay.onchange = () => {
  calTimeRow.style.display = calEvtAllDay.checked ? 'none' : 'flex';
  calEvtStart.required = !calEvtAllDay.checked;
  calEvtEnd.required   = !calEvtAllDay.checked;
};

calNewEventBtn.onclick = () => {
  calFormMode = 'create';
  calFormHeading.textContent = 'New Event';
  calEvtTitle.value    = '';
  calEvtLocation.value = '';
  calEvtDesc.value     = '';
  calEvtAllDay.checked = false;
  resetFormExtras();
  calTimeRow.style.display = 'flex';
  calEvtStart.required = true;
  calEvtEnd.required   = true;

  // Default: today (local date), next 30-min boundary, 30-min duration
  const now  = new Date();
  const pad2 = n => String(n).padStart(2, '0');
  calEvtDate.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  let startH = now.getHours(), startM = now.getMinutes() < 30 ? 30 : 0;
  if (now.getMinutes() >= 30) startH = (startH + 1) % 24;
  let endH = startH, endM = startM + 30;
  if (endM >= 60) { endH = (endH + 1) % 24; endM -= 60; }
  const hhmm = (h, m) => `${pad2(h)}:${pad2(m)}`;
  calEvtStart.value = hhmm(startH, startM);
  calEvtEnd.value   = hhmm(endH, endM);

  showCalView('create');
};

calRecordEventBtn.onclick = () => {
  // Persist the event so background can link it to the recording after transcription
  if (activeCalEvent) chrome.storage.local.set({ pendingCalEventLink: activeCalEvent });
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

  // All-day end = start + 1 day using local date arithmetic (avoids UTC offset bugs)
  const [dy, dm, dd] = date.split('-').map(Number);
  const nextDay   = new Date(dy, dm - 1, dd + 1);
  const pad2b     = n => String(n).padStart(2, '0');
  const allDayEnd = `${nextDay.getFullYear()}-${pad2b(nextDay.getMonth() + 1)}-${pad2b(nextDay.getDate())}`;
  const startIso  = allDay ? date : toLocalISOString(date, calEvtStart.value);
  const endIso    = allDay ? allDayEnd : toLocalISOString(date, calEvtEnd.value);

  calCreateSubmit.disabled    = true;
  calCreateSubmit.textContent = 'Saving…';

  const attendees = [...calFormGuests];
  const addMeet   = calFormAddMeet;

  if (calFormMode === 'reschedule') {
    try {
      await patchCalendarEvent(
        activeCalEvent.id,
        activeCalEvent._calendarId || 'primary',
        { title, startIso, endIso, allDay, location, description: desc, attendees, addMeet }
      );
    } catch (err) {
      const errEl = calCreateView.querySelector('.cal-form-error') || document.createElement('p');
      errEl.className   = 'cal-form-error';
      errEl.textContent = err.message;
      calCreateSubmit.parentElement.insertBefore(errEl, calCreateSubmit);
      calCreateSubmit.disabled    = false;
      calCreateSubmit.textContent = 'Save';
      return;
    }
    calCreateSubmit.disabled    = false;
    calCreateSubmit.textContent = 'Save';
    calFormMode = 'create';
    calFormHeading.textContent = 'New Event';
    await loadCalendar();
    return;
  }

  // CREATE mode — optimistic insert
  try {
    const optimisticEv = {
      id:      `optimistic_${Date.now()}`,
      summary: title,
      start:   allDay ? { date } : { dateTime: startIso },
      end:     allDay ? { date: allDayEnd } : { dateTime: endIso },
      location: location || undefined,
      description: desc || undefined,
      attendees: attendees.length ? attendees.map(e => ({ email: e })) : undefined,
      _calendarColor: 'var(--primary)',
      _canDelete: true,
    };
    calEvents = [optimisticEv, ...calEvents];
    renderCalEvents(calEvents, calRecordingsMap);
    showCalView('events');

    await postCalendarEvent({ title, allDay, location, description: desc, startIso, endIso, attendees, addMeet });
  } catch (err) {
    calEvents = calEvents.filter(ev => !ev.id?.startsWith('optimistic_'));
    const errEl = calCreateView.querySelector('.cal-form-error') || document.createElement('p');
    errEl.className    = 'cal-form-error';
    errEl.textContent  = err.message;
    calCreateSubmit.parentElement.insertBefore(errEl, calCreateSubmit);
    calCreateSubmit.disabled    = false;
    calCreateSubmit.textContent = 'Save';
    showCalView('create');
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
  histListView.style.display   = view === 'list'   ? 'flex' : 'none';
  histDetailView.style.display = view === 'detail' ? 'flex' : 'none';
}

histRefreshBtn.onclick   = () => loadHistory();
histBackFromDetail.onclick = () => showHistView('list');

// ---------------------------------------------------------------------------
// History — rendering
// ---------------------------------------------------------------------------
let histRecordings  = [];
let histFolders     = [];
let histActiveRec   = null;
let histDetailTab   = 'transcript';

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

function buildSummaryHtml(s) {
  function section(title, cls, items, bullet) {
    if (!items || !items.length) return '';
    return `<div class="hist-summary-section">
      <div class="hist-summary-section-title ${cls}">${title}</div>
      ${items.map(it => `<div class="hist-summary-item"><span class="hist-summary-bullet">${bullet}</span><span>${escapeHtml(it)}</span></div>`).join('')}
    </div>`;
  }
  return (
    section('Key Points',   'kp',  s.key_points,   '▸') +
    section('Decisions',    'dec', s.decisions,    '✓') +
    section('Action Items', 'ai',  s.action_items, '→')
  ) || '<div class="hist-empty" style="padding:0.6rem 0;font-size:0.78rem;">No summary available.</div>';
}

// Shared MOM builder — professional format used by both paths
function buildMOM(rec, calEvent) {
  const DIVIDER = '═'.repeat(46);
  const pad     = (label, value) => `${label.padEnd(12)}: ${value}`;
  const s       = rec.summary || {};
  const hasData = (s.key_points?.length || s.decisions?.length || s.action_items?.length);

  const title    = rec.title || 'Recording';
  const dateStr  = rec.date
    ? new Date(rec.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Unknown';
  const timeStr  = rec.date
    ? new Date(rec.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  const dur      = formatDuration(rec.duration);

  const lines = [
    'MINUTES OF MEETING',
    DIVIDER,
    pad('Meeting', title),
    pad('Date', dateStr),
  ];
  if (timeStr)  lines.push(pad('Time', timeStr));
  lines.push(pad('Duration', dur));

  if (calEvent?.location)  lines.push(pad('Location', calEvent.location));
  if (calEvent?.hangoutLink) lines.push(pad('Link', calEvent.hangoutLink));
  if (rec.description)     lines.push(pad('Notes', rec.description));

  lines.push(pad('Prepared by', 'Recora'));
  lines.push('');
  lines.push(DIVIDER);

  // Attendees
  const attendees = calEvent?.attendees || [];
  if (attendees.length) {
    lines.push('');
    lines.push('ATTENDEES');
    attendees.forEach(a => {
      const name  = a.displayName || a.email || String(a);
      const role  = a.organizer ? ' (Organiser)' : a.optional ? ' (Optional)' : '';
      const email = a.displayName && a.email ? ` <${a.email}>` : '';
      lines.push(`  • ${name}${email}${role}`);
    });
  } else if (rec.transcript?.length) {
    lines.push('');
    lines.push('PARTICIPANTS');
    [...new Set(rec.transcript.map(u => u.speaker))].forEach(sp => lines.push(`  • ${sp}`));
  }

  // Key discussion points
  if ((s.key_points || []).length) {
    lines.push('');
    lines.push('KEY DISCUSSION POINTS');
    s.key_points.forEach(kp => lines.push(`  ▸  ${kp}`));
  }

  // Decisions
  if ((s.decisions || []).length) {
    lines.push('');
    lines.push('DECISIONS MADE');
    s.decisions.forEach((d, i) => lines.push(`  ${i + 1}. ✓  ${d}`));
  }

  // Action items
  if ((s.action_items || []).length) {
    lines.push('');
    lines.push('ACTION ITEMS');
    s.action_items.forEach((a, i) => lines.push(`  ${i + 1}. →  ${a}`));
  }

  if (!hasData) {
    lines.push('');
    lines.push('  (No summary data available — transcription may still be processing.)');
  }

  lines.push('');
  lines.push(DIVIDER);
  lines.push(`Generated by Recora on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`);

  return lines.join('\n');
}

function generateMOM(rec)                    { return buildMOM(rec, null); }
function generateMOMWithEvent(rec, calEvent) { return buildMOM(rec, calEvent); }

function buildTranscriptText(rec) {
  if (!rec.transcript || !rec.transcript.length) return 'No transcript available.';
  return rec.transcript.map(u => `[${u.timestamp}] ${u.speaker}:\n${u.text}`).join('\n\n');
}

function buildSummaryText(rec) {
  const s = rec.summary || {};
  const lines = [`MEETING SUMMARY — ${rec.title || 'Recording'}`, '─'.repeat(38)];
  if ((s.key_points || []).length) {
    lines.push('', 'KEY POINTS');
    s.key_points.forEach(kp => lines.push(`  ▸ ${kp}`));
  }
  if ((s.decisions || []).length) {
    lines.push('', 'DECISIONS');
    s.decisions.forEach(d => lines.push(`  ✓ ${d}`));
  }
  if ((s.action_items || []).length) {
    lines.push('', 'ACTION ITEMS');
    s.action_items.forEach(a => lines.push(`  → ${a}`));
  }
  if (lines.length <= 2) lines.push('', '(No summary data available)');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PDF download + email helpers
// ---------------------------------------------------------------------------
function buildPdfPayload(type, rec, calEvent) {
  return {
    type,
    recording: {
      title:      rec.title,
      createdAt:  rec.createdAt || rec.date,
      duration:   rec.duration,
      transcript: rec.transcript || [],
      summary:    rec.summary    || {},
    },
    calEvent: calEvent || null,
  };
}

async function downloadDocPdf(btn, type, rec, calEvent) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    let token;
    try { token = await getAuthToken(false); } catch (_) { token = await getAuthToken(true); }
    const res = await fetch(`${BACKEND}/generate-pdf`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildPdfPayload(type, rec, calEvent)),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(t || `HTTP ${res.status}`); }
    const ab   = await res.arrayBuffer();
    const blob = new Blob([ab], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const safe = (rec.title || 'recording').replace(/[^a-z0-9_\-]/gi, '_');
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename: `${safe}_${type}.pdf`, saveAs: false }, id => {
        chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(id);
      });
    });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    btn.textContent = 'Done!';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
  } catch (err) {
    console.error('PDF download error:', err);
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2500);
  }
}

async function sendDocEmail(btn, type, rec, calEvent) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    let token;
    try { token = await getAuthToken(false); } catch (_) { token = await getAuthToken(true); }
    const res = await fetch(`${BACKEND}/send-document-email`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildPdfPayload(type, rec, calEvent)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    btn.textContent = 'Sent!';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2500);
  } catch (err) {
    console.error('Email send error:', err);
    btn.textContent = 'Failed';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2500);
  }
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

function renderHistoryCards(recs, folders) {
  if (!recs.length) {
    histCardsList.innerHTML = `
      <div class="hist-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25;display:block;margin:0 auto 0.6rem"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        No recordings yet.<br><small>Recordings appear here after you stop recording.</small>
      </div>`;
    return;
  }

  const foldersArr = folders || [];
  histCardsList.innerHTML = recs.map((rec, i) => {
    const s       = rec.status || 'processing';
    const badgeCls = s === 'done' ? 'done' : (s === 'transcribing' || s === 'processing') ? 'transcribing' : 'failed';
    const badgeLbl = s === 'done' ? 'Done'
      : s === 'transcribing'         ? 'Transcribing…'
      : s === 'upload_failed'        ? 'Upload Failed'
      : s === 'transcription_failed' ? 'Failed'
      : 'Processing…';
    const folder      = foldersArr.find(f => f.id === rec.folderId);
    const folderBadge = folder
      ? `<span class="hist-folder-badge" style="border-color:${folder.color}40;color:${folder.color}"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>${escapeHtml(folder.name)}</span>` : '';
    return `
      <div class="hist-card" data-idx="${i}">
        <div class="hist-card-title-row">
          <span class="hist-card-title">${escapeHtml(rec.title || 'Recording')}</span>
          <span class="hist-status-badge ${badgeCls}">${badgeLbl}</span>
          <svg class="ev-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="hist-card-meta">
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${escapeHtml(formatRecDate(rec.date))}
          </span>
          <span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${escapeHtml(formatDuration(rec.duration))}
          </span>
          ${folderBadge}
        </div>
      </div>`;
  }).join('');

  histCardsList.querySelectorAll('.hist-card').forEach(card => {
    card.addEventListener('click', () => {
      showHistDetail(histRecordings[parseInt(card.dataset.idx)]);
    });
  });
}

function showHistDetail(rec) {
  histActiveRec = rec;
  histDetailTab = 'transcript';
  histDetailHeading.textContent = rec.title || 'Recording';
  showHistView('detail');
  renderHistDetailContent(rec);
}

function renderHistDetailContent(rec) {
  const s        = rec.status || 'processing';
  const badgeCls = s === 'done' ? 'done' : (s === 'transcribing' || s === 'processing') ? 'transcribing' : 'failed';
  const badgeLbl = s === 'done' ? 'Done'
    : s === 'transcribing'         ? 'Transcribing…'
    : s === 'upload_failed'        ? 'Upload Failed'
    : s === 'transcription_failed' ? 'Failed'
    : 'Processing…';
  const hasT = rec.transcript && rec.transcript.length > 0;
  const hasS = rec.summary && (
    (rec.summary.key_points   || []).length +
    (rec.summary.decisions    || []).length +
    (rec.summary.action_items || []).length > 0
  );

  const transcriptHtml = hasT
    ? rec.transcript.map(u => `<div class="hist-utterance">
        <div class="hist-speaker-col">
          <span class="hist-speaker-name ${speakerColorClass(u.speaker)}">${escapeHtml(u.speaker)}</span>
          <span class="hist-timestamp">${escapeHtml(u.timestamp)}</span>
        </div>
        <div class="hist-utt-text">${escapeHtml(u.text)}</div>
      </div>`).join('')
    : `<div class="hist-empty" style="padding:0.8rem 0;">No transcript available.</div>`;

  const summaryHtml = hasS
    ? buildSummaryHtml(rec.summary)
    : `<div class="hist-empty" style="padding:0.8rem 0;">No summary available.</div>`;

  // MOM — include linked calendar event attendees if available
  chrome.storage.local.get(['calEventRecordings'], result => {
    const linkMap   = result.calEventRecordings || {};
    const calEvent  = Object.values(linkMap).find(v => v.recordingId === rec.id)?.event || null;
    const momText   = generateMOMWithEvent(rec, calEvent);
    const momHtml   = `<div class="hist-mom-body">${escapeHtml(momText)}</div>`;

    const tab = histDetailTab;
    histDetailContent.innerHTML = `
      <div class="hist-detail-header">
        <div class="hist-detail-title">${escapeHtml(rec.title || 'Recording')}</div>
        <span class="hist-status-badge ${badgeCls}">${badgeLbl}</span>
      </div>
      <div class="hist-detail-meta-row">
        <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${escapeHtml(formatRecDate(rec.date))}</span>
        <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${escapeHtml(formatDuration(rec.duration))}</span>
      </div>
      ${rec.description ? `<div class="hist-detail-desc">${escapeHtml(rec.description)}</div>` : ''}
      ${s === 'transcription_failed' && rec.transcription_error ? `<div class="hist-card-error" style="padding:0.4rem 0">${escapeHtml(rec.transcription_error)}</div>` : ''}
      <div class="hist-tabs">
        <button class="hist-tab${tab==='transcript'?' active':''}" data-dtab="transcript">Transcript</button>
        <button class="hist-tab${tab==='summary'?' active':''}" data-dtab="summary">Summary</button>
        <button class="hist-tab${tab==='mom'?' active':''}" data-dtab="mom">MOM</button>
      </div>
      <div class="hist-detail-tab-content">
        <div class="hist-tab-pane${tab==='transcript'?' active':''}" data-dpane="transcript">${transcriptHtml}</div>
        <div class="hist-tab-pane${tab==='summary'?' active':''}" data-dpane="summary">${summaryHtml}</div>
        <div class="hist-tab-pane${tab==='mom'?' active':''}" data-dpane="mom">${momHtml}</div>
      </div>
      <div class="hist-download-section">
        <div class="hist-download-label">Download Text</div>
        <div class="hist-download-row">
          <button class="hist-download-btn" data-dl="transcript" ${!hasT ? 'disabled' : ''}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
            Transcript
          </button>
          <button class="hist-download-btn" data-dl="summary" ${!hasS ? 'disabled' : ''}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            Summary
          </button>
          <button class="hist-download-btn" data-dl="mom">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="12" y2="17"></line></svg>
            MOM
          </button>
          <button class="hist-download-btn" data-dl="webm" ${!rec.audio_url ? 'disabled' : ''}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            WebM
          </button>
          <button class="hist-download-btn wav-btn" data-dl="wav" ${!rec.audio_url && !rec.wav_url ? 'disabled' : ''}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            WAV
          </button>
        </div>
      </div>
      ${s === 'done' ? `
      <div class="hist-pdf-section">
        <div class="hist-pdf-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          PDF Export
        </div>
        <div class="hist-pdf-row">
          <span class="hist-pdf-row-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Download
          </span>
          <div class="hist-pdf-btns">
            <button class="hist-pdf-btn" data-pdf="transcript" ${!hasT ? 'disabled' : ''}>Transcript</button>
            <button class="hist-pdf-btn" data-pdf="summary"    ${!hasS ? 'disabled' : ''}>Summary</button>
            <button class="hist-pdf-btn" data-pdf="mom">MOM</button>
          </div>
        </div>
        <div class="hist-pdf-row">
          <span class="hist-pdf-row-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            Email
          </span>
          <div class="hist-pdf-btns">
            <button class="hist-pdf-btn hist-email-btn" data-email="transcript" ${!hasT ? 'disabled' : ''}>Transcript</button>
            <button class="hist-pdf-btn hist-email-btn" data-email="summary"    ${!hasS ? 'disabled' : ''}>Summary</button>
            <button class="hist-pdf-btn hist-email-btn" data-email="mom">MOM</button>
          </div>
        </div>
      </div>` : ''}
      <div class="hist-folder-assign">
        <label class="hist-folder-assign-label">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          Folder
        </label>
        <select class="hist-folder-select" id="histFolderSelect">
          <option value="">— None —</option>
        </select>
      </div>
      <button class="hist-detail-delete-btn" id="histDetailDeleteBtn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>
        Delete Recording
      </button>`;

    // Tab switching
    histDetailContent.querySelectorAll('[data-dtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        histDetailTab = btn.dataset.dtab;
        histDetailContent.querySelectorAll('[data-dtab]').forEach(t => t.classList.remove('active'));
        histDetailContent.querySelectorAll('[data-dpane]').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        histDetailContent.querySelector(`[data-dpane="${btn.dataset.dtab}"]`).classList.add('active');
      });
    });

    // Download buttons
    const safe = (rec.title || 'recording').replace(/[^a-z0-9_\-]/gi, '_');
    histDetailContent.querySelectorAll('[data-dl]').forEach(btn => {
      btn.addEventListener('click', () => {
        switch (btn.dataset.dl) {
          case 'transcript': downloadTextFile(`${safe}_transcript.txt`, buildTranscriptText(rec)); break;
          case 'summary':    downloadTextFile(`${safe}_summary.txt`,    buildSummaryText(rec));    break;
          case 'mom':        downloadTextFile(`${safe}_mom.txt`,        generateMOMWithEvent(rec, calEvent)); break;
          case 'webm':       downloadWebm(rec); break;
          case 'wav':        downloadWav(btn, rec); break;
        }
      });
    });

    // PDF download buttons
    histDetailContent.querySelectorAll('[data-pdf]').forEach(btn => {
      btn.addEventListener('click', () => downloadDocPdf(btn, btn.dataset.pdf, rec, calEvent));
    });

    // Email send buttons
    histDetailContent.querySelectorAll('[data-email]').forEach(btn => {
      btn.addEventListener('click', () => sendDocEmail(btn, btn.dataset.email, rec, calEvent));
    });

    // Delete with confirm
    const deleteBtn = document.getElementById('histDetailDeleteBtn');
    deleteBtn.addEventListener('click', () => {
      if (!deleteBtn._confirmPending) {
        deleteBtn._confirmPending = true;
        deleteBtn.textContent = 'Confirm delete?';
        setTimeout(() => {
          if (deleteBtn._confirmPending) {
            deleteBtn._confirmPending = false;
            deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg> Delete Recording`;
          }
        }, 3000);
        return;
      }
      deleteBtn._confirmPending = false;
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting…';
      showHistView('list');
      doDeleteRecording(rec.id);
    });

    // Folder assign select
    const folderSelect = document.getElementById('histFolderSelect');
    if (folderSelect) {
      chrome.storage.local.get(['histFolders'], result => {
        const folders = result.histFolders || [];
        folderSelect.innerHTML = `<option value="">— None —</option>` +
          folders.map(f => `<option value="${escapeHtml(f.id)}"${rec.folderId === f.id ? ' selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
        folderSelect.onchange = () => {
          const newFolderId = folderSelect.value || null;
          // Update in local storage
          chrome.storage.local.get(['recordings'], r => {
            const recs = (r.recordings || []).map(rx =>
              rx.id === rec.id ? { ...rx, folderId: newFolderId } : rx
            );
            chrome.storage.local.set({ recordings: recs });
          });
          // Also update histRecordings in memory
          histRecordings = histRecordings.map(rx =>
            rx.id === rec.id ? { ...rx, folderId: newFolderId } : rx
          );
          // Sync to Azure (best-effort)
          azureSyncRecordings(histRecordings);
        };
      });
    }
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

function doDeleteRecording(recId) {
  // Always delete locally — never restore on Azure failure.
  // Azure sync is best-effort metadata sync, not the deletion gate.
  histRecordings = histRecordings.filter(r => r.id !== recId);
  showHistView('list');
  renderHistoryCards(histRecordings, histFolders);

  chrome.storage.local.get(['recordings'], result => {
    const recs = (result.recordings || []).filter(r => r.id !== recId);
    chrome.storage.local.set({ recordings: recs });
  });

  // Best-effort Azure metadata sync — failure is silent, local delete already done
  azureSyncRecordings(histRecordings).catch(() => {});
}

function deleteHistRecording(recId, cardEl, confirmBtn) {
  if (!confirmBtn._confirmPending) {
    confirmBtn._confirmPending = true;
    confirmBtn.textContent = 'Sure?';
    confirmBtn.style.color = 'var(--danger)';
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
  confirmBtn._confirmPending = false;
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting…';
  doDeleteRecording(recId);
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
    const azureRecs = await azureLoadRecordings();

    const [localResult, foldersResult] = await Promise.all([
      new Promise(resolve => chrome.storage.local.get(['recordings'], resolve)),
      new Promise(resolve => chrome.storage.local.get(['histFolders'],  resolve)),
    ]);

    const azureIds    = new Set(azureRecs.map(r => r.id));
    const localToShow = (localResult.recordings || []).filter(r =>
      r.userId === currentUser?.sub &&
      (r.status === 'processing' || r.status === 'transcribing' || !azureIds.has(r.id))
    );

    histRecordings = mergeRecordings(localToShow, azureRecs);
    histFolders    = foldersResult.histFolders || [];
    renderHistoryCards(histRecordings, histFolders);
  } catch (err) {
    histCardsList.innerHTML = `<div class="hist-empty"><small>${escapeHtml(err.message)}</small></div>`;
  } finally {
    histRefreshBtn.classList.remove('spinning');
  }
}

// ---------------------------------------------------------------------------
// Folders — constants
// ---------------------------------------------------------------------------
const FOLDER_COLORS = [
  '#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#3b82f6','#a78bfa','#f97316','#6366f1',
];

const FOLDER_ICONS = [
  { id: 'folder',  svg: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>' },
  { id: 'star',    svg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>' },
  { id: 'work',    svg: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>' },
  { id: 'mic',     svg: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>' },
  { id: 'user',    svg: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>' },
  { id: 'book',    svg: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>' },
  { id: 'heart',   svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>' },
  { id: 'tag',     svg: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>' },
];

// ---------------------------------------------------------------------------
// Folders — state
// ---------------------------------------------------------------------------
let foldersList_data = [];  // array of { id, name, color, icon }
let activeFolderId   = null;

// ---------------------------------------------------------------------------
// Folders — helpers
// ---------------------------------------------------------------------------
function showFolderView(view) {
  foldersListView.style.display  = view === 'list'   ? 'flex' : 'none';
  folderDetailView.style.display = view === 'detail' ? 'flex' : 'none';
  folderFormView.style.display   = view === 'form'   ? 'flex' : 'none';
}

function loadFolders(callback) {
  chrome.storage.local.get(['histFolders'], result => {
    foldersList_data = result.histFolders || [];
    if (callback) callback(foldersList_data);
  });
}

function saveFolders(folders, callback) {
  chrome.storage.local.set({ histFolders: folders }, callback);
}

function renderFolderList() {
  if (!foldersList_data.length) {
    foldersList.innerHTML = `
      <div class="hist-empty" style="padding:1.5rem 0;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25;display:block;margin:0 auto 0.6rem"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        No folders yet.<br><small>Create one to organise your recordings.</small>
      </div>`;
    return;
  }

  chrome.storage.local.get(['recordings'], result => {
    const recs = result.recordings || [];
    foldersList.innerHTML = foldersList_data.map((f, i) => {
      const count   = recs.filter(r => r.folderId === f.id).length;
      const iconDef = FOLDER_ICONS.find(ic => ic.id === f.icon) || FOLDER_ICONS[0];
      return `
        <div class="folder-card" data-fidx="${i}">
          <div class="folder-card-icon" style="color:${f.color}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconDef.svg}</svg>
          </div>
          <div class="folder-card-info">
            <div class="folder-card-name">${escapeHtml(f.name)}</div>
            <div class="folder-card-meta">${count} recording${count !== 1 ? 's' : ''}</div>
          </div>
          <svg class="ev-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>`;
    }).join('');

    foldersList.querySelectorAll('.folder-card').forEach(card => {
      card.onclick = () => openFolderDetail(foldersList_data[parseInt(card.dataset.fidx)]);
    });
  });
}

function openFolderDetail(folder) {
  activeFolderId = folder.id;
  folderDetailName.textContent = folder.name;
  showFolderView('detail');

  chrome.storage.local.get(['recordings'], result => {
    const recs = (result.recordings || []).filter(r => r.folderId === folder.id);
    if (!recs.length) {
      folderDetailRecords.innerHTML = `<div class="hist-empty" style="padding:1rem 0;">No recordings in this folder.</div>`;
      return;
    }
    folderDetailRecords.innerHTML = recs.map((rec, i) => {
      const s       = rec.status || 'processing';
      const badgeCls = s === 'done' ? 'done' : (s === 'transcribing' || s === 'processing') ? 'transcribing' : 'failed';
      const badgeLbl = s === 'done' ? 'Done' : s === 'transcribing' ? 'Transcribing…' : s === 'upload_failed' ? 'Upload Failed' : s === 'transcription_failed' ? 'Failed' : 'Processing…';
      return `
        <div class="hist-card" data-ridx="${i}">
          <div class="hist-card-title-row">
            <span class="hist-card-title">${escapeHtml(rec.title || 'Recording')}</span>
            <span class="hist-status-badge ${badgeCls}">${badgeLbl}</span>
            <svg class="ev-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="hist-card-meta">
            <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${escapeHtml(formatRecDate(rec.date))}</span>
            <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${escapeHtml(formatDuration(rec.duration))}</span>
          </div>
        </div>`;
    }).join('');

    folderDetailRecords.querySelectorAll('.hist-card').forEach(card => {
      card.onclick = () => {
        showTab('history');
        const allRecs = [...histRecordings];
        const rec = recs[parseInt(card.dataset.ridx)];
        const match = allRecs.find(r => r.id === rec.id) || rec;
        showHistDetail(match);
      };
    });
  });
}

function buildFolderForm(folder) {
  let selectedColor = folder?.color || FOLDER_COLORS[0];
  let selectedIcon  = folder?.icon  || FOLDER_ICONS[0].id;

  folderFormColors.innerHTML = FOLDER_COLORS.map(c =>
    `<button type="button" class="folders-color-swatch${c === selectedColor ? ' selected' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`
  ).join('');

  folderFormIcons.innerHTML = FOLDER_ICONS.map(ic =>
    `<button type="button" class="folders-icon-swatch${ic.id === selectedIcon ? ' selected' : ''}" data-icon="${ic.id}">
       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic.svg}</svg>
     </button>`
  ).join('');

  folderFormColors.querySelectorAll('.folders-color-swatch').forEach(sw => {
    sw.onclick = () => {
      folderFormColors.querySelectorAll('.folders-color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedColor = sw.dataset.color;
      folderFormSaveBtn._selectedColor = selectedColor;
    };
  });

  folderFormIcons.querySelectorAll('.folders-icon-swatch').forEach(sw => {
    sw.onclick = () => {
      folderFormIcons.querySelectorAll('.folders-icon-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      selectedIcon = sw.dataset.icon;
      folderFormSaveBtn._selectedIcon = selectedIcon;
    };
  });

  folderFormSaveBtn._selectedColor = selectedColor;
  folderFormSaveBtn._selectedIcon  = selectedIcon;
}

function openFolderCreateForm() {
  folderFormTitle.textContent = 'New Folder';
  folderFormName.value = '';
  folderFormSaveBtn._editingId = null;
  buildFolderForm(null);
  showFolderView('form');
}

function openFolderEditForm(folder) {
  folderFormTitle.textContent = 'Edit Folder';
  folderFormName.value = folder.name;
  folderFormSaveBtn._editingId = folder.id;
  buildFolderForm(folder);
  showFolderView('form');
}

// ---------------------------------------------------------------------------
// Folders — nav & button handlers
// ---------------------------------------------------------------------------
navFolders.onclick = () => {
  showTab('folders');
  loadFolders(() => {
    renderFolderList();
    showFolderView('list');
  });
};

folderNewBtn.onclick = () => openFolderCreateForm();

folderBackBtn.onclick = () => {
  activeFolderId = null;
  showFolderView('list');
};

folderFormBackBtn.onclick = () => {
  if (activeFolderId) {
    showFolderView('detail');
  } else {
    showFolderView('list');
  }
};

folderEditBtn.onclick = () => {
  const folder = foldersList_data.find(f => f.id === activeFolderId);
  if (folder) openFolderEditForm(folder);
};

folderDeleteBtn.onclick = () => {
  if (!activeFolderId) return;
  if (!folderDeleteBtn._confirmPending) {
    folderDeleteBtn._confirmPending = true;
    const orig = folderDeleteBtn.innerHTML;
    folderDeleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>`;
    folderDeleteBtn.style.borderColor = 'rgba(239,68,68,0.5)';
    folderDeleteBtn.style.color = 'var(--danger)';
    setTimeout(() => {
      if (folderDeleteBtn._confirmPending) {
        folderDeleteBtn._confirmPending = false;
        folderDeleteBtn.innerHTML = orig;
        folderDeleteBtn.style.borderColor = '';
        folderDeleteBtn.style.color = '';
      }
    }, 3000);
    return;
  }
  folderDeleteBtn._confirmPending = false;
  folderDeleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>`;
  folderDeleteBtn.style.borderColor = '';
  folderDeleteBtn.style.color = '';

  const folderId = activeFolderId;
  foldersList_data = foldersList_data.filter(f => f.id !== folderId);

  // Unassign recordings that were in this folder
  chrome.storage.local.get(['recordings'], result => {
    const recs = (result.recordings || []).map(r =>
      r.folderId === folderId ? { ...r, folderId: null } : r
    );
    chrome.storage.local.set({ recordings: recs });
  });

  saveFolders(foldersList_data, () => {
    activeFolderId = null;
    renderFolderList();
    showFolderView('list');
  });
};

folderFormSaveBtn.onclick = () => {
  const name = folderFormName.value.trim();
  if (!name) { folderFormName.focus(); return; }

  const color = folderFormSaveBtn._selectedColor || FOLDER_COLORS[0];
  const icon  = folderFormSaveBtn._selectedIcon  || FOLDER_ICONS[0].id;
  const editId = folderFormSaveBtn._editingId;

  if (editId) {
    // Edit existing
    foldersList_data = foldersList_data.map(f =>
      f.id === editId ? { ...f, name, color, icon } : f
    );
  } else {
    // New folder
    const newFolder = { id: `folder_${Date.now()}`, name, color, icon };
    foldersList_data.push(newFolder);
  }

  saveFolders(foldersList_data, () => {
    renderFolderList();
    if (editId) {
      // Return to detail of the edited folder
      const updated = foldersList_data.find(f => f.id === editId);
      if (updated) { openFolderDetail(updated); return; }
    }
    activeFolderId = null;
    showFolderView('list');
  });
};

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