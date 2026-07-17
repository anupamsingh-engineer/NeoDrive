import { httpRequestDuration, httpRequestsTotal } from "../config/metrics.js";

export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });

  next();
}
