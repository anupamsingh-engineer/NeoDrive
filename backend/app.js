import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import env from "./src/config/env.js";
import routes from "./src/routes/index.js";
import webhookRoutes from "./src/routes/webhook.routes.js";
import { requestContextMiddleware } from "./src/middlewares/requestContext.middleware.js";
import { httpLoggerMiddleware } from "./src/middlewares/httpLogger.middleware.js";
import { metricsMiddleware } from "./src/middlewares/metrics.middleware.js";
import { globalLimiter } from "./src/middlewares/rateLimit.middleware.js";
import { notFoundMiddleware } from "./src/middlewares/notFound.middleware.js";
import { errorHandlerMiddleware } from "./src/middlewares/errorHandler.middleware.js";

const app = express();

// Required for correct req.ip / rate-limiting behind a reverse proxy or load balancer.
app.set("trust proxy", 1);

app.use(requestContextMiddleware);
app.use(httpLoggerMiddleware);
app.use(metricsMiddleware);
// File downloads redirect to a CloudFront origin - default same-origin CORP would break
// clients that fetch() those URLs instead of doing a top-level navigation.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.cors.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(cookieParser());

// Mounted ahead of the global JSON parser: it needs the raw request bytes to verify the
// Razorpay signature, which a re-serialized req.body cannot reliably reproduce.
app.use("/webhooks", webhookRoutes);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(mongoSanitize());
app.use(hpp()); // prevent from http parameter polloution -> /health?role=user&role=admin -> req.query.role = [user,admin] but with hpp only last or fast will be passed based on conf like user or admin 
app.use(globalLimiter);

app.get("/", (req, res) => {
  res.json({ message: "NeoDrive API" });
});

app.use(routes);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export default app;
