require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { BlobServiceClient, generateBlobSASQueryParameters, StorageSharedKeyCredential, ContainerSASPermissions, BlobSASPermissions } = require('@azure/storage-blob');
const { sendRecordingEmail } = require('./services/emailService');

// Startup credential check
console.log(`Azure account : ${process.env.AZURE_STORAGE_ACCOUNT_NAME ? '✓' : '✗ MISSING'}`);
console.log(`Email user    : ${process.env.EMAIL_USER                  ? '✓ ' + process.env.EMAIL_USER : '✗ MISSING'}`);
console.log(`Email pass    : ${process.env.EMAIL_PASS                  ? '✓ (set)' : '✗ MISSING'}`);

const app = express();

app.use(cors());
app.use(express.json());

// Health check — Render pings GET / to confirm the service is up
app.get('/', (_req, res) => res.send('Server is running'));

const accountName   = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey    = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = 'meeting-audio';

if (!accountName || !accountKey) {
  console.error('FATAL ERROR: Azure Storage credentials not found. Check your .env file.');
  process.exit(1);
}

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient   = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);

// ---------------------------------------------------------------------------
// POST /generate-sas  — read/list token for fetching recordings
// ---------------------------------------------------------------------------
app.post('/generate-sas', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).send('User ID is required');

  try {
    // Wide window — same clock-skew tolerance as upload SAS.
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 1);
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + 2);

    const sasToken = generateBlobSASQueryParameters({
      containerName,
      permissions: ContainerSASPermissions.parse('rl'),
      startsOn:    startTime,
      expiresOn:   expiryTime,
    }, sharedKeyCredential).toString();

    res.set('Cache-Control', 'no-store');
    res.json({ sasToken });
  } catch (error) {
    console.error('Error generating SAS token for listing:', error);
    res.status(500).send('Failed to generate SAS token.');
  }
});

// ---------------------------------------------------------------------------
// POST /generate-upload-sas  — create/write token for a specific blob
// ---------------------------------------------------------------------------
app.post('/generate-upload-sas', (req, res) => {
  const { userId, blobName } = req.body;
  if (!userId || !blobName) return res.status(400).send('User ID and Blob Name are required.');

  try {
    // Wide window: start 24 h BEFORE server clock, expire 48 h AFTER.
    // This tolerates server clock drift of up to ±24 h so Azure always
    // accepts the token even if this machine's clock is badly out of sync.
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 1);
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + 2);

    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName:    `${userId}/${blobName}`,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn:    startTime,
      expiresOn:   expiryTime,
    }, sharedKeyCredential).toString();

    console.log(`Upload SAS generated — user: ${userId}, blob: ${blobName}`);
    res.set('Cache-Control', 'no-store');
    res.json({ sasToken });
  } catch (error) {
    console.error('Error generating upload SAS token:', error);
    res.status(500).send('Failed to generate upload SAS token.');
  }
});

// ---------------------------------------------------------------------------
// POST /send-recording-email
// Called by background.js after a recording is uploaded to Azure.
// ---------------------------------------------------------------------------
const MAX_ATTACH_BYTES = 15 * 1024 * 1024; // 15 MB

app.post('/send-recording-email', async (req, res) => {
  const { to, downloadLink, duration, blobPath, title } = req.body;

  if (!to || !downloadLink) {
    return res.status(400).json({ error: '`to` and `downloadLink` are required.' });
  }

  let attachment = null;

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
        console.log(`Blob too large to attach (${(props.contentLength / 1024 / 1024).toFixed(1)} MB) — link only`);
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});
