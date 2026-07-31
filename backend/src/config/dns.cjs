// Side-effect only: overrides this process's DNS resolver to public DNS (Google + Cloudflare)
// before any MongoDB Atlas connection is attempted. Some networks' default/ISP-provided DNS
// resolver doesn't correctly handle the `_mongodb._tcp.<host>` SRV record lookup a
// `mongodb+srv://` connection string requires, failing with `querySrv ECONNREFUSED`, even
// though plain A-record lookups work fine on the same network - overriding the resolver
// sidesteps that entirely.
//
// `dns.setServers()` is per-process, in-memory - it does NOT persist across separate Node
// process invocations, so every entry point that connects to Mongo needs to apply this itself:
// server.js, src/worker.js (import "../config/dns.cjs" / "./config/dns.cjs"), and
// migrate-mongo-config.cjs (require("./src/config/dns.cjs")) all do. Written as plain CommonJS
// (not the project's default ESM) specifically so migrate-mongo's own CLI process - which loads
// migrate-mongo-config.cjs via `require`, not `import` - can use the exact same module as the
// two ESM entry points; Node's ESM loader can `import` a `.cjs` file for its side effects too.
const dns = require("node:dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

module.exports = {};
