// const express = require('express');
// const cors = require('cors');
// const { BlobServiceClient, generateBlobSASQueryParameters, StorageSharedKeyCredential, ContainerSASPermissions } = require('@azure/storage-blob');

// require('dotenv').config();

// const app = express();

// // Ensure cors() is the first middleware. This is crucial for preventing cross-origin errors.
// app.use(cors());
// app.use(express.json());

// // Your Azure Storage account info from environment variables
// const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
// const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
// const containerName = 'meeting-audio';

// // --- Diagnostic Logs ---
// // These logs will run once when the server starts.
// console.log("Server starting up...");
// console.log(`Azure Account Name Loaded: ${accountName ? 'Yes' : 'No - THIS IS A PROBLEM'}`);
// console.log(`Azure Account Key Loaded: ${accountKey ? 'Yes' : 'No - THIS IS A PROBLEM'}`);
// // --- End Diagnostic Logs ---

// // This check will stop the server if the credentials are not loaded, making the error obvious.
// if (!accountName || !accountKey) {
//   console.error("FATAL ERROR: Azure Storage credentials not found. Please check your .env file in the 'server' directory.");
//   process.exit(1); // Exit the process with an error code
// }

// const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
// const blobServiceClient = new BlobServiceClient(
//   `https://${accountName}.blob.core.windows.net`,
//   sharedKeyCredential
// );

// app.post('/generate-sas', (req, res) => {
//   // Log every time this endpoint is hit
//   console.log("Received a request on /generate-sas");
//   const { userId } = req.body;

//   if (!userId) {
//     console.log("Request failed: User ID was missing in the request body.");
//     return res.status(400).send('User ID is required');
//   }

//   try {
//     // SAS token valid for 1 hour
//     const expiryTime = new Date(new Date().valueOf() + 3600 * 1000);

//     // Permission: read + list
//     const permissions = ContainerSASPermissions.parse('rl');

//     const sasToken = generateBlobSASQueryParameters({
//       containerName,
//       permissions,
//       startsOn: new Date(),
//       expiresOn: expiryTime,
//     }, sharedKeyCredential).toString();

//     console.log("Successfully generated SAS token for user:", userId);
//     // Return SAS token string (URL query parameters)
//     res.json({ sasToken: sasToken });

//   } catch (error) {
//     // If anything goes wrong during SAS generation, log it and send a server error.
//     console.error("CRITICAL: Error during SAS token generation:", error);
//     res.status(500).send('Failed to generate SAS token on the server.');
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Backend running on port ${PORT}`);
// });

// const express = require('express');
// const cors = require('cors');
// const { BlobServiceClient, generateBlobSASQueryParameters, StorageSharedKeyCredential, ContainerSASPermissions } = require('@azure/storage-blob');

// // Suppress dotenv startup message
// require('dotenv').config({ silent: true });

// const app = express();

// app.use(cors());
// app.use(express.json());

// const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
// const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
// const containerName = 'meeting-audio';

// // --- Initial Diagnostic Logs (Keep these for robust startup checks, or comment out if truly silent) ---
// console.log("Server starting up...");
// console.log(`Azure Account Name Loaded: ${accountName ? 'Yes' : 'No - THIS IS A PROBLEM'}`);
// console.log(`Azure Account Key Loaded: ${accountKey ? 'Yes' : 'No - THIS IS A PROBLEM'}`);
// // --- End Initial Diagnostic Logs ---

// if (!accountName || !accountKey) {
//   console.error("FATAL ERROR: Azure Storage credentials not found. Please check your .env file in the 'server' directory.");
//   process.exit(1);
// }

// const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

// const blobServiceClient = new BlobServiceClient(
//   `https://${accountName}.blob.core.windows.net`,
//   sharedKeyCredential
// );

// app.post('/generate-sas', (req, res) => {
//   // Removed "Received a request on /generate-sas" log
//   const { userId } = req.body;

//   if (!userId) {
//     // Keep this error log, it's important if a request is malformed
//     console.log("Request failed: User ID was missing in the request body.");
//     return res.status(400).send('User ID is required');
//   }

//   try {
//     const startTime = new Date();
//     startTime.setMinutes(startTime.getMinutes() - 5);

//     const expiryTime = new Date();
//     expiryTime.setHours(expiryTime.getHours() + 1);

//     const permissions = ContainerSASPermissions.parse('rl');

//     const sasToken = generateBlobSASQueryParameters({
//       containerName,
//       permissions,
//       startsOn: startTime,
//       expiresOn: expiryTime,
//     }, sharedKeyCredential).toString();

//     // Removed the full SAS URL debugging log
//     // Removed "Successfully generated SAS token for user" log

//     res.json({ sasToken: sasToken });

