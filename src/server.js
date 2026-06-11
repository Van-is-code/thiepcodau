require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fsSync = require('fs');
const fs = require('fs').promises;
const nodemailer = require('nodemailer');
const { pool, bootstrapDatabase } = require('./db');
const { createInvitationPath, buildAbsoluteUrl } = require('./utils');
const { startRedirectServer } = require('./redirectServer');

const app = express();

const port = Number(process.env.PORT || 3000);
function resolveBasePublicUrl() {
  const thiepPublicUrl = String(process.env.THIEP_PUBLIC_URL || '').trim();
  if (thiepPublicUrl) {
    try {
      return new URL(thiepPublicUrl).origin.replace(/\/$/, '');
    } catch (error) {
      // Fall through to BASE_PUBLIC_URL if the configured URL is malformed.
    }
  }

  const basePublicUrl = String(process.env.BASE_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (basePublicUrl) return basePublicUrl;

  return `http://localhost:${port}`;
}

const basePublicUrl = resolveBasePublicUrl();

const staticRoot = path.resolve(__dirname, '../vobe2/www.ziuwedding.site');
const cdnMirrorRoot = path.resolve(__dirname, '../vobe2/w.ladicdn.com');
const backendRoot = path.resolve(__dirname, '../');

let directRedirectMap = new Map();

function loadDirectRedirectMap() {
  const startPointsFile = path.join(backendRoot, 'start-points.json');
  const endPointsFile = path.join(backendRoot, 'end-points.json');

  const map = new Map();

  if (!fsSync.existsSync(startPointsFile) || !fsSync.existsSync(endPointsFile)) {
    directRedirectMap = map;
    return;
  }

  const startPoints = JSON.parse(fsSync.readFileSync(startPointsFile, 'utf8'));
  const endPoints = JSON.parse(fsSync.readFileSync(endPointsFile, 'utf8'));

  for (const [code, startUrl] of Object.entries(startPoints)) {
    const targetUrl = endPoints[code];
    if (!targetUrl) {
      continue;
    }

    try {
      const startPathname = new URL(startUrl).pathname;
      map.set(startPathname, targetUrl);
    } catch {
      // Ignore malformed start URLs to keep startup resilient.
    }
  }

  directRedirectMap = map;
}

// Setup email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_PASSWORD || '',
  },
  tls: {
    rejectUnauthorized: false,
  },
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  if (req.path.endsWith('.m3u8')) {
    res.type('application/vnd.apple.mpegurl');
  } else if (req.path.endsWith('.ts')) {
    res.type('video/mp2t');
  }
  next();
});

app.use('/w.ladicdn.com', express.static(cdnMirrorRoot));
app.use(express.static(staticRoot));
app.use(express.static(backendRoot)); // Serve floating-widget.js and other root files

app.get(['/', '/home', '/home/'], (_, res) => {
  res.sendFile(path.join(backendRoot, 'home.html'));
});

app.get(['/moi-cuoi', '/moi-cuoi/'], (_, res) => {
  res.sendFile(path.join(staticRoot, 'wedding-invitation.html'));
});

app.get(['/admin', '/admin/'], (_, res) => {
  res.sendFile(path.join(backendRoot, 'admin.html'));
});

app.get(['/danh-sach', '/danh-sach/'], (_, res) => {
  res.sendFile(path.join(backendRoot, 'list-wedding-invitation.html'));
});

app.get(['/xac-nhan', '/xac-nhan/'], (_, res) => {
  res.sendFile(path.join(backendRoot, 'confirm-attendance.html'));
});

app.get(['/duc-cuong', '/duc-cuong/'], (_, res) => {
  res.sendFile(path.join(staticRoot, 'vobe2.html'));
});


app.get(['/duccuong-nguyenquyet', '/duccuong-nguyenquyet/'], (_, res) => {
  res.sendFile(path.join(staticRoot, 'vobe2.html'));
});



app.get(['/thiep-cuoi', '/thiep-cuoi/'], (_, res) => {
  res.sendFile(path.join(staticRoot, 'phongbibe2.html'));
});

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'wedding-backend' });
});

app.get('/api/public-config', (_, res) => {
  const thiepPublicUrl = String(process.env.THIEP_PUBLIC_URL || '').trim();
  const ngayCuoi = String(process.env.NGAY_CUOI || '').trim();

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.json({
    thiep_public_url: thiepPublicUrl,
    ngay_cuoi: ngayCuoi,
    THIEP_PUBLIC_URL: thiepPublicUrl,
    NGAY_CUOI: ngayCuoi,
  });
});

