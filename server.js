// create simple-peer signaling server

const { WebSocket, WebSocketServer } = require("ws");

const port = process.env.PORT || 4000;

const wss = new WebSocketServer({ port });

let channels = {};

wss.on("connection", function connection(ws, req) {
  const channelId = req.url.substring(1);
  if (!channelId || channelId.length !== 21) {
    console.log("Invalid channel ID");
    ws.close();
    return;
  }

  ws.channelId = channelId;
  ws.connectionTime = Date.now();
  const ipAddress = req.socket.remoteAddress;
  console.log(`New connection: ${ws.channelId} [${ipAddress}]`);
  channels[channelId] = channels[channelId] || [];
  channels[channelId].push(ws);
  if (channels[channelId].length === 2) {
    channels[channelId].forEach((client) => client.send("START_PEERING"));
  }

  ws.on("message", (message) => {
    channels[ws.channelId].forEach((client) => {
      if (client === ws) return;
      message = message.toString();
      client.send(message);
    });
  });

  ws.on("close", cleanup);
  ws.on("error", cleanup);
  function cleanup() {
    channels[ws.channelId] = channels[ws.channelId].filter(
      (client) => client !== ws
    );
    if (channels[ws.channelId].length === 0) {
      delete channels[ws.channelId];
    }
  }
});

wss.on("listening", function listening() {
  console.log(`Signaling server running on port ${port}`);
});

setInterval(() => {
  //purge connections older than 5 minutes
  const now = Date.now();
  wss.clients.forEach(function each(client) {
    if (
      client.readyState === WebSocket.OPEN &&
      now - client.connectionTime > 1000 * 60 * 5
    ) {
      console.log(`Closing connection [${client.channelId}]`);
      client.close();
    }
  });
}, 1000 * 60 * 5);
