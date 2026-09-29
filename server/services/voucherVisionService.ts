import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage/store.js';
import { eventBus } from '../utils/logger.js';

export interface ExtractedVoucherData {
  isValidVoucher: boolean;
  bankOrPlatform: string;
  amount: number;
  currency: string;
  operationNumber: string;
  paymentDate: string;
  paymentTime?: string;
  senderName?: string;
  recipientName?: string;
  confidenceScore: number;
  summary: string;
  rejectionReason?: string;
}

export class VoucherVisionService {
  private vouchersDir: string;

  constructor() {
    this.vouchersDir = path.resolve(process.cwd(), 'data', 'uploads', 'vouchers');
    if (!fs.existsSync(this.vouchersDir)) {
      fs.mkdirSync(this.vouchersDir, { recursive: true });
    }
  }

  public getVouchersDir(): string {
    return this.vouchersDir;
  }

  /**
   * Saves the raw image buffer to data/uploads/vouchers/
   */
  public saveVoucherImage(buffer: Buffer, originalExt: string = 'jpg'): string {
    const filename = `voucher_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}.${originalExt}`;
    const filePath = path.join(this.vouchersDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filename;
  }

  /**
   * Analyzes an image with Google Gemini Multimodal Vision to extract voucher details
   */
  public async analyzeVoucher(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<ExtractedVoucherData> {
    const settings = storage.getSettings();
    const activeKeyConfig = settings.geminiKeys.find(k => k.status === 'active' || k.status === 'untested') || settings.geminiKeys[0];

    if (!activeKeyConfig || !activeKeyConfig.key) {
      throw new Error('No hay clave de Google AI Studio configurada para Gemini Vision.');
    }

    const genAI = new GoogleGenerativeAI(activeKeyConfig.key.trim());
    const base64Data = imageBuffer.toString('base64');

    const prompt = `Actúa como un perito contable y auditor financiero experto con visión artificial.
Tu tarea es inspeccionar minuciosamente esta imagen para determinar si corresponde a un COMPROBANTE DE PAGO BANCARIO O TRANSFERENCIA VÁLIDA (como voucher de transferencia bancaria, Yape, Plin, BCP, BBVA, Interbank, depósito, recibo de pago, etc.).

Debes responder ÚNICAMENTE con un objeto JSON válido (sin código markdown ni explicaciones adicionales) con esta estructura exacta:
{
  "isValidVoucher": true | false,
  "bankOrPlatform": "Yape" | "Plin" | "BCP" | "BBVA" | "Interbank" | "Transferencia Bancaria" | "Depósito" | "Otro",
  "amount": 50.00,
  "currency": "USD" | "PEN" | "EUR" | "OTRO",
  "operationNumber": "12345678",
  "paymentDate": "YYYY-MM-DD",
  "paymentTime": "HH:MM",
  "senderName": "Nombre de quien envía",
  "recipientName": "Nombre de quien recibe",
  "confidenceScore": 0.95,
  "summary": "Breve resumen en español del comprobante",
  "rejectionReason": ""
}

REGLAS ESTRICTAS DE VALIDACIÓN:
1. Si la imagen NO es un comprobante de pago (por ejemplo, una foto de una persona, meme, paisaje, texto común, catálogo o captura que no sea de una transacción de dinero), establece "isValidVoucher": false, "amount": 0, y explica brevemente en "rejectionReason" por qué no es válido.
2. Si es un comprobante auténtico, extrae el monto numérico exacto (sin símbolos de moneda), el banco o billetera, el código o número de operación/referencia, y la fecha.
3. Si la moneda detectada es Soles (S/.) o Dólares ($), colócala en "currency".
4. Devuelve ÚNICAMENTE el JSON puro.`;

    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ];

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType || 'image/jpeg',
            },
          },
        ]);

        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Gemini Vision no devolvió un JSON reconocible.');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
          isValidVoucher: Boolean(parsed.isValidVoucher),
          bankOrPlatform: parsed.bankOrPlatform || 'Transferencia',
          amount: Math.abs(Number(parsed.amount) || 0),
          currency: parsed.currency || 'USD',
          operationNumber: String(parsed.operationNumber || '').trim(),
          paymentDate: parsed.paymentDate || new Date().toISOString().split('T')[0],
          paymentTime: parsed.paymentTime || '',
          senderName: parsed.senderName || '',
          recipientName: parsed.recipientName || '',
          confidenceScore: Number(parsed.confidenceScore) || 0.8,
          summary: parsed.summary || 'Comprobante procesado con IA.',
          rejectionReason: parsed.rejectionReason || undefined,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`VoucherVisionService: Falló análisis con ${modelName}:`, err?.message || err);
      }
    }

    throw lastError || new Error('No se pudo analizar el comprobante con los modelos de Gemini Vision.');
  }
}

export const voucherVisionService = new VoucherVisionService();
