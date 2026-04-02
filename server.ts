/**
 * Custom HTTP server for Next.js + Twilio Media Streams WebSocket bridge.
 *
 * Vercel and other serverless hosts cannot keep this upgrade path alive; run on a VM,
 * Fly.io, Railway, Docker, or local dev with a public `wss` URL (e.g. ngrok) for Twilio.
 *
 * Set `TWILIO_VOICE_MEDIA_STREAM_URL=wss://<host>/api/twilio/voice/media-stream` (no query string).
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { attachTwilioMediaBridge, TWILIO_MEDIA_STREAM_WS_PATH } from '@/lib/bot/twilioOpenaiMediaBridge';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
const port = parseInt(process.env.PORT ?? '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    try {
      const parsedUrl = parse(req.url ?? '/', true);
      void handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling HTTP request', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = parse(request.url ?? '/', false).pathname;

    if (pathname === TWILIO_MEDIA_STREAM_WS_PATH) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        attachTwilioMediaBridge(ws, request);
      });
      return;
    }

    socket.destroy();
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    console.info(`Ready http://${hostname}:${port} (media stream WS: ${TWILIO_MEDIA_STREAM_WS_PATH})`);
  });
});
