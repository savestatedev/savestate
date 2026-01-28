/**
 * SaveState Email Service
 *
 * Sends transactional emails via PurelyMail SMTP.
 * Uses the built-in Node.js approach with nodemailer-compatible raw SMTP.
 */

const SMTP_HOST = 'smtp.purelymail.com';
const SMTP_PORT = 465; // SSL
const SMTP_USER = 'noreply@savestate.dev';
// SMTP_PASS from env: SMTP_PASSWORD

import { createConnection } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { createHash } from 'node:crypto';

/**
 * Send an email via raw SMTP over TLS.
 * Zero dependencies — uses Node.js built-in TLS.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const password = process.env.SMTP_PASSWORD;
  if (!password) {
    console.error('SMTP_PASSWORD not set — skipping email');
    return;
  }

  const { to, subject, html, text } = params;

  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const message = [
    `From: "SaveState" <${SMTP_USER}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    text || htmlToText(html),
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    html,
    `--${boundary}--`,
  ].join('\r\n');

  await smtpSend({
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER,
    pass: password,
    from: SMTP_USER,
    to,
    data: message,
  });
}

/** Strip HTML tags for plain text fallback */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Raw SMTP over TLS — zero dependencies.
 */
function smtpSend(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  data: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect(opts.port, opts.host, { rejectUnauthorized: true }, () => {
      let step = 0;
      let buffer = '';

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        if (!buffer.includes('\r\n')) return;

        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const code = parseInt(line.slice(0, 3));
          if (code >= 400) {
            socket.end();
            return reject(new Error(`SMTP error: ${line}`));
          }

          // Multi-line responses (e.g., 250-PIPELINING)
          if (line[3] === '-') continue;

          switch (step) {
            case 0: // greeting
              socket.write(`EHLO savestate.dev\r\n`);
              step = 1;
              break;
            case 1: // EHLO response
              socket.write(`AUTH LOGIN\r\n`);
              step = 2;
              break;
            case 2: // Username prompt
              socket.write(Buffer.from(opts.user).toString('base64') + '\r\n');
              step = 3;
              break;
            case 3: // Password prompt
              socket.write(Buffer.from(opts.pass).toString('base64') + '\r\n');
              step = 4;
              break;
            case 4: // Auth success
              socket.write(`MAIL FROM:<${opts.from}>\r\n`);
              step = 5;
              break;
            case 5: // MAIL OK
              socket.write(`RCPT TO:<${opts.to}>\r\n`);
              step = 6;
              break;
            case 6: // RCPT OK
              socket.write(`DATA\r\n`);
              step = 7;
              break;
            case 7: // DATA ready
              socket.write(opts.data + '\r\n.\r\n');
              step = 8;
              break;
            case 8: // Message accepted
              socket.write(`QUIT\r\n`);
              step = 9;
              break;
            case 9: // QUIT acknowledged
              socket.end();
              resolve();
              break;
          }
        }
      });

      socket.on('error', reject);
      socket.on('close', () => {
        if (step < 9) reject(new Error('Connection closed prematurely'));
      });
    });

    socket.on('error', reject);

    // Timeout after 15 seconds
    setTimeout(() => {
      socket.end();
      reject(new Error('SMTP timeout'));
    }, 15000);
  });
}

// ─── Email Templates ─────────────────────────────────────────

export function welcomeEmailHtml(params: {
  name?: string;
  email: string;
  apiKey: string;
  tier: string;
}): string {
  const greeting = params.name ? `Hi ${params.name}` : 'Hi there';
  const tierName = params.tier === 'team' ? 'Team' : 'Pro';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #03C1DF; margin-bottom: 30px; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 30px; margin: 20px 0; }
    .api-key { background: #0d1117; border: 1px solid #03C1DF; border-radius: 8px; padding: 16px; font-family: 'SF Mono', Monaco, monospace; font-size: 14px; color: #03C1DF; word-break: break-all; margin: 16px 0; }
    .step { margin: 12px 0; }
    .step code { background: #0d1117; padding: 2px 8px; border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; color: #9BCDE4; }
    .badge { display: inline-block; background: #03C1DF; color: #000; font-weight: 600; font-size: 12px; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; }
    h1 { color: #fff; font-size: 24px; margin-top: 0; }
    h2 { color: #fff; font-size: 18px; }
    a { color: #03C1DF; text-decoration: none; }
    .footer { color: #666; font-size: 13px; margin-top: 40px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">⏸ SaveState</div>

    <h1>${greeting}, welcome to SaveState ${tierName}! 🎉</h1>

    <p>Your AI identity backup system is ready. Here's your API key:</p>

    <div class="card">
      <h2>Your API Key</h2>
      <div class="api-key">${params.apiKey}</div>
      <p style="color: #999; font-size: 13px;">Keep this secret. It grants access to your SaveState account and cloud storage.</p>
    </div>

    <div class="card">
      <h2>Get Started in 60 Seconds</h2>
      <div class="step"><strong>1.</strong> Install: <code>npm install -g @savestate/cli</code></div>
      <div class="step"><strong>2.</strong> Login: <code>savestate login</code></div>
      <div class="step"><strong>3.</strong> Initialize: <code>savestate init</code></div>
      <div class="step"><strong>4.</strong> Snapshot: <code>savestate snapshot</code></div>
      <div class="step"><strong>5.</strong> That's it — your AI state is backed up! ✅</div>
    </div>

    <div class="card">
      <h2>Your ${tierName} Plan Includes</h2>
      <p>
        ${params.tier === 'team'
          ? '✅ Cloud storage (50GB) · ✅ All adapters · ✅ Auto-backups · ✅ Shared team backups · ✅ SSO · ✅ Priority support'
          : '✅ Cloud storage (10GB) · ✅ All adapters · ✅ Auto-backups · ✅ Search across snapshots · ✅ Web dashboard · ✅ Email alerts'}
      </p>
    </div>

    <p>Questions? Reply to this email or visit <a href="https://savestate.dev">savestate.dev</a>.</p>

    <div class="footer">
      <p>SaveState — Time Machine for AI</p>
      <p>You're receiving this because you signed up at savestate.dev</p>
    </div>
  </div>
</body>
</html>`;
}
