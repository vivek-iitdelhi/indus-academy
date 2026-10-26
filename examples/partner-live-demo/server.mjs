// Acme Learning: a tiny partner platform using the Indus AI Academy live-class API.
import http from 'node:http';

const KEY = process.env.PARTNER_API_KEY;
const API = process.env.INDUS_API || 'http://localhost:3000/api/v1';
const COURSE = 'chatgpt-for-professionals';
const PORT = Number(process.env.PORT || 4000);
if (!KEY) { console.error('Set PARTNER_API_KEY'); process.exit(1); }

// Fake "logged-in" users of our own platform.
const LEARNERS = {
  'acme-001': { name: 'Priya Sharma', email: 'priya@acme.example' },
  'acme-002': { name: 'Rahul Verma', email: 'rahul@acme.example' },
};

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// Server-side only: the key never leaves this process.
async function api(method, path, body) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(502, 'unreachable', `Could not reach the Indus API: ${e.message}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code || 'unknown', data?.error?.message || res.statusText);
  return data;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} - Acme Learning</title>
<style>body{font-family:system-ui,sans-serif;margin:0;color:#222}header{background:#1d3557;color:#fff;padding:12px 24px}
header a{color:#fff}main{padding:16px 24px}table{border-collapse:collapse}td,th{padding:8px 12px;border-bottom:1px solid #ddd;text-align:left}
.btn{background:#e63946;color:#fff;padding:6px 14px;border-radius:4px;text-decoration:none}.err{background:#fde8e8;border:1px solid #e63946;padding:12px 16px;border-radius:4px}
.muted{color:#777}</style></head><body><header><b>Acme Learning</b> &nbsp; <a href="/">switch learner</a></header><main>${body}</main></body></html>`;
const errorBox = (e) => `<div class="err"><b>Indus API error ${esc(e.status)} <code>${esc(e.code)}</code></b><br>${esc(e.message)}</div>`;

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('learner');
  const learner = LEARNERS[id];
  const send = (status, title, body) => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page(title, body));
  };

  if (url.pathname === '/') {
    return send(200, 'Sign in', `<h2>Who are you?</h2><ul>${Object.entries(LEARNERS)
      .map(([k, l]) => `<li><a href="/classes?learner=${k}">${esc(l.name)}</a> <span class="muted">(${k})</span></li>`).join('')}</ul>`);
  }
  if (!learner) return send(400, 'Unknown learner', `<p>Unknown learner. <a href="/">Pick one</a>.</p>`);
  const hello = `<p>Signed in as <b>${esc(learner.name)}</b> (${esc(id)})</p>`;

  if (url.pathname === '/classes') {
    try {
      const { live_sessions } = await api('GET', `/courses/${COURSE}/live-sessions`);
      const rows = live_sessions.map((s) => {
        const action = s.status === 'open' ? `<a class="btn" href="/join/${encodeURIComponent(s.id)}?learner=${encodeURIComponent(id)}">Join</a>`
          : s.status === 'upcoming' ? `<span class="muted">Opens 15 min before</span>`
          : s.recording_url ? `<a href="${esc(s.recording_url)}">Watch recording</a>` : `<span class="muted">Recording coming soon</span>`;
        return `<tr><td>${esc(s.title)}</td><td>${esc(new Date(s.starts_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST</td>
<td>${esc(s.duration_minutes)} min</td><td>${esc(s.status)}</td><td>${action}</td></tr>`;
      }).join('');
      return send(200, 'Live classes', `${hello}<h2>ChatGPT for Professionals: live classes</h2>
<table><tr><th>Class</th><th>Starts</th><th>Length</th><th>Status</th><th></th></tr>${rows}</table>`);
    } catch (e) {
      return send(e.status || 500, 'Error', hello + errorBox(e));
    }
  }

  const m = url.pathname.match(/^\/join\/([^/]+)$/);
  if (m) {
    const back = `<p><a href="/classes?learner=${encodeURIComponent(id)}">&larr; back to classes</a></p>`;
    try {
      await api('PUT', `/learners/${encodeURIComponent(id)}`, learner);
      const { embed_url } = await api('POST', `/live-sessions/${encodeURIComponent(decodeURIComponent(m[1]))}/join`, { external_id: id });
      return send(200, 'Live class', `${back}<iframe src="${esc(embed_url)}" style="width:100%;height:80vh;border:0"
allow="camera; microphone; autoplay; display-capture; fullscreen" allowfullscreen></iframe>`);
    } catch (e) {
      return send(e.status || 500, 'Could not join', hello + errorBox(e) + back);
    }
  }
  send(404, 'Not found', '<p>Not found.</p>');
}

http.createServer((req, res) => handle(req, res).catch((e) => {
  console.error(e);
  if (!res.headersSent) res.writeHead(500).end('Internal error');
})).listen(PORT, () => console.log(`Acme Learning on http://localhost:${PORT}`));
