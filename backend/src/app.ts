import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import apiRouter from './routes/index';
import { errorHandler } from './middleware/error';
import { setupSwagger } from './docs/swagger';

dotenv.config();

const app: Express = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Turned off to avoid issues with swagger resources, react scripts locally
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite default port
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});
app.use('/api/', limiter);

// Cookie Parser & Body Parsers
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger setup
setupSwagger(app);

// Mount API Routes
app.use('/api', apiRouter);

// Root landing page endpoint
app.get('/', (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SyncBoard API Server</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #0f172a;
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }
            .card {
                background: rgba(30, 41, 59, 0.7);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                padding: 2.5rem;
                border-radius: 1.5rem;
                text-align: center;
                box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3);
                max-width: 500px;
            }
            h1 {
                color: #6366f1;
                margin-top: 0;
                font-size: 2.5rem;
            }
            p {
                color: #94a3b8;
                font-size: 1.1rem;
                line-height: 1.6;
            }
            .status-badge {
                background-color: #10b981;
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 9999px;
                font-size: 0.875rem;
                font-weight: 600;
                display: inline-block;
                margin-bottom: 1rem;
            }
            .links {
                margin-top: 2rem;
                display: flex;
                gap: 1rem;
                justify-content: center;
            }
            a {
                background-color: #6366f1;
                color: white;
                padding: 0.75rem 1.5rem;
                border-radius: 0.75rem;
                text-decoration: none;
                font-weight: 600;
                transition: background 0.2s;
            }
            a:hover {
                background-color: #4f46e5;
            }
            a.secondary {
                background-color: transparent;
                border: 1px solid #6366f1;
                color: #6366f1;
            }
            a.secondary:hover {
                background-color: rgba(99, 102, 241, 0.1);
            }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="status-badge">● API Online</div>
            <h1>SyncBoard</h1>
            <p>SyncBoard collaborative API server is successfully running and ready to handle real-time board connections.</p>
            <div class="links">
                <a href="/api-docs">Interactive API Docs</a>
                <a href="${process.env.FRONTEND_URL || 'https://syncboard-frontend-i8zy.onrender.com'}" class="secondary">Frontend App</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Centralized error handling
app.use(errorHandler);

export default app;
export { app };
