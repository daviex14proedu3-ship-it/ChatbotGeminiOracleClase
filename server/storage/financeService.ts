import { databaseService } from './databaseService.js';
import { eventBus } from '../utils/logger.js';

export interface Plan {
  id: number;
  code: string;
  name: string;
  description: string;
  price: number;
  billing_cycle: 'monthly' | 'biweekly' | 'one_time' | 'annual';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StudentBill {
  id: number;
  bill_code: string;
  student_phone: string;
  student_name: string;
  plan_id?: number | null;
  concept: string;
  amount: number;
  amount_paid: number;
  balance_pending: number;
  currency: string;
  due_date: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  reminder_sent: boolean;
  reminder_sent_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentVoucher {
  id: number;
  voucher_code: string;
  student_phone: string;
  student_name?: string;
  bill_id?: number | null;
  amount_detected: number;
  amount_approved: number;
  currency: string;
  bank_or_platform?: string;
  operation_number?: string;
  payment_date?: string;
  image_filename?: string;
  gemini_analysis?: any;
  status: 'validated' | 'pending_review' | 'rejected';
  rejection_reason?: string;
  validated_by: 'gemini_ai' | 'admin';
  created_at?: string;
  updated_at?: string;
}

export interface FinancialStats {
  totalCollectedMonth: number;
  totalPendingAmount: number;
  activeStudents: number;
  overdueBillsCount: number;
  vouchersValidatedToday: number;
  collectionRatePct: number;
}

export interface DebtorSummary {
  student_phone: string;
  student_name: string;
  total_debt: number;
  bills_count: number;
  oldest_due_date: string;
  concepts: string;
}

class FinanceService {
  /**
   * Helper: executes query on primary PostgreSQL pool or Supabase fallback
   */
  private async query(text: string, params: any[] = []): Promise<any[]> {
    let lastError: any = null;
    const pgPool = databaseService.getPgPool();
    if (pgPool) {
      try {
        const res = await pgPool.query(text, params);
        return res.rows;
      } catch (err: any) {
        lastError = err;
        console.warn('FinanceService: Primary query failed, attempting Supabase fallback:', err?.message || err);
      }
    }

    // Supabase Fallback via direct pool if configured
    const supaPool = databaseService.getSupabasePool();
    if (supaPool) {
      try {
        const res = await supaPool.query(text, params);
        return res.rows;
      } catch (err: any) {
        lastError = err;
        console.warn('FinanceService: Supabase pool query failed:', err?.message || err);
      }
    }

    throw lastError || new Error('No hay bases de datos disponibles para ejecutar la consulta financiera.');
  }

  // ============================================================================
  // 1. PLANES & TARIFAS
  // ============================================================================

  public async getPlans(): Promise<Plan[]> {
    return await this.query(`
      SELECT id, code, name, description, price::float, billing_cycle, is_active,
             created_at::text, updated_at::text
      FROM public.plans
      ORDER BY id ASC;
    `);
  }

  public async createPlan(data: Partial<Plan>): Promise<Plan> {
    const code = data.code || `PLAN-${Math.floor(1000 + Math.random() * 9000)}`;
    const rows = await this.query(`
      INSERT INTO public.plans (code, name, description, price, billing_cycle, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, code, name, description, price::float, billing_cycle, is_active, created_at::text, updated_at::text;
    `, [
      code,
      data.name || 'Nuevo Plan',
      data.description || '',
      Number(data.price) || 0.00,
      data.billing_cycle || 'monthly',
      data.is_active !== false,
    ]);
    eventBus.log('info', 'system', `Nuevo Plan creado: ${rows[0].name} ($${rows[0].price})`);
    return rows[0];
  }

  public async updatePlan(id: number | string, data: Partial<Plan>): Promise<Plan> {
    const rows = await this.query(`
      UPDATE public.plans
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          price = COALESCE($3, price),
          billing_cycle = COALESCE($4, billing_cycle),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING id, code, name, description, price::float, billing_cycle, is_active, created_at::text, updated_at::text;
    `, [
      data.name,
      data.description,
      data.price !== undefined ? Number(data.price) : null,
      data.billing_cycle,
      data.is_active,
      id,
    ]);
    return rows[0];
  }

  public async deletePlan(id: number | string): Promise<boolean> {
    await this.query(`DELETE FROM public.plans WHERE id = $1;`, [id]);
    return true;
  }

  // ============================================================================
  // 2. ESTADOS DE CUENTA Y MENSUALIDADES (STUDENT BILLS)
  // ============================================================================

  public async getBills(filters: {
    studentPhone?: string;
    status?: string;
    search?: string;
    limit?: number;
  } = {}): Promise<StudentBill[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (filters.studentPhone) {
      const cleanPhone = filters.studentPhone.replace(/[^0-9]/g, '');
      conditions.push(`student_phone = $${idx++}`);
      params.push(cleanPhone);
    }
    if (filters.status && filters.status !== 'all') {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.search) {
      conditions.push(`(student_name ILIKE $${idx} OR student_phone ILIKE $${idx} OR bill_code ILIKE $${idx} OR concept ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const limit = filters.limit || 100;
    params.push(limit);

    return await this.query(`
      SELECT id, bill_code, student_phone, student_name, plan_id, concept,
             amount::float, amount_paid::float, balance_pending::float,
             currency, due_date::text, status, notes, reminder_sent,
             reminder_sent_at::text, paid_at::text, created_at::text, updated_at::text
      FROM public.student_bills
      WHERE ${conditions.join(' AND ')}
      ORDER BY due_date ASC, id DESC
      LIMIT $${idx};
    `, params);
  }

  public async getBillById(id: number | string): Promise<StudentBill | null> {
    const rows = await this.query(`
      SELECT id, bill_code, student_phone, student_name, plan_id, concept,
             amount::float, amount_paid::float, balance_pending::float,
             currency, due_date::text, status, notes, reminder_sent,
             reminder_sent_at::text, paid_at::text, created_at::text, updated_at::text
      FROM public.student_bills
      WHERE id = $1;
    `, [id]);
    return rows[0] || null;
  }

  public async getBillsByPhone(phone: string): Promise<StudentBill[]> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return await this.getBills({ studentPhone: cleanPhone, limit: 50 });
  }

  public async getPendingBillsForPhone(phone: string): Promise<StudentBill[]> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return await this.query(`
      SELECT id, bill_code, student_phone, student_name, plan_id, concept,
             amount::float, amount_paid::float, balance_pending::float,
             currency, due_date::text, status, notes, reminder_sent,
             reminder_sent_at::text, paid_at::text, created_at::text, updated_at::text
      FROM public.student_bills
      WHERE student_phone = $1 AND status IN ('pending', 'partial', 'overdue')
      ORDER BY due_date ASC;
    `, [cleanPhone]);
  }

  public async createBill(data: {
    studentPhone: string;
    studentName: string;
    planId?: number;
    concept: string;
    amount: number;
    currency?: string;
    dueDate: string;
    notes?: string;
  }): Promise<StudentBill> {
    const cleanPhone = data.studentPhone.replace(/[^0-9]/g, '');
    const billCode = `CUOTA-${Date.now().toString().slice(-6)}`;
    const amount = Number(data.amount) || 0;
    const currency = data.currency || 'USD';

    const rows = await this.query(`
      INSERT INTO public.student_bills (
        bill_code, student_phone, student_name, plan_id, concept,
        amount, amount_paid, balance_pending, currency, due_date, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, 0.00, $5, $6, $7, 'pending', $8)
      RETURNING id, bill_code, student_phone, student_name, plan_id, concept,
                amount::float, amount_paid::float, balance_pending::float,
                currency, due_date::text, status, notes, reminder_sent,
                reminder_sent_at::text, paid_at::text, created_at::text, updated_at::text;
    `, [
      billCode,
      cleanPhone,
      data.studentName || `Alumno ${cleanPhone.slice(-4)}`,
      data.planId || null,
      data.concept || 'Mensualidad',
      amount,
      currency,
      data.dueDate,
      data.notes || '',
    ]);

    eventBus.log('info', 'system', `Nueva cuota generada: ${billCode} para ${data.studentName} por $${amount}`);
    return rows[0];
  }

  public async updateBillStatus(id: number | string, status: string): Promise<StudentBill> {
    const paidAt = status === 'paid' ? 'NOW()' : 'NULL';
    const rows = await this.query(`
      UPDATE public.student_bills
      SET status = $1,
          paid_at = ${paidAt},
          balance_pending = CASE WHEN $1 = 'paid' THEN 0.00 ELSE balance_pending END,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, bill_code, student_phone, student_name, plan_id, concept,
                amount::float, amount_paid::float, balance_pending::float,
                currency, due_date::text, status, notes, reminder_sent,
                reminder_sent_at::text, paid_at::text, created_at::text, updated_at::text;
    `, [status, id]);
    return rows[0];
  }

  public async markReminderSent(id: number | string): Promise<void> {
    await this.query(`
      UPDATE public.student_bills
      SET reminder_sent = true,
          reminder_sent_at = NOW(),
          updated_at = NOW()
      WHERE id = $1;
    `, [id]);
  }

  // ============================================================================
  // 3. COMPROBANTES DE PAGO (PAYMENT VOUCHERS) & IA VISION MATCHING
  // ============================================================================

  public async getVouchers(filters: {
    phone?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<PaymentVoucher[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (filters.phone) {
      const cleanPhone = filters.phone.replace(/[^0-9]/g, '');
      conditions.push(`student_phone = $${idx++}`);
      params.push(cleanPhone);
    }
    if (filters.status && filters.status !== 'all') {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }

    const limit = filters.limit || 50;
    params.push(limit);

    return await this.query(`
      SELECT id, voucher_code, student_phone, student_name, bill_id,
             amount_detected::float, amount_approved::float, currency,
             bank_or_platform, operation_number, payment_date,
             image_filename, gemini_analysis, status, rejection_reason,
             validated_by, created_at::text, updated_at::text
      FROM public.payment_vouchers
      WHERE ${conditions.join(' AND ')}
      ORDER BY id DESC
      LIMIT $${idx};
    `, params);
  }

  public async getVoucherById(id: number | string): Promise<PaymentVoucher | null> {
    const rows = await this.query(`
      SELECT id, voucher_code, student_phone, student_name, bill_id,
             amount_detected::float, amount_approved::float, currency,
             bank_or_platform, operation_number, payment_date,
             image_filename, gemini_analysis, status, rejection_reason,
             validated_by, created_at::text, updated_at::text
      FROM public.payment_vouchers
      WHERE id = $1;
    `, [id]);
    return rows[0] || null;
  }

  /**
   * Applies an AI-validated voucher to the student's pending bill(s).
   * Automatically updates balances, marks bills as paid/partial,
   * stores the voucher in DB, and emits real-time events.
   */
  public async applyVoucherPayment(params: {
    studentPhone: string;
    studentName?: string;
    amountDetected: number;
    currency?: string;
    bankOrPlatform?: string;
    operationNumber?: string;
    paymentDate?: string;
    imageFilename?: string;
    geminiAnalysisRaw?: any;
    validatedBy?: 'gemini_ai' | 'admin';
  }): Promise<{
    success: boolean;
    voucher: PaymentVoucher;
    bill: StudentBill | null;
    message: string;
  }> {
    const cleanPhone = params.studentPhone.replace(/[^0-9]/g, '');
    const voucherCode = `VOUCH-${Math.floor(1000 + Math.random() * 9000)}`;
    const amount = Number(params.amountDetected) || 0;
    const currency = params.currency || 'USD';

    // 1. Find oldest pending or partial bill for this student
    const pendingBills = await this.getPendingBillsForPhone(cleanPhone);
    let targetBill: StudentBill | null = pendingBills[0] || null;
    let newBillStatus: string = 'paid';
    let newAmountPaid = amount;
    let newBalancePending = 0;

    if (targetBill) {
      newAmountPaid = Number(targetBill.amount_paid) + amount;
      if (newAmountPaid >= Number(targetBill.amount)) {
        newBillStatus = 'paid';
        newBalancePending = 0;
      } else {
        newBillStatus = 'partial';
        newBalancePending = Number(targetBill.amount) - newAmountPaid;
      }

      // Update bill in database
      const updatedBills = await this.query(`
        UPDATE public.student_bills
        SET amount_paid = $1,
            balance_pending = $2,
            status = $3,
            paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END,
            updated_at = NOW()
        WHERE id = $4
        RETURNING id, bill_code, student_phone, student_name, plan_id, concept,
                  amount::float, amount_paid::float, balance_pending::float,
                  currency, due_date::text, status, notes, reminder_sent,
                  reminder_sent_at::text, paid_at::text, created_at::text, updated_at::text;
      `, [newAmountPaid, newBalancePending, newBillStatus, targetBill.id]);

      targetBill = updatedBills[0];
    }

    // 2. Insert voucher record
    const studentName = params.studentName || targetBill?.student_name || `Alumno ${cleanPhone.slice(-4)}`;
    const voucherRows = await this.query(`
      INSERT INTO public.payment_vouchers (
        voucher_code, student_phone, student_name, bill_id,
        amount_detected, amount_approved, currency, bank_or_platform,
        operation_number, payment_date, image_filename, gemini_analysis,
        status, validated_by
      )
      VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, 'validated', $12)
      RETURNING id, voucher_code, student_phone, student_name, bill_id,
                amount_detected::float, amount_approved::float, currency,
                bank_or_platform, operation_number, payment_date,
                image_filename, gemini_analysis, status, rejection_reason,
                validated_by, created_at::text, updated_at::text;
    `, [
      voucherCode,
      cleanPhone,
      studentName,
      targetBill?.id || null,
      amount,
      currency,
      params.bankOrPlatform || 'Transferencia',
      params.operationNumber || '',
      params.paymentDate || new Date().toISOString().split('T')[0],
      params.imageFilename || '',
      JSON.stringify(params.geminiAnalysisRaw || {}),
      params.validatedBy || 'gemini_ai',
    ]);

    const createdVoucher = voucherRows[0];

    eventBus.log(
      'success',
      'system',
      `Pago Validado por IA: ${voucherCode} de ${studentName} por $${amount} (${params.bankOrPlatform})`
    );

    return {
      success: true,
      voucher: createdVoucher,
      bill: targetBill,
      message: `Comprobante ${voucherCode} validado exitosamente por $${amount}.`,
    };
  }

  public async updateVoucherStatus(
    id: number | string,
    status: 'validated' | 'rejected',
    rejectionReason?: string
  ): Promise<PaymentVoucher> {
    const rows = await this.query(`
      UPDATE public.payment_vouchers
      SET status = $1,
          rejection_reason = COALESCE($2, rejection_reason),
          validated_by = 'admin',
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, voucher_code, student_phone, student_name, bill_id,
                amount_detected::float, amount_approved::float, currency,
                bank_or_platform, operation_number, payment_date,
                image_filename, gemini_analysis, status, rejection_reason,
                validated_by, created_at::text, updated_at::text;
    `, [status, rejectionReason || null, id]);
    return rows[0];
  }

  // ============================================================================
  // 4. REPORTES FINANCIEROS Y ANALÍTICA DE NEGOCIO
  // ============================================================================

  public async getFinancialStats(): Promise<FinancialStats> {
    // 1. Total recaudado en el mes actual (de cuotas pagadas o vouchers validados)
    const collectedRes = await this.query(`
      SELECT COALESCE(SUM(amount_approved), 0)::float AS total_collected
      FROM public.payment_vouchers
      WHERE status = 'validated'
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
    `);
    const totalCollectedMonth = collectedRes[0]?.total_collected || 0;

    // 2. Saldo pendiente total por cobrar
    const pendingRes = await this.query(`
      SELECT COALESCE(SUM(balance_pending), 0)::float AS total_pending
      FROM public.student_bills
      WHERE status IN ('pending', 'partial', 'overdue');
    `);
    const totalPendingAmount = pendingRes[0]?.total_pending || 0;

    // 3. Alumnos activos
    const studentsRes = await this.query(`
      SELECT COUNT(*)::int AS count FROM public.students WHERE status = 'active';
    `);
    const activeStudents = studentsRes[0]?.count || 0;

    // 4. Cuotas vencidas
    const overdueRes = await this.query(`
      SELECT COUNT(*)::int AS count
      FROM public.student_bills
      WHERE status IN ('pending', 'partial', 'overdue') AND due_date < CURRENT_DATE;
    `);
    const overdueBillsCount = overdueRes[0]?.count || 0;

    // 5. Vouchers validados hoy por IA
    const vouchersTodayRes = await this.query(`
      SELECT COUNT(*)::int AS count
      FROM public.payment_vouchers
      WHERE created_at >= CURRENT_DATE;
    `);
    const vouchersValidatedToday = vouchersTodayRes[0]?.count || 0;

    // 6. Tasa de cobranza
    const totalBilled = totalCollectedMonth + totalPendingAmount;
    const collectionRatePct = totalBilled > 0 ? Math.round((totalCollectedMonth / totalBilled) * 100) : 100;

    return {
      totalCollectedMonth,
      totalPendingAmount,
      activeStudents,
      overdueBillsCount,
      vouchersValidatedToday,
      collectionRatePct,
    };
  }

  public async getDebtors(): Promise<DebtorSummary[]> {
    return await this.query(`
      SELECT student_phone,
             student_name,
             SUM(balance_pending)::float AS total_debt,
             COUNT(id)::int AS bills_count,
             MIN(due_date)::text AS oldest_due_date,
             STRING_AGG(concept, ' | ') AS concepts
      FROM public.student_bills
      WHERE status IN ('pending', 'partial', 'overdue') AND balance_pending > 0
      GROUP BY student_phone, student_name
      ORDER BY total_debt DESC;
    `);
  }

  public async getUpcomingBillsForReminders(daysAhead: number = 3): Promise<StudentBill[]> {
    return await this.query(`
      SELECT id, bill_code, student_phone, student_name, plan_id, concept,
             amount::float, amount_paid::float, balance_pending::float,
             currency, due_date::text, status, notes, reminder_sent
      FROM public.student_bills
      WHERE status IN ('pending', 'partial')
        AND reminder_sent = false
        AND due_date <= (CURRENT_DATE + INTERVAL '${daysAhead} days')
        AND due_date >= CURRENT_DATE
      ORDER BY due_date ASC;
    `);
  }
}

export const financeService = new FinanceService();
