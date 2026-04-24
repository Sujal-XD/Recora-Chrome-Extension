// const btnAsk = document.getElementById('btnAsk');
// const info = document.getElementById('info');

// btnAsk.onclick = async () => {
//   info.textContent = "Requesting microphone permission...";
//   try {
//     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     // Permission granted
//     info.textContent = "Microphone permission granted! You can now close this window.";
//   } catch (err) {
//     if (err.name === 'NotAllowedError') {
//       info.textContent = "Permission denied or dismissed. Please allow microphone access.";
//     } else if (err.name === 'NotFoundError') {
//       info.textContent = "No microphone detected on your device.";
//     } else if (err.name === 'NotReadableError') {
//       info.textContent = "Microphone busy or in use by another application.";
//     } else {
//       info.textContent = `Error: ${err.name} - ${err.message}`;
//     }
//   }
// };


const btnAsk = document.getElementById('btnAsk');
const info = document.getElementById('info');

btnAsk.onclick = async () => {
  info.textContent = "Requesting microphone permission...";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission granted
    info.textContent = "Microphone permission granted! You can now close this window.";
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      info.textContent = "Permission denied or dismissed. Please allow microphone access.";
    } else if (err.name === 'NotFoundError') {
      info.textContent = "No microphone detected on your device.";
    } else if (err.name === 'NotReadableError') {
      info.textContent = "Microphone busy or in use by another application.";
    } else {
      info.textContent = `Error: ${err.name} - ${err.message}`;
    }
  }
};