//   } catch (error) {
//     // Keep this error log, it's critical if SAS generation fails
//     console.error("CRITICAL: Error during SAS token generation:", error);
//     res.status(500).send('Failed to generate SAS token on the server.');
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Backend running on port ${PORT}`);
// });

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { BlobServiceClient, generateBlobSASQueryParameters, StorageSharedKeyCredential, ContainerSASPermissions, BlobSASPermissions } = require('@azure/storage-blob');
const { sendRecordingEmail } = require('./services/emailService');

// Startup credential check — tells you immediately if .env is missing anything
console.log(`Azure account : ${process.env.AZURE_STORAGE_ACCOUNT_NAME  ? '✓' : '✗ MISSING'}`);
console.log(`Email user    : ${process.env.EMAIL_USER                  ? '✓ ' + process.env.EMAIL_USER : '✗ MISSING'}`);
console.log(`Email pass    : ${process.env.EMAIL_PASS                  ? '✓ (set)' : '✗ MISSING'}`);

const app = express();

app.use(cors());
app.use(express.json());

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = 'meeting-audio';

// --- Initial Diagnostic Logs (Keep these for robust startup checks, or comment out if truly silent) ---
console.log("Server starting up...");
console.log(`Azure Account Name Loaded: ${accountName ? 'Yes' : 'No - THIS IS A PROBLEM'}`);
console.log(`Azure Account Key Loaded: ${accountKey ? 'Yes' : 'No - THIS IS A PROBLEM'}`);
// --- End Initial Diagnostic Logs ---

if (!accountName || !accountKey) {
  console.error("FATAL ERROR: Azure Storage credentials not found. Please check your .env file in the 'bed' directory.");
  process.exit(1);
}

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);

// Endpoint for generating SAS tokens for LISTING/READING recordings
app.post('/generate-sas', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.log("Request failed: User ID was missing in the request body for /generate-sas.");
    return res.status(400).send('User ID is required');
  }

  try {
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 5);

    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() + 1);

    const permissions = ContainerSASPermissions.parse('rl'); // Read, List for container

    const sasToken = generateBlobSASQueryParameters({
      containerName,
      permissions,
      startsOn: startTime,
      expiresOn: expiryTime,
    }, sharedKeyCredential).toString();

    res.json({ sasToken: sasToken });

  } catch (error) {
    console.error("CRITICAL: Error during SAS token generation for listing:", error);
    res.status(500).send('Failed to generate SAS token for listing on the server.');
  }
});

// NEW ENDPOINT: Endpoint for generating SAS tokens for UPLOADING recordings
app.post('/generate-upload-sas', (req, res) => {
  console.log("Received a request on /generate-upload-sas");
  const { userId, blobName } = req.body; // blobName is the filename, e.g., "recording_123.webm"

  if (!userId || !blobName) {
    console.log("Request failed: User ID or Blob Name was missing for upload SAS.");
    return res.status(400).send('User ID and Blob Name are required.');
  }

  try {
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - 5); // 5 minutes in the past

    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15); // Shorter expiry for uploads, e.g., 15 minutes

    // Permissions for a BLOB: Create, Write.
    // 'c' for creating a new blob, 'w' for writing content to it.
    const permissions = BlobSASPermissions.parse('cw');

    // Generate SAS for a specific BLOB, not the whole container
    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName: `${userId}/${blobName}`, // Full path to the specific blob in the container
      permissions,
      startsOn: startTime,
      expiresOn: expiryTime,
    }, sharedKeyCredential).toString();

    // --- CRITICAL DEBUGGING STEP: Log the full UPLOAD SAS URL ---
    const fullSasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(userId)}/${encodeURIComponent(blobName)}?${sasToken}`;
    console.log('--- Generated Full UPLOAD SAS URL (TEST THIS IN BROWSER/POSTMAN): ---');
    console.log(fullSasUrl);
    console.log('----------------------------------------------------');
    // --- End Debugging Log ---

    console.log(`Successfully generated upload SAS token for user: ${userId}, blob: ${blobName}`);
    res.json({ sasToken: sasToken });

  } catch (error) {
    console.error("CRITICAL: Error during UPLOAD SAS token generation:", error);
    res.status(500).send('Failed to generate upload SAS token on the server.');
  }
});


// ---------------------------------------------------------------------------
// POST /send-recording-email
// Called by background.js after a recording is uploaded to Azure.
// Sends the user an email with a download link.
// If the recording is under 15 MB it is also attached to the email.
// ---------------------------------------------------------------------------
const MAX_ATTACH_BYTES = 15 * 1024 * 1024; // 15 MB

app.post('/send-recording-email', async (req, res) => {
  const { to, downloadLink, duration, blobPath, title } = req.body;

  if (!to || !downloadLink) {
    return res.status(400).json({ error: '`to` and `downloadLink` are required.' });
  }

  let attachment = null;

  // Attempt to fetch the blob — attach it only if it is small enough
  if (blobPath) {
    try {
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient      = containerClient.getBlobClient(blobPath);
      const props           = await blobClient.getProperties();

      if (props.contentLength < MAX_ATTACH_BYTES) {
        const downloadResponse = await blobClient.download(0);
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        attachment = Buffer.concat(chunks);
        console.log(`Attaching blob (${(props.contentLength / 1024).toFixed(1)} KB) to email for ${to}`);
      } else {
        console.log(`Blob too large to attach (${(props.contentLength / 1024 / 1024).toFixed(1)} MB) — sending link only`);
      }
    } catch (blobErr) {
      console.warn('Could not fetch blob for attachment:', blobErr.message);
    }
  }

  try {
    await sendRecordingEmail(to, downloadLink, duration, title, attachment);
    res.json({ success: true });
  } catch (emailErr) {
    console.error('Email send failed:', emailErr.message);
    res.status(500).json({ error: emailErr.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});