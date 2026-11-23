const db = require('../db/database.js');

class EventHub {
  constructor() {
    // Map of runId -> Set of express response objects
    this.clients = new Map();
  }

  /**
   * Register an SSE client for a specific audit run.
   */
  subscribe(runId, res, req, lastEventId = 0) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    res.flushHeaders?.();

    if (!this.clients.has(runId)) {
      this.clients.set(runId, new Set());
    }
    const runClients = this.clients.get(runId);
    runClients.add(res);

    // Initial connection comment
    res.write(`: connected to audit run ${runId}\n\n`);

    // Replay past events if lastEventId is provided or if reconnecting
    const history = db.getEvents(runId, lastEventId);
    for (const ev of history) {
      res.write(`id: ${ev.eventId}\ndata: ${JSON.stringify(ev)}\n\n`);
    }

    // Keep-alive heartbeat interval
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (err) {
        clearInterval(heartbeat);
      }
    }, 15000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      runClients.delete(res);
      if (runClients.size === 0) {
        this.clients.delete(runId);
      }
    });
  }

  /**
   * Record and broadcast an event to all subscribers of a run.
   */
  publish(eventPayload) {
    const recorded = db.recordEvent(eventPayload);
    const runClients = this.clients.get(recorded.runId);

    if (runClients && runClients.size > 0) {
      const dataStr = `id: ${recorded.eventId}\ndata: ${JSON.stringify(recorded)}\n\n`;
      for (const client of runClients) {
        try {
          client.write(dataStr);
        } catch (err) {
          runClients.delete(client);
        }
      }
    }
    return recorded;
  }
}

const eventHub = new EventHub();
module.exports = eventHub;
