require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { BlobServiceClient, generateBlobSASQueryParameters, StorageSharedKeyCredential, ContainerSASPermissions, BlobSASPermissions } = require('@azure/storage-blob');
const { sendRecordingEmail, sendDocumentEmail }         = require('./services/emailService');
const { generateMomPdf, generateSummaryPdf, generateTranscriptPdf } = require('./services/pdfService');

// Startup credential check
console.log(`Azure account  : ${process.env.AZURE_STORAGE_ACCOUNT_NAME ? '✓' : '✗ MISSING'}`);
console.log(`Email user     : ${process.env.EMAIL_USER                  ? '✓ ' + process.env.EMAIL_USER : '✗ MISSING'}`);
console.log(`Email pass     : ${process.env.EMAIL_PASS                  ? '✓ (set)' : '✗ MISSING'}`);
console.log(`Deepgram key   : ${process.env.DEEPGRAM_API_KEY            ? '✓ (set)' : '✗ MISSING'}`);
console.log(`Google client  : ${process.env.GOOGLE_CLIENT_ID            ? '✓ (set)' : '✗ MISSING — token audience NOT enforced'}`);

const app = express();

// ---------------------------------------------------------------------------
// CORS — accept any chrome-extension:// origin (all endpoints are protected by
// Google token verification, so origin pinning adds no real security here).
// ---------------------------------------------------------------------------
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^chrome-extension:\/\//.test(origin)) return cb(null, true);
    cb(Object.assign(new Error('CORS: origin not allowed'), { status: 403 }));
  },
  methods:        ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body size limit for all JSON routes (audio handled per-route below)
app.use(express.json({ limit: '10kb' }));

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const emailLimiter   = rateLimit({ windowMs: 60 * 60 * 1000, max: 10,  standardHeaders: true, legacyHeaders: false });
app.use(generalLimiter);

// Health check — Render pings GET / to confirm the service is up
app.get('/', (_req, res) => res.send('Server is running'));

// ---------------------------------------------------------------------------
// Azure credentials
// ---------------------------------------------------------------------------
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
// Google token verification middleware
// Calls Google's tokeninfo endpoint — no local secret needed.
// Sets req.userId (Google sub) and req.userEmail on success.
// Also verifies token was issued to THIS app (azp audience check).
// ---------------------------------------------------------------------------
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

