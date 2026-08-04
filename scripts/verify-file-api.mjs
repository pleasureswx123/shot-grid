import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';

const baseUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;
const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@studio.local',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  }),
});
if (!loginResponse.ok) throw new Error(`Login failed: HTTP ${loginResponse.status}`);

const cookie = loginResponse.headers.get('set-cookie')?.split(';', 1)[0];
if (!cookie) throw new Error('Login did not return a session cookie.');

const projectsResponse = await fetch(`${baseUrl}/api/projects`, { headers: { cookie } });
if (!projectsResponse.ok) throw new Error(`Project list failed: HTTP ${projectsResponse.status}`);
const projectsBody = await projectsResponse.json();
const project = projectsBody.projects?.[0];
if (!project) throw new Error('No project is available for file verification.');

const source = fs.readFileSync('package.json');
const form = new FormData();
form.append('projectId', project.id);
form.append('fileType', 'source');
form.append('entityType', '');
form.append('entityCode', '');
form.append('versionNumber', 'TEST');
form.append('file', new Blob([source], { type: 'application/json' }), 'lan-storage-test.json');

const uploadResponse = await fetch(`${baseUrl}/api/files/upload`, {
  method: 'POST',
  headers: { cookie },
  body: form,
});
const uploadBody = await uploadResponse.json();
if (!uploadResponse.ok) {
  throw new Error(`Upload failed: HTTP ${uploadResponse.status} ${uploadBody.error || ''}`);
}

const downloadResponse = await fetch(`${baseUrl}${uploadBody.file.contentUrl}`, {
  headers: { cookie },
});
const downloaded = Buffer.from(await downloadResponse.arrayBuffer());
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
if (!downloadResponse.ok || digest(source) !== digest(downloaded)) {
  throw new Error('Downloaded file did not match the uploaded source.');
}

const deleteResponse = await fetch(`${baseUrl}/api/files/${uploadBody.file.id}`, {
  method: 'DELETE',
  headers: { cookie },
});
if (!deleteResponse.ok) throw new Error(`Recoverable delete failed: HTTP ${deleteResponse.status}`);

console.log(JSON.stringify({
  login: true,
  project: project.code,
  upload: true,
  download: true,
  sha256Verified: true,
  recoverableDelete: true,
}));
