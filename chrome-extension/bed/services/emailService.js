const nodemailer = require('nodemailer');

// Transporter is created lazily so it always reads env vars after dotenv.config() has run.
// Using explicit SMTP config (more reliable than service:'gmail' shorthand).
function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(`Email credentials missing — EMAIL_USER="${user}" EMAIL_PASS="${pass ? '***set***' : 'MISSING'}". Check your .env file and restart the server.`);
  }

  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false, // STARTTLS
    auth:   { user, pass },
  });
}

/**
 * sendRecordingEmail
 * @param {string} to          - recipient email
 * @param {string} downloadLink - public/SAS Azure URL for the recording
 * @param {{audioMinutes:number, audioSeconds:number}} duration
 * @param {string} title       - recording title
 * @param {Buffer|null} attachment - raw audio buffer if file < 15 MB, else null
 */
async function sendRecordingEmail(to, downloadLink, duration, title = 'Recording', attachment = null) {
  const mins = String(duration?.audioMinutes ?? 0).padStart(2, '0');
  const secs = String(duration?.audioSeconds ?? 0).padStart(2, '0');
  const durationStr = `${mins}:${secs}`;
  const safeTitle   = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Recording is Ready</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#8b5cf6,#ec4899);padding:36px 32px;text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">🎙</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Recora</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">Your meeting recording is ready</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <p style="color:#f9fafb;font-size:15px;line-height:1.7;margin:0 0 24px;">
              Hi there! Your recording <strong style="color:#c4b5fd;">${safeTitle}</strong> has finished processing and is ready to download.
            </p>

            <!-- Meta card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);border-radius:12px;padding:0;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#9ca3af;font-size:13px;padding-bottom:10px;width:90px;">Title</td>
                      <td style="color:#f9fafb;font-size:13px;font-weight:600;padding-bottom:10px;">${safeTitle}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:13px;">Duration</td>
                      <td style="color:#f9fafb;font-size:13px;font-weight:600;">${durationStr}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Download button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td align="center">
                  <a href="${downloadLink}"
                     style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;">
                    ⬇&nbsp;&nbsp;Download Recording
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
              ${attachment
                ? 'The recording is also attached to this email (file &lt; 15 MB).'
                : 'The recording is stored securely in the cloud. Click the button above to download it.'}
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.07);color:#4b5563;font-size:11px;text-align:center;">
            Sent by <strong style="color:#7c3aed;">Recora</strong> · Your AI Meeting Assistant
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from:    `"Recora" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your Meeting Recording is Ready!! ',
    html,
  };

  if (attachment) {
    const safeName = title.replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'recording';
    mailOptions.attachments = [{
      filename:    `${safeName}.webm`,
      content:     attachment,
      contentType: 'audio/webm',
    }];
  }

  await getTransporter().sendMail(mailOptions);
  console.log(`Recording email sent to ${to} — title: "${title}"`);
}

module.exports = { sendRecordingEmail };
