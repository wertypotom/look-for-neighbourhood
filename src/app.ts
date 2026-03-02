import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';

import { env } from './config/env';
import neighbourhoodRoutes from './modules/neighbourhoods/neighbourhoods.routes';
import { logger } from './utils/logger';

const app = express();

// Security Middlewares
app.use(helmet());

// Enable CORS for React client
app.use(
  cors({
    origin: env.NODE_ENV === 'development' ? 'http://localhost:5173' : '*',
    credentials: true,
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Prevent parameter pollution
app.use(hpp());

import { healthRoutes } from './modules/health/health.routes';

// Routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/neighbourhoods', neighbourhoodRoutes);

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to Look For Neighbourhood API!',
  });
});

// Handle 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  logger.error(`[App] Error on ${req.method} ${req.url}: ${err.message}`, err);

  res.status(statusCode).json({
    status,
    message: err.message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
