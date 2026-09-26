-- ==============================================================================
-- MIGRATION: Sistema de Citas, Horarios, Clases y Alumnos (OmniBot WhatsApp SaaS)
-- Bases de datos: PostgreSQL Oracle (whatsappbot_db) y Supabase Cloud
-- ==============================================================================

-- 1. Reglas de Horarios Comerciales y Atención
CREATE TABLE IF NOT EXISTS public.business_schedule (
    id SERIAL PRIMARY KEY,
    day_of_week INT NOT NULL UNIQUE, -- 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
    day_name VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    start_time TIME DEFAULT '09:00:00',
    end_time TIME DEFAULT '18:00:00',
    break_start TIME DEFAULT '13:00:00',
    break_end TIME DEFAULT '14:00:00',
    slot_duration_minutes INT DEFAULT 60,
    max_parallel_slots INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Catálogo de Servicios / Citas
CREATE TABLE IF NOT EXISTS public.booking_services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    duration_minutes INT DEFAULT 60,
    price NUMERIC(10,2) DEFAULT 0.00,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Citas y Reservas
CREATE TABLE IF NOT EXISTS public.appointments (
    id BIGSERIAL PRIMARY KEY,
    booking_code VARCHAR(32) NOT NULL UNIQUE,
    phone VARCHAR(64) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    service_id INT REFERENCES public.booking_services(id) ON DELETE SET NULL,
    service_name VARCHAR(128) NOT NULL DEFAULT 'Consulta General',
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(32) DEFAULT 'confirmed', -- confirmed, pending, cancelled, completed
    notes TEXT DEFAULT '',
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Catálogo de Clases y Cursos Grupales
CREATE TABLE IF NOT EXISTS public.courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    instructor VARCHAR(255) DEFAULT 'Profesor Asignado',
    schedule_days VARCHAR(128) NOT NULL DEFAULT 'Lunes y Miércoles',
    start_time TIME NOT NULL DEFAULT '19:00:00',
    end_time TIME NOT NULL DEFAULT '21:00:00',
    location_or_link TEXT DEFAULT 'Aula Principal / Sala Virtual',
    max_capacity INT DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Directorio de Alumnos
CREATE TABLE IF NOT EXISTS public.students (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT '',
    status VARCHAR(32) DEFAULT 'active', -- active, inactive
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Matrículas de Alumnos en Cursos
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE,
    student_phone VARCHAR(64) NOT NULL,
    course_id INT REFERENCES public.courses(id) ON DELETE CASCADE,
    status VARCHAR(32) DEFAULT 'active', -- active, completed, dropped
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_phone, course_id)
);

-- 7. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON public.appointments (appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON public.appointments (phone);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder ON public.appointments (appointment_date, status, reminder_sent);
CREATE INDEX IF NOT EXISTS idx_students_phone ON public.students (phone);
CREATE INDEX IF NOT EXISTS idx_enrollments_phone ON public.course_enrollments (student_phone);

-- 8. Datos Iniciales por Defecto (si no existen)
INSERT INTO public.business_schedule (day_of_week, day_name, is_active, start_time, end_time, break_start, break_end, slot_duration_minutes, max_parallel_slots)
VALUES
    (1, 'Lunes', true, '09:00:00', '18:00:00', '13:00:00', '14:00:00', 60, 1),
    (2, 'Martes', true, '09:00:00', '18:00:00', '13:00:00', '14:00:00', 60, 1),
    (3, 'Miércoles', true, '09:00:00', '18:00:00', '13:00:00', '14:00:00', 60, 1),
    (4, 'Jueves', true, '09:00:00', '18:00:00', '13:00:00', '14:00:00', 60, 1),
    (5, 'Viernes', true, '09:00:00', '18:00:00', '13:00:00', '14:00:00', 60, 1),
    (6, 'Sábado', true, '09:00:00', '14:00:00', NULL, NULL, 60, 1),
    (0, 'Domingo', false, '09:00:00', '13:00:00', NULL, NULL, 60, 1)
ON CONFLICT (day_of_week) DO NOTHING;

INSERT INTO public.booking_services (name, duration_minutes, price, description, is_active)
VALUES
    ('Asesoría Especializada', 60, 50.00, 'Sesión individual de asesoría personalizada.', true),
    ('Consulta General', 30, 25.00, 'Evaluación y diagnóstico inicial rápido.', true),
    ('Clase Personalizada 1 a 1', 60, 40.00, 'Tutoría y clase privada personalizada.', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.courses (code, title, description, instructor, schedule_days, start_time, end_time, location_or_link, max_capacity, is_active)
VALUES
    ('CUR-AI-01', 'Desarrollo de Chatbots con IA Gemini y Baileys', 'Aprende a construir bots inteligentes para WhatsApp.', 'Ing. David', 'Lunes y Miércoles', '19:00:00', '21:00:00', 'Enlace Google Meet', 25, true),
    ('CUR-FULL-02', 'FullStack Cloud con PostgreSQL y Oracle Cloud', 'Despliegues en producción, Coolify y alta disponibilidad.', 'Ing. David', 'Martes y Jueves', '19:00:00', '21:00:00', 'Laboratorio Virtual 2', 30, true),
    ('CUR-DATA-03', 'Bases de Datos Modernas: Supabase & Vector Stores', 'Gestión de datos en tiempo real y memoria conversacional.', 'Ing. David', 'Sábados', '10:00:00', '13:00:00', 'Aula Virtual 1', 20, true)
ON CONFLICT (code) DO NOTHING;

-- 9. Habilitar RLS en Supabase
ALTER TABLE public.business_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Business Schedule
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_schedule' AND policyname = 'schedule_all_service_role') THEN
        CREATE POLICY schedule_all_service_role ON public.business_schedule FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY schedule_all_anon ON public.business_schedule FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    -- Booking Services
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_services' AND policyname = 'services_all_service_role') THEN
        CREATE POLICY services_all_service_role ON public.booking_services FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY services_all_anon ON public.booking_services FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    -- Appointments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'appointments_all_service_role') THEN
        CREATE POLICY appointments_all_service_role ON public.appointments FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY appointments_all_anon ON public.appointments FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    -- Courses
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'courses' AND policyname = 'courses_all_service_role') THEN
        CREATE POLICY courses_all_service_role ON public.courses FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY courses_all_anon ON public.courses FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    -- Students
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'students_all_service_role') THEN
        CREATE POLICY students_all_service_role ON public.students FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY students_all_anon ON public.students FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    -- Course Enrollments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'course_enrollments' AND policyname = 'enrollments_all_service_role') THEN
        CREATE POLICY enrollments_all_service_role ON public.course_enrollments FOR ALL TO service_role USING (true) WITH CHECK (true);
        CREATE POLICY enrollments_all_anon ON public.course_enrollments FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;
