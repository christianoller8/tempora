import http from 'http';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();
const server = http.createServer(app);

const PORT = Number(process.env['PORT'] ?? 3000);

server.listen(PORT, () => {
  console.log(`Tempora API listening on :${PORT}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
