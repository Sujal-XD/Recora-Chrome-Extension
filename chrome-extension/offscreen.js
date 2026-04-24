// =============================================================================
// offscreen.js
// Runs in a hidden offscreen document (full window context, survives popup close).
// Owns: getUserMedia, AudioContext, MediaRecorder — exactly your original logic.
// Communicates with background.js via chrome.runtime.onMessage / sendMessage.
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
// WAV encoder — RIFF/PCM from an AudioBuffer
// ---------------------------------------------------------------------------
function audioBufferToWav(buffer) {
  const numCh      = buffer.numberOfChannels;
  const sr         = buffer.sampleRate;
  const len        = buffer.length;
  const bytePS     = 2; // 16-bit
  const blockAlign = numCh * bytePS;
  const dataLen    = len * blockAlign;
  const ab         = new ArrayBuffer(44 + dataLen);
  const view       = new DataView(ab);

  const str = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF');  view.setUint32(4,  36 + dataLen, true);
  str(8, 'WAVE');  str(12, 'fmt ');
  view.setUint32(16, 16,          true); // subchunk1 size
  view.setUint16(20, 1,           true); // PCM
  view.setUint16(22, numCh,       true);
  view.setUint32(24, sr,          true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign,  true);
  view.setUint16(34, 16,          true); // bits per sample
  str(36, 'data'); view.setUint32(40, dataLen, true);

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

// ---------------------------------------------------------------------------
// Start recording — your original logic, untouched
// ---------------------------------------------------------------------------
async function startRecording({ userId, tabStreamId }) {
  try {
    // 1. Microphone stream
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
      },
    });

    // 2. Tab audio — reconstructed from the streamId obtained in the popup
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: tabStreamId,
        },
      },
      video: false,
    });

    // 2b. Play tab audio to speakers so user can still hear the meeting
    audioPlayback = new Audio();
    audioPlayback.srcObject = tabStream;
    audioPlayback.play().catch((e) => console.warn('Playback error:', e));

    // 3. Mix streams — your original AudioContext logic
    audioContext = new AudioContext({ sampleRate: 48000 });
    const destination = audioContext.createMediaStreamDestination();
    const merger      = audioContext.createChannelMerger(2);

    const tabGain = audioContext.createGain();
    tabGain.gain.value = 1.2;
    const micGain = audioContext.createGain();
    micGain.gain.value = 2.0;

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

    // 4. MediaRecorder — your original settings
    mediaRecorder  = new MediaRecorder(destination.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 256000,
    });
    recordedChunks     = [];
    recordingStartTime = Date.now();
    totalPausedMs      = 0;
    pauseStartTime     = null;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      // Stop tracks — keep audioContext alive until WAV conversion finishes
      micStream?.getTracks().forEach((t) => t.stop());
      tabStream?.getTracks().forEach((t) => t.stop());
      if (audioPlayback) { audioPlayback.pause(); audioPlayback.srcObject = null; audioPlayback = null; }
      micStream = null;
      tabStream = null;

      const blob     = new Blob(recordedChunks, { type: 'audio/webm' });
      const activeMs = Date.now() - recordingStartTime - totalPausedMs;
      const minutes  = Math.floor(activeMs / 60000);
      const seconds  = Math.floor((activeMs % 60000) / 1000);

      // Convert WebM → WAV using the still-open AudioContext
      let wavBase64 = null;
      try {
        const arrayBuf = await blob.arrayBuffer();
        const decoded  = await audioContext.decodeAudioData(arrayBuf);
        const wavBuf   = audioBufferToWav(decoded);
        const wavBlob  = new Blob([wavBuf], { type: 'audio/wav' });
        wavBase64 = await new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.readAsDataURL(wavBlob);
        });
      } catch (e) {
        console.warn('WAV conversion failed:', e);
      }

      audioContext?.close();
      audioContext = null;

      // Convert WebM blob to base64 and send both to background
      const reader = new FileReader();
      reader.onloadend = () => {
        chrome.runtime.sendMessage({
          action:      'offscreenRecordingStopped',
          userId,
          blobData:    reader.result,
          wavBlobData: wavBase64,
          duration:    { audioMinutes: minutes, audioSeconds: seconds },
        }, () => void chrome.runtime.lastError);
      };
      reader.readAsDataURL(blob);
    };

    // timeslice=1000ms: collect chunks every second so pause()/resume() correctly
    // excludes paused segments from the final blob in all Chrome versions
    mediaRecorder.start(1000);

    // Notify background that recording is live
    chrome.runtime.sendMessage({
      action:    'offscreenRecordingStarted',
      startTime: recordingStartTime,
    }, () => void chrome.runtime.lastError);

  } catch (error) {
    // Clean up on failure
    micStream?.getTracks().forEach((t) => t.stop());
    tabStream?.getTracks().forEach((t) => t.stop());
    audioContext?.close();
    micStream    = null;
    tabStream    = null;
    audioContext = null;

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
    // If currently paused, account for that pause segment before stopping
    if (mediaRecorder.state === 'paused' && pauseStartTime) {
      totalPausedMs += Date.now() - pauseStartTime;
      pauseStartTime = null;
    }
    mediaRecorder.stop(); // triggers onstop → sends offscreenRecordingStopped
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
    if (pauseStartTime) {
      totalPausedMs += Date.now() - pauseStartTime;
      pauseStartTime = null;
    }
    chrome.runtime.sendMessage({ action: 'offscreenRecordingResumed' }, () => void chrome.runtime.lastError);
  } catch (e) {
    chrome.runtime.sendMessage({ action: 'offscreenRecordingError', error: `Resume failed: ${e.message}` }, () => void chrome.runtime.lastError);
  }
}

// ---------------------------------------------------------------------------
// Message handler — background tells us what to do
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return false;

  if (message.action === 'startRecording') {
    startRecording({ userId: message.userId, tabStreamId: message.tabStreamId });
  }

  if (message.action === 'stopRecording') {
    stopRecording();
  }

  if (message.action === 'pauseRecording') {
    pauseRecording();
  }

  if (message.action === 'resumeRecording') {
    resumeRecording();
  }

  return false;
});