import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { financeService } from '../storage/financeService.js';
import { voucherVisionService } from '../services/voucherVisionService.js';
import { baileysManager } from '../whatsapp/baileysClient.js';
import { geminiService } from '../ai/geminiService.js';
import { eventBus } from '../utils/logger.js';

export const financeRouter = Router();

// Multer storage for testing vouchers via web upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// ============================================================================
// 1. MÉTRICAS GLOBALES & REPORTES FINANCIEROS
// ============================================================================

financeRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await financeService.getFinancialStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener métricas financieras' });
  }
});

financeRouter.get('/debtors', async (req: Request, res: Response) => {
  try {
    const debtors = await financeService.getDebtors();
    res.json(debtors);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener lista de deudores' });
  }
});

// ============================================================================
// 2. MENSUALIDADES Y ESTADOS DE CUENTA (BILLS)
// ============================================================================

financeRouter.get('/bills', async (req: Request, res: Response) => {
  try {
    const { studentPhone, status, search, limit } = req.query;
    const bills = await financeService.getBills({
      studentPhone: studentPhone ? String(studentPhone) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(bills);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al listar mensualidades' });
  }
});

financeRouter.get('/bills/:id', async (req: Request, res: Response) => {
  try {
    const bill = await financeService.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }
    res.json(bill);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener cuota' });
  }
});

financeRouter.post('/bills', async (req: Request, res: Response) => {
  try {
    const { studentPhone, studentName, planId, concept, amount, currency, dueDate, notes } = req.body;
    if (!studentPhone || !concept || !amount || !dueDate) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (teléfono, concepto, monto, fecha de vencimiento)' });
    }

    const created = await financeService.createBill({
      studentPhone,
      studentName,
      planId: planId ? Number(planId) : undefined,
      concept,
      amount: Number(amount),
      currency: currency || 'USD',
      dueDate,
      notes,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Error al generar cuota' });
  }
});

financeRouter.patch('/bills/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['pending', 'partial', 'paid', 'overdue', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Estado de cuota inválido' });
    }
    const updated = await financeService.updateBillStatus(req.params.id, status);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar estado de cuota' });
  }
});

financeRouter.post('/bills/:id/reminder', async (req: Request, res: Response) => {
  try {
    const bill = await financeService.getBillById(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    const cleanPhone = bill.student_phone.replace(/[^0-9]/g, '');
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;

    const messageText = `🔔 *RECORDATORIO DE PAGO PENDIENTE*

Hola *${bill.student_name}*, te saludamos cordialmente para recordarte el estado de tu cuenta:

📌 *Concepto:* ${bill.concept}
💰 *Monto a Pagar:* $${bill.balance_pending.toFixed(2)} ${bill.currency}
📅 *Fecha de Vencimiento:* ${bill.due_date}
🔖 *Código de Cuota:* ${bill.bill_code}

Puedes realizar tu abono mediante transferencia, Yape, Plin o depósito, y enviarnos la foto de tu comprobante directamente por este chat. ¡Nuestra IA lo validará al instante!`;

    await baileysManager.sendMessage(remoteJid, { text: messageText });
    await financeService.markReminderSent(bill.id);

    eventBus.log('success', 'whatsapp', `Recordatorio de cobro enviado a ${bill.student_name} (${cleanPhone}) por $${bill.balance_pending}`);
    res.json({ success: true, message: `Recordatorio enviado a ${bill.student_name}.` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al enviar recordatorio de pago' });
  }
});

// ============================================================================
// 3. COMPROBANTES DE PAGO (VOUCHERS) & IA VISION
// ============================================================================

financeRouter.get('/vouchers', async (req: Request, res: Response) => {
  try {
    const { phone, status, limit } = req.query;
    const vouchers = await financeService.getVouchers({
      phone: phone ? String(phone) : undefined,
      status: status ? String(status) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(vouchers);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al listar comprobantes' });
  }
});

financeRouter.patch('/vouchers/:id/review', async (req: Request, res: Response) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['validated', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Estado de revisión inválido' });
    }
    const updated = await financeService.updateVoucherStatus(req.params.id, status, rejectionReason);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar comprobante' });
  }
});

/**
 * Endpoint to test or simulate voucher validation from the Web Dashboard
 */
financeRouter.post('/simulate-voucher', upload.single('voucher'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes adjuntar una imagen de comprobante (voucher).' });
    }

    const studentPhone = req.body.studentPhone || '51999888777';
    const studentName = req.body.studentName || 'Carlos Mendez';
    const buffer = req.file.buffer;
    const mimeType = req.file.mimetype || 'image/jpeg';

    // 1. Save voucher image
    const filename = voucherVisionService.saveVoucherImage(buffer, 'jpg');

    // 2. Analyze with Gemini Vision
    const analysis = await voucherVisionService.analyzeVoucher(buffer, mimeType);

    // 3. Apply payment if valid
    let paymentResult: any = null;
    if (analysis.isValidVoucher && analysis.amount > 0) {
      paymentResult = await financeService.applyVoucherPayment({
        studentPhone,
        studentName,
        amountDetected: analysis.amount,
        currency: analysis.currency,
        bankOrPlatform: analysis.bankOrPlatform,
        operationNumber: analysis.operationNumber,
        paymentDate: analysis.paymentDate,
        imageFilename: filename,
        geminiAnalysisRaw: analysis,
        validatedBy: 'gemini_ai',
      });
    }

    res.json({
      success: true,
      analysis,
      paymentResult,
      imageFilename: filename,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al procesar comprobante con IA Vision' });
  }
});

// ============================================================================
// 4. PLANES Y TARIFAS
// ============================================================================

financeRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await financeService.getPlans();
    res.json(plans);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener planes' });
  }
});

financeRouter.post('/plans', async (req: Request, res: Response) => {
  try {
    const created = await financeService.createPlan(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al crear plan' });
  }
});

financeRouter.put('/plans/:id', async (req: Request, res: Response) => {
  try {
    const updated = await financeService.updatePlan(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar plan' });
  }
});

financeRouter.delete('/plans/:id', async (req: Request, res: Response) => {
  try {
    await financeService.deletePlan(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al eliminar plan' });
  }
});

// ============================================================================
// 5. ASISTENTE GEMINI ANALÍTICO EJECUTIVO (CONSULTAS DE NEGOCIO EN LENGUAJE NATURAL)
// ============================================================================

financeRouter.post('/ai-consult', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Se requiere una consulta o pregunta en lenguaje natural.' });
    }

    // Direct simulated executive query with admin phone context
    const adminPhone = 'admin-dashboard';
    const result = await geminiService.generateResponse(adminPhone, prompt, 'Administrador');

    res.json({
      success: true,
      prompt,
      response: result.text,
      mediaIdToSend: result.mediaIdToSend,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al procesar consulta analítica con Gemini' });
  }
});
