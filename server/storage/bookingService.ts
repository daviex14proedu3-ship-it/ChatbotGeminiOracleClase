import { databaseService } from './databaseService.js';
import { eventBus } from '../utils/logger.js';

export interface ScheduleRule {
  id: number;
  day_of_week: number;
  day_name: string;
  is_active: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
  max_parallel_slots: number;
}

export interface BookingServiceItem {
  id: number;
  name: string;
  duration_minutes: number;
  price: number;
  description: string;
  is_active: boolean;
}

export interface Appointment {
  id: number;
  booking_code: string;
  phone: string;
  client_name: string;
  service_id: number | null;
  service_name: string;
  appointment_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  notes: string;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  description: string;
  instructor: string;
  schedule_days: string;
  start_time: string;
  end_time: string;
  location_or_link: string;
  max_capacity: number;
  enrolled_count?: number;
  is_active: boolean;
  created_at?: string;
}

export interface Student {
  id: number;
  phone: string;
  full_name: string;
  email: string;
  status: 'active' | 'inactive';
  notes: string;
  created_at?: string;
  courses?: Course[];
}

class BookingService {
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
        console.warn('BookingService: Primary query failed, attempting Supabase fallback:', err?.message || err);
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
        console.warn('BookingService: Supabase pool query failed:', err?.message || err);
      }
    }

    throw lastError || new Error('No hay bases de datos disponibles para ejecutar la consulta.');
  }

  // ============================================================================
  // 1. REGLAS DE HORARIOS & DISPONIBILIDAD
  // ============================================================================

  public async getScheduleRules(): Promise<ScheduleRule[]> {
    const rows = await this.query(`
      SELECT id, day_of_week, day_name, is_active, 
             start_time::text, end_time::text, 
             break_start::text, break_end::text, 
             slot_duration_minutes, max_parallel_slots
      FROM public.business_schedule
      ORDER BY CASE WHEN day_of_week = 0 THEN 7 ELSE day_of_week END ASC;
    `);
    return rows;
  }

  public async updateScheduleRule(id: number, data: Partial<ScheduleRule>): Promise<ScheduleRule> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(data.is_active);
    }
    if (data.start_time !== undefined) {
      fields.push(`start_time = $${idx++}`);
      values.push(data.start_time);
    }
    if (data.end_time !== undefined) {
      fields.push(`end_time = $${idx++}`);
      values.push(data.end_time);
    }
    if (data.break_start !== undefined) {
      fields.push(`break_start = $${idx++}`);
      values.push(data.break_start || null);
    }
    if (data.break_end !== undefined) {
      fields.push(`break_end = $${idx++}`);
      values.push(data.break_end || null);
    }
    if (data.slot_duration_minutes !== undefined) {
      fields.push(`slot_duration_minutes = $${idx++}`);
      values.push(data.slot_duration_minutes);
    }
    if (data.max_parallel_slots !== undefined) {
      fields.push(`max_parallel_slots = $${idx++}`);
      values.push(data.max_parallel_slots);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const rows = await this.query(`
      UPDATE public.business_schedule
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `, values);

    return rows[0];
  }

  // ============================================================================
  // 2. CATÁLOGO DE SERVICIOS
  // ============================================================================

  public async getServices(): Promise<BookingServiceItem[]> {
    return await this.query(`
      SELECT id, name, duration_minutes, price, description, is_active
      FROM public.booking_services
      WHERE is_active = true
      ORDER BY id ASC;
    `);
  }

  public async getAllServices(): Promise<BookingServiceItem[]> {
    return await this.query(`
      SELECT id, name, duration_minutes, price, description, is_active
      FROM public.booking_services
      ORDER BY id ASC;
    `);
  }

  public async createService(data: { name: string; duration_minutes: number; price: number; description?: string }): Promise<BookingServiceItem> {
    const rows = await this.query(`
      INSERT INTO public.booking_services (name, duration_minutes, price, description, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *;
    `, [data.name, data.duration_minutes || 60, data.price || 0, data.description || '']);
    return rows[0];
  }

  public async updateService(id: number, data: Partial<BookingServiceItem>): Promise<BookingServiceItem> {
    const rows = await this.query(`
      UPDATE public.booking_services
      SET name = COALESCE($1, name),
          duration_minutes = COALESCE($2, duration_minutes),
          price = COALESCE($3, price),
          description = COALESCE($4, description),
          is_active = COALESCE($5, is_active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *;
    `, [data.name, data.duration_minutes, data.price, data.description, data.is_active, id]);
    return rows[0];
  }

  public async deleteService(id: number): Promise<boolean> {
    await this.query(`DELETE FROM public.booking_services WHERE id = $1;`, [id]);
    return true;
  }

  // ============================================================================
  // 3. CONSULTA DINÁMICA DE HORARIOS DISPONIBLES (SLOTS)
  // ============================================================================

  /**
   * Calculates available appointment slots for a specific date (YYYY-MM-DD)
   */
  public async getAvailableSlots(dateStr: string, serviceId?: number): Promise<{
    date: string;
    dayName: string;
    isOpen: boolean;
    availableSlots: string[];
    slotDurationMinutes: number;
    reason?: string;
  }> {
    // 1. Parse date
    // Handles format "YYYY-MM-DD"
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new Error(`Formato de fecha inválido: "${dateStr}". Use YYYY-MM-DD (ej: 2026-09-26).`);
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const targetDate = new Date(year, month, day, 12, 0, 0);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check if date is in the past
    if (dateStr < todayStr) {
      return {
        date: dateStr,
        dayName: 'Pasado',
        isOpen: false,
        availableSlots: [],
        slotDurationMinutes: 60,
        reason: 'La fecha indicada ya ha transcurrido.',
      };
    }

    const dayOfWeek = targetDate.getDay(); // 0=Domingo, 1=Lunes, ...
    const scheduleRules = await this.getScheduleRules();
    const rule = scheduleRules.find(r => r.day_of_week === dayOfWeek);

    if (!rule || !rule.is_active) {
      return {
        date: dateStr,
        dayName: rule?.day_name || 'Día no laboral',
        isOpen: false,
        availableSlots: [],
        slotDurationMinutes: rule?.slot_duration_minutes || 60,
        reason: `El negocio no atiende los días ${rule?.day_name || 'seleccionados'}.`,
      };
    }

    let durationMinutes = rule.slot_duration_minutes || 60;
    if (serviceId) {
      const services = await this.getServices();
      const srv = services.find(s => s.id === serviceId);
      if (srv && srv.duration_minutes) {
        durationMinutes = srv.duration_minutes;
      }
    }

    // 2. Fetch existing appointments for date that are not cancelled
    const bookedAppointments = await this.query(`
      SELECT start_time::text, end_time::text
      FROM public.appointments
      WHERE appointment_date = $1
        AND status IN ('confirmed', 'pending')
    `, [dateStr]);

    // 3. Generate candidate slots between start_time and end_time
    const parseTimeMinutes = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const formatMinutesToTime = (totalMinutes: number): string => {
      const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
      const m = (totalMinutes % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    const startMinutes = parseTimeMinutes(rule.start_time);
    const endMinutes = parseTimeMinutes(rule.end_time);
    const breakStart = rule.break_start ? parseTimeMinutes(rule.break_start) : null;
    const breakEnd = rule.break_end ? parseTimeMinutes(rule.break_end) : null;

    const availableSlots: string[] = [];
    const maxParallel = rule.max_parallel_slots || 1;

    // Current time in minutes if target is today
    const isToday = dateStr === todayStr;
    const currentHourMinutes = now.getHours() * 60 + now.getMinutes() + 15; // 15 min margin

    for (let m = startMinutes; m + durationMinutes <= endMinutes; m += durationMinutes) {
      const slotStart = m;
      const slotEnd = m + durationMinutes;

      // Skip if slot overlaps with break time
      if (breakStart !== null && breakEnd !== null) {
        if (slotStart < breakEnd && slotEnd > breakStart) {
          continue;
        }
      }

      // If today, skip times that have already passed
      if (isToday && slotStart < currentHourMinutes) {
        continue;
      }

      const slotStartStr = formatMinutesToTime(slotStart);
      const slotEndStr = formatMinutesToTime(slotEnd);

      // Check how many appointments collide with this slot
      const collisions = bookedAppointments.filter(app => {
        const appStart = parseTimeMinutes(app.start_time);
        const appEnd = parseTimeMinutes(app.end_time);
        return slotStart < appEnd && slotEnd > appStart;
      });

      if (collisions.length < maxParallel) {
        availableSlots.push(slotStartStr);
      }
    }

    return {
      date: dateStr,
      dayName: rule.day_name,
      isOpen: true,
      availableSlots,
      slotDurationMinutes: durationMinutes,
    };
  }

  // ============================================================================
  // 4. RESERVAS AUTOMATIZADAS DE CITAS
  // ============================================================================

  public async bookAppointment(params: {
    phone: string;
    clientName: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    serviceName?: string;
    serviceId?: number;
    notes?: string;
  }): Promise<Appointment> {
    const cleanPhone = params.phone.replace(/[^0-9]/g, '');
    const cleanTime = params.time.length === 5 ? `${params.time}:00` : params.time;

    // Check availability
    const slotsInfo = await this.getAvailableSlots(params.date, params.serviceId);
    if (!slotsInfo.isOpen) {
      throw new Error(`No es posible agendar en esa fecha: ${slotsInfo.reason}`);
    }

    const timeHHMM = params.time.slice(0, 5);
    const isSlotAvailable = slotsInfo.availableSlots.some(slot => slot.slice(0, 5) === timeHHMM);
    if (!isSlotAvailable) {
      throw new Error(
        `El horario ${timeHHMM} no se encuentra disponible para la fecha ${params.date}. Horarios libres: ${slotsInfo.availableSlots.join(', ') || 'Ninguno'}.`
      );
    }

    // Calculate end time
    const [h, m] = timeHHMM.split(':').map(Number);
    const startTotal = h * 60 + m;
    const endTotal = startTotal + slotsInfo.slotDurationMinutes;
    const endHH = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const endMM = (endTotal % 60).toString().padStart(2, '0');
    const endTime = `${endHH}:${endMM}:00`;

    // Generate unique booking code: CITA-XXXX
    const bookingCode = `CITA-${Math.floor(1000 + Math.random() * 9000)}`;

    let serviceName = params.serviceName || 'Consulta General';
    let serviceId = params.serviceId || null;

    if (!params.serviceId && params.serviceName) {
      const services = await this.getServices();
      const found = services.find(s => s.name.toLowerCase().includes(params.serviceName!.toLowerCase()));
      if (found) {
        serviceId = found.id;
        serviceName = found.name;
      }
    }

    const rows = await this.query(`
      INSERT INTO public.appointments (
        booking_code, phone, client_name, service_id, service_name, 
        appointment_date, start_time, end_time, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9)
      RETURNING *;
    `, [
      bookingCode,
      cleanPhone,
      params.clientName || 'Cliente WhatsApp',
      serviceId,
      serviceName,
      params.date,
      cleanTime,
      endTime,
      params.notes || 'Reserva automática creada por IA Gemini.',
    ]);

    const created = rows[0];
    eventBus.log(
      'success',
      'system',
      `Nueva Cita Agendada: ${bookingCode} para ${params.clientName} el ${params.date} a las ${timeHHMM} (${serviceName})`
    );

    return created;
  }

  public async cancelAppointment(phone: string, bookingCodeOrDate?: string): Promise<{ success: boolean; cancelledCode?: string; message: string }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    let queryStr = `
      UPDATE public.appointments
      SET status = 'cancelled', updated_at = NOW()
      WHERE phone = $1 AND status IN ('confirmed', 'pending')
    `;
    const params: any[] = [cleanPhone];

    if (bookingCodeOrDate && bookingCodeOrDate.toUpperCase().startsWith('CITA-')) {
      queryStr += ` AND booking_code = $2 RETURNING booking_code;`;
      params.push(bookingCodeOrDate.toUpperCase());
    } else if (bookingCodeOrDate && /^\d{4}-\d{2}-\d{2}$/.test(bookingCodeOrDate)) {
      queryStr += ` AND appointment_date = $2 RETURNING booking_code;`;
      params.push(bookingCodeOrDate);
    } else {
      // Cancel closest upcoming
      queryStr += ` AND appointment_date >= CURRENT_DATE ORDER BY appointment_date ASC, start_time ASC LIMIT 1 RETURNING booking_code;`;
    }

    const rows = await this.query(queryStr, params);
    if (rows.length === 0) {
      return {
        success: false,
        message: 'No se encontró ninguna cita activa para cancelar con los datos proporcionados.',
      };
    }

    const code = rows[0].booking_code;
    eventBus.log('warn', 'system', `Cita Cancelada: ${code} por el cliente ${cleanPhone}`);
    return {
      success: true,
      cancelledCode: code,
      message: `La cita ${code} ha sido cancelada exitosamente.`,
    };
  }

  public async getAppointmentsByPhone(phone: string): Promise<Appointment[]> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return await this.query(`
      SELECT id, booking_code, phone, client_name, service_id, service_name,
             appointment_date::text, start_time::text, end_time::text,
             status, notes, reminder_sent, created_at::text, updated_at::text
      FROM public.appointments
      WHERE phone = $1
      ORDER BY appointment_date DESC, start_time DESC;
    `, [cleanPhone]);
  }

  public async getAppointmentsList(filters: {
    date?: string;
    status?: string;
    search?: string;
    limit?: number;
  }): Promise<Appointment[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (filters.date) {
      conditions.push(`appointment_date = $${idx++}`);
      params.push(filters.date);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.search) {
      conditions.push(`(client_name ILIKE $${idx} OR phone ILIKE $${idx} OR booking_code ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const limit = filters.limit || 100;
    params.push(limit);

    return await this.query(`
      SELECT id, booking_code, phone, client_name, service_id, service_name,
             appointment_date::text, start_time::text, end_time::text,
             status, notes, reminder_sent, created_at::text, updated_at::text
      FROM public.appointments
      WHERE ${conditions.join(' AND ')}
      ORDER BY appointment_date DESC, start_time ASC
      LIMIT $${idx};
    `, params);
  }

  public async getAppointmentById(id: number | string): Promise<Appointment | null> {
    const rows = await this.query(`
      SELECT id, booking_code, phone, client_name, service_id, service_name,
             appointment_date::text, start_time::text, end_time::text,
             status, notes, reminder_sent, created_at::text, updated_at::text
      FROM public.appointments
      WHERE id = $1;
    `, [id]);
    return rows[0] || null;
  }

  public async updateAppointmentStatus(id: number, status: string): Promise<Appointment> {
    const rows = await this.query(`
      UPDATE public.appointments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `, [status, id]);
    return rows[0];
  }

  // ============================================================================
  // 5. GESTIÓN DE CLASES, CURSOS Y ALUMNOS
  // ============================================================================

  public async getCourses(): Promise<Course[]> {
    return await this.query(`
      SELECT c.id, c.code, c.title, c.description, c.instructor,
             c.schedule_days, c.start_time::text, c.end_time::text,
             c.location_or_link, c.max_capacity, c.is_active,
             COUNT(e.id)::int AS enrolled_count
      FROM public.courses c
      LEFT JOIN public.course_enrollments e ON e.course_id = c.id AND e.status = 'active'
      GROUP BY c.id
      ORDER BY c.id ASC;
    `);
  }

  public async createCourse(data: Omit<Course, 'id' | 'enrolled_count'>): Promise<Course> {
    const rows = await this.query(`
      INSERT INTO public.courses (code, title, description, instructor, schedule_days, start_time, end_time, location_or_link, max_capacity, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `, [
      data.code,
      data.title,
      data.description || '',
      data.instructor || '',
      data.schedule_days,
      data.start_time,
      data.end_time,
      data.location_or_link || '',
      data.max_capacity || 30,
      data.is_active !== false,
    ]);
    return rows[0];
  }

  public async updateCourse(id: number, data: Partial<Course>): Promise<Course> {
    const rows = await this.query(`
      UPDATE public.courses
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          instructor = COALESCE($3, instructor),
          schedule_days = COALESCE($4, schedule_days),
          start_time = COALESCE($5, start_time),
          end_time = COALESCE($6, end_time),
          location_or_link = COALESCE($7, location_or_link),
          max_capacity = COALESCE($8, max_capacity),
          is_active = COALESCE($9, is_active),
          updated_at = NOW()
      WHERE id = $10
      RETURNING *;
    `, [
      data.title,
      data.description,
      data.instructor,
      data.schedule_days,
      data.start_time,
      data.end_time,
      data.location_or_link,
      data.max_capacity,
      data.is_active,
      id,
    ]);
    return rows[0];
  }

  public async deleteCourse(id: number): Promise<boolean> {
    await this.query(`DELETE FROM public.courses WHERE id = $1;`, [id]);
    return true;
  }

  public async getStudents(): Promise<Student[]> {
    const students = await this.query(`
      SELECT s.id, s.phone, s.full_name, s.email, s.status, s.notes, s.created_at::text
      FROM public.students s
      ORDER BY s.id DESC;
    `);

    // Attach courses for each student
    for (const student of students) {
      const courses = await this.query(`
        SELECT c.id, c.code, c.title, c.instructor, c.schedule_days, c.start_time::text, c.end_time::text, c.location_or_link
        FROM public.course_enrollments e
        JOIN public.courses c ON c.id = e.course_id
        WHERE e.student_phone = $1 AND e.status = 'active';
      `, [student.phone]);
      student.courses = courses;
    }

    return students;
  }

  public async createOrUpdateStudent(data: {
    phone: string;
    full_name?: string;
    fullName?: string;
    name?: string;
    email?: string;
    notes?: string;
  }): Promise<Student> {
    const cleanPhone = data.phone.replace(/[^0-9]/g, '');
    const fullName = data.full_name || data.fullName || data.name || `Alumno ${cleanPhone.slice(-4)}`;
    const rows = await this.query(`
      INSERT INTO public.students (phone, full_name, email, notes, status)
      VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT (phone) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          email = COALESCE(NULLIF(EXCLUDED.email, ''), public.students.email),
          updated_at = NOW()
      RETURNING *;
    `, [cleanPhone, fullName, data.email || '', data.notes || '']);
    return rows[0];
  }

  public async enrollStudent(phone: string, courseId: number, studentName?: string): Promise<boolean> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // Ensure student exists
    let student = (await this.query(`SELECT id FROM public.students WHERE phone = $1;`, [cleanPhone]))[0];
    if (!student) {
      student = await this.createOrUpdateStudent({
        phone: cleanPhone,
        full_name: studentName || `Alumno ${cleanPhone.slice(-4)}`,
      });
    }

    await this.query(`
      INSERT INTO public.course_enrollments (student_id, student_phone, course_id, status)
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (student_phone, course_id) DO UPDATE
      SET status = 'active', enrolled_at = NOW();
    `, [student.id, cleanPhone, courseId]);

    return true;
  }

  public async unenrollStudent(phone: string, courseId: number): Promise<boolean> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    await this.query(`
      UPDATE public.course_enrollments
      SET status = 'dropped'
      WHERE student_phone = $1 AND course_id = $2;
    `, [cleanPhone, courseId]);
    return true;
  }

  /**
   * Responds to: "¿A qué hora tengo clase?", "¿En qué cursos estoy inscrito?"
   */
  public async getStudentClasses(phone: string): Promise<{
    isEnrolled: boolean;
    studentName?: string;
    classes: Array<{
      courseCode: string;
      courseTitle: string;
      instructor: string;
      scheduleDays: string;
      startTime: string;
      endTime: string;
      location: string;
    }>;
  }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const student = (await this.query(`SELECT full_name FROM public.students WHERE phone = $1;`, [cleanPhone]))[0];

    const rows = await this.query(`
      SELECT c.code AS "courseCode", c.title AS "courseTitle", c.instructor,
             c.schedule_days AS "scheduleDays", c.start_time::text AS "startTime",
             c.end_time::text AS "endTime", c.location_or_link AS "location"
      FROM public.course_enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE e.student_phone = $1 AND e.status = 'active' AND c.is_active = true
      ORDER BY c.title ASC;
    `, [cleanPhone]);

    return {
      isEnrolled: rows.length > 0,
      studentName: student?.full_name,
      classes: rows,
    };
  }

  // ============================================================================
  // 6. RECORDATORIOS PROGRAMADOS
  // ============================================================================

  public async getPendingReminders(): Promise<Appointment[]> {
    // Find confirmed appointments for tomorrow or today within 24h that haven't received reminder
    return await this.query(`
      SELECT id, booking_code, phone, client_name, service_name,
             appointment_date::text, start_time::text, end_time::text,
             status, notes, reminder_sent
      FROM public.appointments
      WHERE status = 'confirmed'
        AND reminder_sent = false
        AND appointment_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '1 day')
      ORDER BY appointment_date ASC, start_time ASC;
    `);
  }

  public async markReminderSent(id: number): Promise<void> {
    await this.query(`
      UPDATE public.appointments
      SET reminder_sent = true, reminder_sent_at = NOW(), updated_at = NOW()
      WHERE id = $1;
    `, [id]);
  }

  // ============================================================================
  // 7. MÉTRICAS GLOBALES
  // ============================================================================

  public async getDashboardStats(): Promise<{
    todayAppointments: number;
    upcomingAppointments: number;
    activeStudents: number;
    activeCourses: number;
  }> {
    const [todayRes] = await this.query(`
      SELECT COUNT(*)::int AS count FROM public.appointments 
      WHERE appointment_date = CURRENT_DATE AND status IN ('confirmed', 'pending');
    `);
    const [upcomingRes] = await this.query(`
      SELECT COUNT(*)::int AS count FROM public.appointments 
      WHERE appointment_date > CURRENT_DATE AND status IN ('confirmed', 'pending');
    `);
    const [studentsRes] = await this.query(`
      SELECT COUNT(*)::int AS count FROM public.students WHERE status = 'active';
    `);
    const [coursesRes] = await this.query(`
      SELECT COUNT(*)::int AS count FROM public.courses WHERE is_active = true;
    `);

    return {
      todayAppointments: todayRes?.count || 0,
      upcomingAppointments: upcomingRes?.count || 0,
      activeStudents: studentsRes?.count || 0,
      activeCourses: coursesRes?.count || 0,
    };
  }
}

export const bookingService = new BookingService();
