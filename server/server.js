import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/db.js';
import newsRoutes from './routes/newsRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AI News Navigator API' });
});

app.use('/api/news', newsRoutes);
app.use('/api/ai', aiRoutes);

app.use((err, _req, res, _next) => {
  const isDisabledImageGenerationError =
    err.statusCode === 503 &&
    String(err.message || '').includes('AI image generation is currently disabled');

  if (!isDisabledImageGenerationError) {
    console.error(err);
  }

  if (err.details && !isDisabledImageGenerationError) {
    console.error('Upstream details:', err.details);
  }

  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
