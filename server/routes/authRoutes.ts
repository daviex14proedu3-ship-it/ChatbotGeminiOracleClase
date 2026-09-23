import { Router } from 'express';
import {
  validateCredentials,
  generateToken,
  requireAuth,
  getAdminEmail,
} from '../utils/auth.js';
import { eventBus } from '../utils/logger.js';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Validates email and password against .env configured credentials
 */
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      success: false,
      error: 'Correo electrónico y contraseña requeridos.',
    });
    return;
  }

  const isValid = validateCredentials(email, password);

  if (!isValid) {
    eventBus.log('warn', 'system', `Intento fallido de inicio de sesión con email: ${email}`);
    res.status(401).json({
      success: false,
      error: 'Credenciales incorrectas. Verifique correo o contraseña.',
    });
    return;
  }

  const token = generateToken(email);
  eventBus.log('info', 'system', `Sesión iniciada con éxito por: ${email}`);

  res.json({
    success: true,
    token,
    user: {
      email: getAdminEmail(),
    },
  });
});

/**
 * GET /api/auth/verify
 * Verifies if the existing session token is valid and active
 */
authRouter.get('/verify', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Logs out the current session
 */
authRouter.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Sesión cerrada correctamente.',
  });
});
