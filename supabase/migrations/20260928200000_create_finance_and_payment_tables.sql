-- ============================================================================
-- MIGRACIÓN: Control de Mensualidades, Deudas, Comprobantes de Pago y Planes
-- Soporte dual: PostgreSQL (Oracle Cloud whatsappbot_db) y Supabase Cloud
-- ============================================================================

-- 1. Catálogo de Planes y Tarifas
CREATE TABLE IF NOT EXISTS public.plans (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  billing_cycle VARCHAR(50) NOT NULL DEFAULT 'monthly', -- monthly, biweekly, one_time, annual
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Estados de Cuenta y Mensualidades (Deudas y Cuotas de Alumnos)
CREATE TABLE IF NOT EXISTS public.student_bills (
  id SERIAL PRIMARY KEY,
  bill_code VARCHAR(50) UNIQUE NOT NULL,
  student_phone VARCHAR(50) NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  plan_id INTEGER REFERENCES public.plans(id) ON DELETE SET NULL,
  concept VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  balance_pending NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, partial, paid, overdue, cancelled
  notes TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Registro y Validación de Comprobantes de Pago (Vouchers con IA Vision)
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id SERIAL PRIMARY KEY,
  voucher_code VARCHAR(50) UNIQUE NOT NULL,
  student_phone VARCHAR(50) NOT NULL,
  student_name VARCHAR(255),
  bill_id INTEGER REFERENCES public.student_bills(id) ON DELETE SET NULL,
  amount_detected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  amount_approved NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  bank_or_platform VARCHAR(100),
  operation_number VARCHAR(100),
  payment_date VARCHAR(50),
  image_filename VARCHAR(255),
  gemini_analysis JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'validated', -- validated, pending_review, rejected
  rejection_reason TEXT,
  validated_by VARCHAR(50) NOT NULL DEFAULT 'gemini_ai', -- gemini_ai, admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Índices para acelerar búsquedas y reportes financieros
CREATE INDEX IF NOT EXISTS idx_student_bills_phone ON public.student_bills(student_phone);
CREATE INDEX IF NOT EXISTS idx_student_bills_status ON public.student_bills(status);
CREATE INDEX IF NOT EXISTS idx_student_bills_due_date ON public.student_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_phone ON public.payment_vouchers(student_phone);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_bill_id ON public.payment_vouchers(bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_op_num ON public.payment_vouchers(operation_number);

-- 5. Semilla inicial de Planes
INSERT INTO public.plans (code, name, description, price, billing_cycle, is_active)
VALUES
  ('PLAN-BOTS', 'Mensualidad Chatbots IA & Baileys', 'Acceso mensual a clases en vivo, soporte de bots y código fuente.', 50.00, 'monthly', true),
  ('PLAN-CLOUD', 'FullStack Cloud & PostgreSQL', 'Especialización en infraestructuras Oracle Cloud, Coolify y Postgres.', 75.00, 'monthly', true),
  ('PLAN-MENTOR', 'Mentoría Personalizada 1 a 1', 'Sesión intensiva privada de 60 minutos con resolución técnica.', 35.00, 'one_time', true)
ON CONFLICT (code) DO NOTHING;

-- 6. Semilla de ejemplo de Mensualidades (Carlos Mendez con saldo pendiente y Ana Garcia al día)
INSERT INTO public.student_bills (bill_code, student_phone, student_name, concept, amount, amount_paid, balance_pending, currency, due_date, status, notes)
VALUES
  ('CUOTA-2026-09-01', '51999888777', 'Carlos Mendez', 'Mensualidad Septiembre 2026 - Chatbots IA', 50.00, 0.00, 50.00, 'USD', CURRENT_DATE + INTERVAL '2 days', 'pending', 'Cuota regular del mes actual'),
  ('CUOTA-2026-09-02', '51988112233', 'Ana Garcia', 'Mensualidad Septiembre 2026 - FullStack Cloud', 75.00, 75.00, 0.00, 'USD', CURRENT_DATE - INTERVAL '5 days', 'paid', 'Abonado puntualmente vía transferencia')
ON CONFLICT (bill_code) DO NOTHING;