app.get('/api/email-template', async (_, res, next) => {
  try {
    const templatePath = path.join(__dirname, 'email-template.html');
    const htmlContent = await fs.readFile(templatePath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/email-preview', async (req, res, next) => {
  try {
    const { name, url } = req.query;
    
    if (!name) {
      return res.status(400).send('Missing parameter: name');
    }
    
    const templatePath = path.join(__dirname, 'email-template.html');
    let htmlContent = await fs.readFile(templatePath, 'utf-8');
    
    // Replace placeholders
    const guestName = decodeURIComponent(name);
    const invitationUrl = url ? decodeURIComponent(url) : '';
    
    htmlContent = htmlContent.replace(/\{\{GUEST_NAME\}\}/g, guestName);
    htmlContent = htmlContent.replace(/\{\{INVITATION_URL\}\}/g, invitationUrl);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/send-invitation-email', async (req, res, next) => {
  const { recipient_email, guest_name, invitation_url } = req.body;

  if (!recipient_email || !guest_name || !invitation_url) {
    return res.status(400).json({ message: 'recipient_email, guest_name, and invitation_url are required' });
  }

  try {
    const templatePath = path.join(__dirname, 'email-template.html');
    let htmlContent = await fs.readFile(templatePath, 'utf-8');

    // Replace placeholders
    htmlContent = htmlContent.replace(/\{\{GUEST_NAME\}\}/g, guest_name);
    htmlContent = htmlContent.replace(/\{\{INVITATION_URL\}\}/g, invitation_url);

    const mailOptions = {
      from: process.env.GMAIL_USER || 'noreply@wedding.com',
      to: recipient_email,
      subject: `💍 Thiệp mời cưới - ${guest_name}`,
      html: htmlContent,
      replyTo: process.env.GMAIL_USER || 'noreply@wedding.com',
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: `Email đã gửi tới ${recipient_email}` });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ 
      message: 'Không thể gửi email', 
      detail: error.message 
    });
  }
});

