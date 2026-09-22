import { Router } from 'express';
import { eventBus } from '../utils/logger.js';

export const logRouter = Router();

logRouter.get('/', (req, res) => {
  res.json(eventBus.getRecentLogs());
});

logRouter.delete('/', (req, res) => {
  eventBus.clearLogs();
  res.json({ success: true, message: 'Logs limpiados' });
});
