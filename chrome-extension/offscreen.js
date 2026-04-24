// =============================================================================
// offscreen.js
// Runs in a hidden offscreen document (full window context, survives popup close).
// Owns: getUserMedia, AudioContext, MediaRecorder.
// Communicates with background.js via chrome.runtime.onMessage / sendMessage.
//
// Large audio blobs go to IndexedDB — never through sendMessage (64 MiB limit).
// WAV conversion is NOT done here; popup.js handles on-demand WAV download.
// =============================================================================

let mediaRecorder      = null;
let recordedChunks     = [];
let audioContext       = null;
let micStream          = null;
let tabStream          = null;
let audioPlayback      = null;
let recordingStartTime = null;
let totalPausedMs      = 0;
let pauseStartTime     = null;

// ---------------------------------------------------------------------------
// IndexedDB helpers — shared extension origin with background service worker
// ---------------------------------------------------------------------------
const IDB_NAME    = 'recora-recordings';
const IDB_VERSION = 1;
const IDB_STORE   = 'blobs';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

// ---------------------------------------------------------------------------
// Start recording
// ---------------------------------------------------------------------------
async function startRecording({ userId, tabStreamId }) {
  try {
    // 1. Microphone stream
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  true,
        sampleRate:       48000,
        channelCount:     2,
      },
    });

    // 2. Tab audio — reconstructed from the streamId obtained in the popup
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: tabStreamId } },
      video: false,
    });

    // Play tab audio so user still hears the meeting
    audioPlayback = new Audio();
    audioPlayback.srcObject = tabStream;
    audioPlayback.play().catch(e => console.warn('Playback error:', e));

    // 3. Mix mic + tab via AudioContext
    audioContext = new AudioContext({ sampleRate: 48000 });
    const destination = audioContext.createMediaStreamDestination();
    const merger      = audioContext.createChannelMerger(2);

    const tabGain = audioContext.createGain(); tabGain.gain.value = 1.2;
    const micGain = audioContext.createGain(); micGain.gain.value = 2.0;

    const tabSource   = audioContext.createMediaStreamSource(tabStream);
    tabSource.connect(tabGain);
    const tabSplitter = audioContext.createChannelSplitter(1);
    tabGain.connect(tabSplitter);
    tabSplitter.connect(merger, 0, 0);

    const micSource   = audioContext.createMediaStreamSource(micStream);
    micSource.connect(micGain);
    const micSplitter = audioContext.createChannelSplitter(1);
    micGain.connect(micSplitter);
    micSplitter.connect(merger, 0, 1);

    merger.connect(destination);

    // 4. MediaRecorder
    mediaRecorder  = new MediaRecorder(destination.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 256000,
    });
    recordedChunks     = [];
    recordingStartTime = Date.now();
    totalPausedMs      = 0;
    pauseStartTime     = null;

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      // Stop all tracks; close AudioContext
      micStream?.getTracks().forEach(t => t.stop());
      tabStream?.getTracks().forEach(t => t.stop());
      if (audioPlayback) { audioPlayback.pause(); audioPlayback.srcObject = null; audioPlayback = null; }
      audioContext?.close(); audioContext = null;
      micStream = null; tabStream = null;

      const blob     = new Blob(recordedChunks, { type: 'audio/webm' });
      recordedChunks = []; // free memory immediately

      const activeMs = Date.now() - recordingStartTime - totalPausedMs;
      const minutes  = Math.floor(activeMs / 60000);
      const seconds  = Math.floor((activeMs % 60000) / 1000);

      // Store blob in IndexedDB — avoids chrome.runtime.sendMessage 64 MiB limit
      const idbKey = `blob_${Date.now()}`;
      try {
        await idbPut(idbKey, blob);
      } catch (idbErr) {
        chrome.runtime.sendMessage({
          action: 'offscreenRecordingError',
          error:  `Failed to store audio: ${idbErr.message}`,
        }, () => void chrome.runtime.lastError);
        return;
      }

      chrome.runtime.sendMessage({
        action:   'offscreenRecordingStopped',
        userId,
        idbKey,
        duration: { audioMinutes: minutes, audioSeconds: seconds },
      }, () => void chrome.runtime.lastError);
    };

    // 1-second timeslice so pause/resume correctly excludes paused segments
    mediaRecorder.start(1000);

    chrome.runtime.sendMessage({
      action:    'offscreenRecordingStarted',
      startTime: recordingStartTime,
    }, () => void chrome.runtime.lastError);

  } catch (error) {
    micStream?.getTracks().forEach(t => t.stop());
    tabStream?.getTracks().forEach(t => t.stop());
    audioContext?.close();
    micStream = null; tabStream = null; audioContext = null;

    chrome.runtime.sendMessage({
      action: 'offscreenRecordingError',
      error:  error.message,
    }, () => void chrome.runtime.lastError);
  }
}

// ---------------------------------------------------------------------------
// Stop recording
// ---------------------------------------------------------------------------
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    if (mediaRecorder.state === 'paused' && pauseStartTime) {
      totalPausedMs += Date.now() - pauseStartTime;
      pauseStartTime = null;
    }
    mediaRecorder.stop();
  }
}

// ---------------------------------------------------------------------------
// Pause recording
// ---------------------------------------------------------------------------
function pauseRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
  try {
    mediaRecorder.pause();
    pauseStartTime = Date.now();
    chrome.runtime.sendMessage({ action: 'offscreenRecordingPaused' }, () => void chrome.runtime.lastError);
  } catch (e) {
    chrome.runtime.sendMessage({ action: 'offscreenRecordingError', error: `Pause failed: ${e.message}` }, () => void chrome.runtime.lastError);
  }
}

// ---------------------------------------------------------------------------
// Resume recording
// ---------------------------------------------------------------------------
function resumeRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') return;
  try {
    mediaRecorder.resume();
    if (pauseStartTime) { totalPausedMs += Date.now() - pauseStartTime; pauseStartTime = null; }
    chrome.runtime.sendMessage({ action: 'offscreenRecordingResumed' }, () => void chrome.runtime.lastError);
  } catch (e) {
    chrome.runtime.sendMessage({ action: 'offscreenRecordingError', error: `Resume failed: ${e.message}` }, () => void chrome.runtime.lastError);
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return false;
  if (message.action === 'startRecording')  startRecording({ userId: message.userId, tabStreamId: message.tabStreamId });
  if (message.action === 'stopRecording')   stopRecording();
  if (message.action === 'pauseRecording')  pauseRecording();
  if (message.action === 'resumeRecording') resumeRecording();
  return false;
});
