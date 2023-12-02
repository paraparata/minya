const server = Bun.serve<{ authToken: string }>({
  port: 3000,
  fetch(req, server) {
    const success = server.upgrade(req);
    if (success) {
      // Bun automatically returns a 101 Switching Protocols
      // if the upgrade succeeds
      return undefined;
    }

    // handle HTTP request normally
    return new Response("Hello world!");
  },
  websocket: {
    // this is called when a message is received
    async message(ws, msg) {
      if (typeof msg === "string") {
        const req = JSON.parse(msg) as {
          command: "req-text" | "req-progress";
          message: string;
        };

        let res:
          | { command: "res-text" | "res-progress"; message: any }
          | undefined;

        if (req.command === "req-text") {
          res = {
            command: "res-text",
            message: req.message
              .toString()
              .toLowerCase()
              .split(" ")
              .join("-:-"),
          };
          ws.send(JSON.stringify(res));
        } else if (req.command === "req-progress") {
          res = {
            command: "res-progress",
            message: { current: 0, total: 100 },
          };
          const itv = setInterval(() => {
            ws.send(JSON.stringify(res));
            if (
              res?.message.current !== undefined &&
              res?.message.total !== undefined
            ) {
              res.message.current += 10;
              if (res.message.current === res.message.total) clearInterval(itv);
            }
          }, 1000);
        } else {
          res = { command: "res-text", message: "nganu" };
          ws.send(JSON.stringify(res));
        }
      }
    },
  },
});

console.log(`Listening on ${server.hostname}:${server.port}`);
