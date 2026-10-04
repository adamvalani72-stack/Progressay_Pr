import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3001);
const siteUrl = (process.env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '10kb' }));

app.get('/api/health', function (request, response) {
  response.json({ status: 'ok' });
});

app.use(function (request, response, next) {
  if (['/server.js', '/package.json', '/package-lock.json'].includes(request.path)) {
    response.sendStatus(404);
    return;
  }
  next();
});

app.use(express.static(rootDirectory, { dotfiles: 'deny' }));

app.listen(port, function () {
  console.log(`Gaming Hub is running at ${siteUrl}`);
});