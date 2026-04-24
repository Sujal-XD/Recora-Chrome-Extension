const nodemailer = require('nodemailer');

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error(`Email credentials missing — EMAIL_USER="${user}" EMAIL_PASS="${pass ? '***set***' : 'MISSING'}". Check your .env file and restart the server.`);
  }

  return nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,
    auth:   { user, pass },
  });
}

async function sendRecordingEmail(to, downloadLink, duration, title = 'Recording', attachment = null) {
  const mins = String(duration?.audioMinutes ?? 0).padStart(2, '0');
  const secs = String(duration?.audioSeconds ?? 0).padStart(2, '0');
  const durationStr = `${mins}:${secs}`;
  const safeTitle   = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Clean white/light design — dark backgrounds and CSS gradients trigger spam filters
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Recording is Ready</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;border:1px solid #e4e4e7;">

        <!-- Header -->
        <tr>
          <td style="background:#7c3aed;padding:28px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Recora</h1>
            <p style="color:#ede9fe;margin:6px 0 0;font-size:13px;">Your meeting recording is ready</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <p style="color:#18181b;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Hi there,<br><br>
              Your recording <strong>${safeTitle}</strong> has finished processing and is ready to download.
            </p>

            <!-- Meta card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#71717a;font-size:13px;padding-bottom:8px;width:90px;">Title</td>
                      <td style="color:#18181b;font-size:13px;font-weight:600;padding-bottom:8px;">${safeTitle}</td>
                    </tr>
                    <tr>
                      <td style="color:#71717a;font-size:13px;">Duration</td>
                      <td style="color:#18181b;font-size:13px;font-weight:600;">${durationStr}</td>
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
                     style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:700;font-size:14px;">
                    Download Recording
                  </a>
                </td>
              </tr>
            </table>

            <p style="color:#71717a;font-size:12px;text-align:center;margin:0;">
              ${attachment
                ? 'The recording is also attached to this email (file under 15 MB).'
                : 'The recording is stored securely in the cloud. Click the button above to download it.'}
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e4e4e7;color:#a1a1aa;font-size:11px;text-align:center;">
            Sent by <strong>Recora</strong> &middot; Your AI Meeting Assistant<br>
            <a href="mailto:${process.env.EMAIL_USER}?subject=unsubscribe" style="color:#a1a1aa;">Unsubscribe</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Your recording "${title}" is ready.`,
    `Duration: ${durationStr}`,
    ``,
    `Download: ${downloadLink}`,
    ``,
    attachment ? 'The audio file is attached to this email.' : 'The recording is stored securely in the cloud.',
    ``,
    `-- Recora`,
    `To unsubscribe reply with "unsubscribe" in the subject.`,
  ].join('\n');

  const mailOptions = {
    from:    `"Recora" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to,
    subject: `Your recording "${title}" is ready`,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=unsubscribe>`,
      'X-Priority':       '3',
      'Precedence':       'bulk',
    },
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