app.post('/api/guests', async (req, res, next) => {
  const { name, description } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const guestResult = await client.query(
      `INSERT INTO guest (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at, updated_at`,
      [String(name).trim(), description ?? null]
    );

    const guest = guestResult.rows[0];
    const invitationPath = createInvitationPath(guest.name);

    const invitationResult = await client.query(
      `INSERT INTO private_invitation (guest_id, url)
       VALUES ($1, $2)
       RETURNING id, guest_id, url, created_at, updated_at`,
      [guest.id, invitationPath]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      guest,
      private_invitation: {
        ...invitationResult.rows[0],
        absolute_url: buildAbsoluteUrl(basePublicUrl, invitationResult.rows[0].url),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

app.get('/api/guests', async (_, res, next) => {
  try {
    const result = await pool.query(
      `SELECT g.id,
              g.name,
              g.description,
              g.created_at,
              g.updated_at,
              pi.id AS invitation_id,
              pi.url AS invitation_url,
              pi.created_at AS invitation_created_at,
              pi.updated_at AS invitation_updated_at
       FROM guest g
       LEFT JOIN private_invitation pi ON pi.guest_id = g.id
       ORDER BY g.created_at DESC`
    );

    return res.json(
      result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
        private_invitation: row.invitation_id
          ? {
              id: row.invitation_id,
              url: row.invitation_url,
              absolute_url: buildAbsoluteUrl(basePublicUrl, row.invitation_url),
              created_at: row.invitation_created_at,
              updated_at: row.invitation_updated_at,
            }
          : null,
      }))
    );
  } catch (error) {
    return next(error);
  }
});

app.get('/api/guests/:guestId', async (req, res, next) => {
  try {
    const { guestId } = req.params;

    const result = await pool.query(
      `SELECT g.id,
              g.name,
              g.description,
              g.created_at,
              g.updated_at,
              pi.id AS invitation_id,
              pi.url AS invitation_url,
              pi.created_at AS invitation_created_at,
              pi.updated_at AS invitation_updated_at
       FROM guest g
       LEFT JOIN private_invitation pi ON pi.guest_id = g.id
       WHERE g.id = $1
       LIMIT 1`,
      [guestId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'guest not found' });
    }

    const row = result.rows[0];

    return res.json({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      private_invitation: row.invitation_id
        ? {
            id: row.invitation_id,
            url: row.invitation_url,
            absolute_url: buildAbsoluteUrl(basePublicUrl, row.invitation_url),
            created_at: row.invitation_created_at,
            updated_at: row.invitation_updated_at,
          }
        : null,
    });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/guests/:guestId', async (req, res, next) => {
  try {
    const { guestId } = req.params;
    const { name, description } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const result = await pool.query(
      `UPDATE guest
       SET name = $2,
           description = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, description, created_at, updated_at`,
      [guestId, String(name).trim(), description ?? null]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'guest not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/guests/:guestId', async (req, res, next) => {
  try {
    const { guestId } = req.params;
    const result = await pool.query('DELETE FROM guest WHERE id = $1 RETURNING id', [guestId]);

    if (!result.rowCount) {
      return res.status(404).json({ message: 'guest not found' });
    }

    return res.json({ deleted: true, id: result.rows[0].id });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/private-invitations/resolve/:slug', async (req, res, next) => {
  try {
    const urlPath = `/thiepmoi/${req.params.slug}`;
    const result = await pool.query(
      `SELECT pi.id AS private_invitation_id,
              pi.url,
              g.id AS guest_id,
              g.name AS guest_name,
              g.description AS guest_description
       FROM private_invitation pi
       INNER JOIN guest g ON g.id = pi.guest_id
       WHERE pi.url = $1
       LIMIT 1`,
      [urlPath]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'private invitation not found' });
    }

    const row = result.rows[0];
    return res.json({
      guest: {
        id: row.guest_id,
        name: row.guest_name,
        description: row.guest_description,
      },
      private_invitation: {
        id: row.private_invitation_id,
        url: row.url,
        absolute_url: buildAbsoluteUrl(basePublicUrl, row.url),
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/private-invitations/by-guest/:guestId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT g.id AS guest_id,
              g.name AS guest_name,
              g.description AS guest_description,
              pi.id AS private_invitation_id,
              pi.url
       FROM guest g
       INNER JOIN private_invitation pi ON pi.guest_id = g.id
       WHERE g.id = $1
       LIMIT 1`,
      [req.params.guestId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'guest or invitation not found' });
    }

    const row = result.rows[0];
    return res.json({
      name_guest: row.guest_name,
      description_guest: row.guest_description,
      url_private_invitation: buildAbsoluteUrl(basePublicUrl, row.url),
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/messages-checkins', async (req, res, next) => {
  try {
    const {
      guest_id,
      invitation_slug,
      name_guest,
      messages,
      confirm_attendance,
      number_of_attendees,
      guests_type,
    } = req.body;

    if (!name_guest || !String(name_guest).trim()) {
      return res.status(400).json({ message: 'name_guest is required' });
    }

    let finalGuestId = guest_id || null;

    if (!finalGuestId && invitation_slug) {
      const invitationResult = await pool.query(
        `SELECT guest_id FROM private_invitation WHERE url = $1 LIMIT 1`,
        [`/thiepmoi/${String(invitation_slug).trim()}`]
      );

      if (invitationResult.rowCount) {
        finalGuestId = invitationResult.rows[0].guest_id;
      }
    }

    const result = await pool.query(
      `INSERT INTO messages_checkins (
         guest_id,
         name_guest,
         messages,
         confirm_attendance,
         number_of_attendees,
         guests_type
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        finalGuestId,
        String(name_guest).trim(),
        messages ?? null,
        confirm_attendance ?? null,
        Number.isInteger(number_of_attendees) ? number_of_attendees : null,
        guests_type ?? null,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/messages-checkins', async (_, res, next) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM messages_checkins
       ORDER BY created_at DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

app.get('/api/messages-checkins/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM messages_checkins WHERE id = $1 LIMIT 1', [req.params.id]);

    if (!result.rowCount) {
      return res.status(404).json({ message: 'message_checkin not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.put('/api/messages-checkins/:id', async (req, res, next) => {
  try {
    const {
      guest_id,
      name_guest,
      messages,
      confirm_attendance,
      number_of_attendees,
      guests_type,
    } = req.body;

    if (!name_guest || !String(name_guest).trim()) {
      return res.status(400).json({ message: 'name_guest is required' });
    }

    const result = await pool.query(
      `UPDATE messages_checkins
       SET guest_id = $2,
           name_guest = $3,
           messages = $4,
           confirm_attendance = $5,
           number_of_attendees = $6,
           guests_type = $7
       WHERE id = $1
       RETURNING *`,
      [
        req.params.id,
        guest_id ?? null,
        String(name_guest).trim(),
        messages ?? null,
        confirm_attendance ?? null,
        Number.isInteger(number_of_attendees) ? number_of_attendees : null,
        guests_type ?? null,
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ message: 'message_checkin not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/messages-checkins/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM messages_checkins WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rowCount) {
      return res.status(404).json({ message: 'message_checkin not found' });
    }

    return res.json({ deleted: true, id: result.rows[0].id });
  } catch (error) {
    return next(error);
  }
});

app.get('/thiepmoi/:slug', async (req, res, next) => {
  try {
    const urlPath = `/thiepmoi/${req.params.slug}`;

    const mappedTarget = directRedirectMap.get(urlPath);
    if (mappedTarget) {
      return res.redirect(302, mappedTarget);
    }

    const result = await pool.query(
      `SELECT g.id AS guest_id, g.name AS guest_name
       FROM private_invitation pi
       INNER JOIN guest g ON g.id = pi.guest_id
       WHERE pi.url = $1
       LIMIT 1`,
      [urlPath]
    );

    if (!result.rowCount) {
      return res.status(404).send('Không tìm thấy thiệp mời riêng.');
    }

    const row = result.rows[0];
    const redirectParams = new URLSearchParams({
      gid: row.guest_id,
      gname: row.guest_name,
      inv: req.params.slug,
    }).toString();

    return res.redirect(`/duccuong-nguyenquyet?${redirectParams}`);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: 'Internal server error',
    detail: error.message,
  });
});

async function start() {
  await bootstrapDatabase();
  loadDirectRedirectMap();

  // Start redirect server on port 3001
  const redirectPort = Number(process.env.REDIRECT_PORT || 3001);
  startRedirectServer(redirectPort);

  app.listen(port, () => {
    console.log(`Server running on ${basePublicUrl}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