async function verifyGoogleToken(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    if (!r.ok) return res.status(401).json({ error: 'Invalid token' });
    const info = await r.json();

    if (!info.sub || !info.email) return res.status(401).json({ error: 'Invalid token claims' });

    // Reject tokens not issued to this app — prevents foreign app tokens from using our backend
    if (GOOGLE_CLIENT_ID) {
      const tokenClient = info.azp || info.aud;
      if (tokenClient !== GOOGLE_CLIENT_ID) {
        console.warn(`Token audience mismatch: got ${tokenClient}`);
        return res.status(401).json({ error: 'Token audience mismatch' });
      }
    }

    if (info.exp && Date.now() / 1000 > Number(info.exp)) {
      return res.status(401).json({ error: 'Token expired' });
    }

    req.userId    = info.sub;
    req.userEmail = info.email;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

// ---------------------------------------------------------------------------
// POST /generate-sas  — read/list token for fetching recordings
// ---------------------------------------------------------------------------
app.post('/generate-sas', verifyGoogleToken, (req, res) => {
  try {
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
const SAFE_BLOB_NAME_RX = /^[a-zA-Z0-9._\-]+$/;

app.post('/generate-upload-sas', verifyGoogleToken, (req, res) => {
  const { blobName } = req.body;
  if (!blobName || typeof blobName !== 'string')
    return res.status(400).json({ error: 'Blob name is required.' });
  if (blobName.length > 256)
    return res.status(400).json({ error: 'Blob name too long.' });
  if (!SAFE_BLOB_NAME_RX.test(blobName))
    return res.status(400).json({ error: 'Blob name contains invalid characters.' });

  try {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 1);
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + 2);

    // userId locked to the verified token — cannot be spoofed via request body
    const sasToken = generateBlobSASQueryParameters({
      containerName,
      blobName:    `${req.userId}/${blobName}`,
      permissions: BlobSASPermissions.parse('cw'),
      startsOn:    startTime,
      expiresOn:   expiryTime,
    }, sharedKeyCredential).toString();

    console.log(`Upload SAS generated — user: ${req.userId}, blob: ${blobName}`);
    res.set('Cache-Control', 'no-store');
    res.json({ sasToken });
  } catch (error) {
    console.error('Error generating upload SAS token:', error);
    res.status(500).send('Failed to generate upload SAS token.');
  }
});

// ---------------------------------------------------------------------------
// POST /transcribe — Deepgram proxy (API key stays server-side)
// Accepts raw audio body; forwards query params to Deepgram as-is.
// ---------------------------------------------------------------------------
app.post(
  '/transcribe',
  verifyGoogleToken,
  express.raw({ type: '*/*', limit: '200mb' }),
  async (req, res) => {
    const dgKey = process.env.DEEPGRAM_API_KEY;
    if (!dgKey) return res.status(503).json({ error: 'Transcription service not configured' });

    try {
      const params = new URLSearchParams(req.query);
      const dgRes  = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
        method:  'POST',
        headers: {
          'Authorization': `Token ${dgKey}`,
          'Content-Type':  req.headers['content-type'] || 'audio/webm',
        },
        body: req.body,
      });

      if (!dgRes.ok) {
        const errText = await dgRes.text();
        console.error('Deepgram error:', dgRes.status, errText);
        return res.status(dgRes.status).json({ error: `Transcription failed: ${dgRes.status}` });
      }

      const data = await dgRes.json();
      res.json(data);
    } catch (err) {
      console.error('Transcription proxy error:', err.message);
      res.status(500).json({ error: 'Transcription proxy error' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /send-recording-email
// Called by background.js after a recording is uploaded to Azure.
// ---------------------------------------------------------------------------
const MAX_ATTACH_BYTES = 15 * 1024 * 1024; // 15 MB

app.post('/send-recording-email', verifyGoogleToken, emailLimiter, async (req, res) => {
  const { downloadLink, duration, blobPath, title } = req.body;

  if (!downloadLink) {
    return res.status(400).json({ error: '`downloadLink` is required.' });
  }

  // Email recipient locked to the verified token — cannot be spoofed via body
  const to = req.userEmail;

  // blobPath must belong to the authenticated user (path traversal prevention)
  if (blobPath && !blobPath.startsWith(`${req.userId}/`)) {
    return res.status(403).json({ error: 'Forbidden' });
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

// ---------------------------------------------------------------------------
// Shared helper — pick the right generator
// ---------------------------------------------------------------------------
const ALLOWED_TYPES = ['mom', 'summary', 'transcript'];

async function buildDocPdf(type, recording, calEvent, generatedDate) {
  if (!ALLOWED_TYPES.includes(type)) throw new Error(`Unknown type: ${type}`);
  if (type === 'mom')        return generateMomPdf(recording, calEvent, generatedDate);
  if (type === 'summary')    return generateSummaryPdf(recording, generatedDate);
  return generateTranscriptPdf(recording, generatedDate);
}

// ---------------------------------------------------------------------------
// POST /generate-pdf — returns PDF bytes (application/pdf)
// Body: { type, recording: { title, createdAt, duration, transcript, summary }, calEvent? }
// ---------------------------------------------------------------------------
app.post(
  '/generate-pdf',
  verifyGoogleToken,
  express.json({ limit: '2mb' }),
  async (req, res) => {
    const { type, recording, calEvent, generatedDate } = req.body || {};
    if (!type || !recording) return res.status(400).json({ error: '`type` and `recording` are required.' });

    try {
      const pdfBuf = await buildDocPdf(type, recording, calEvent || null, generatedDate || null);
      const safe   = (recording.title || 'document').replace(/[^a-z0-9_\- ]/gi, '_').trim();
      res.set('Content-Type',        'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${safe}_${type}.pdf"`);
      res.set('Cache-Control',       'no-store');
      res.send(pdfBuf);
    } catch (err) {
      console.error('PDF generation error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /send-document-email — generates PDF and emails it to the user
// Body: { type, recording, calEvent? }
// ---------------------------------------------------------------------------
app.post(
  '/send-document-email',
  verifyGoogleToken,
  emailLimiter,
  express.json({ limit: '2mb' }),
  async (req, res) => {
    const { type, recording, calEvent, generatedDate } = req.body || {};
    if (!type || !recording) return res.status(400).json({ error: '`type` and `recording` are required.' });

    try {
      const pdfBuf = await buildDocPdf(type, recording, calEvent || null, generatedDate || null);
      await sendDocumentEmail(req.userEmail, type, recording.title, pdfBuf);
      res.json({ success: true });
    } catch (err) {
      console.error('Document email error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});
