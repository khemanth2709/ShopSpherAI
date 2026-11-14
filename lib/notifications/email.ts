import 'server-only';

type EmailInput = {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  actionLabel?: string;
  actionUrl?: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

export async function sendTransactionalEmail(input: EmailInput): Promise<{ sent: boolean; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { sent: false, skipped: true };
  if (!/^\S+@\S+\.\S+$/.test(input.to)) return { sent: false, skipped: true };

  const paragraphs = input.paragraphs.map((paragraph) => `<p style="margin:12px 0;color:#526056;line-height:1.65">${escapeHtml(paragraph)}</p>`).join('');
  const action = input.actionLabel && input.actionUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.actionUrl)}" style="background:#20372c;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel)}</a></p>`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#18231d"><p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#49634f;font-weight:700">ShopSphere AI</p><h1 style="font-size:25px">${escapeHtml(input.heading)}</h1>${paragraphs}${action}<p style="border-top:1px solid #e7ebe5;padding-top:18px;color:#8a948d;font-size:12px">This is an automated order update. Contact support if you need help.</p></div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(`Email provider request failed (${response.status}): ${responseBody.slice(0, 250)}`);
  }
  return { sent: true };
}
