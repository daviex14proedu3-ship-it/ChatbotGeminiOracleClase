import { Router, Request, Response } from 'express';
import { bookingService } from '../storage/bookingService.js';
import { reminderService } from '../services/reminderService.js';

export const bookingRouter = Router();

// ============================================================================
// MÉTRICAS GLOBALES
// ============================================================================
bookingRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await bookingService.getDashboardStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener métricas de agenda' });
  }
});

// ============================================================================
// CITAS Y RESERVAS
// ============================================================================
bookingRouter.get('/appointments', async (req: Request, res: Response) => {
  try {
    const { date, status, search, limit } = req.query;
    const appointments = await bookingService.getAppointmentsList({
      date: date ? String(date) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(appointments);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al listar citas' });
  }
});

bookingRouter.post('/appointments', async (req: Request, res: Response) => {
  try {
    const { phone, clientName, date, time, serviceName, serviceId, notes } = req.body;
    if (!phone || !date || !time) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (teléfono, fecha, hora)' });
    }

    const created = await bookingService.bookAppointment({
      phone,
      clientName,
      date,
      time,
      serviceName,
      serviceId,
      notes,
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Error al agendar cita' });
  }
});

bookingRouter.patch('/appointments/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!['confirmed', 'pending', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const updated = await bookingService.updateAppointmentStatus(id, status);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar estado de cita' });
  }
});

bookingRouter.post('/appointments/:id/reminder', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await reminderService.sendManualReminder(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al enviar recordatorio manual' });
  }
});

bookingRouter.post('/slots', async (req: Request, res: Response) => {
  try {
    const { date, serviceId } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'La fecha es requerida (YYYY-MM-DD)' });
    }
    const slots = await bookingService.getAvailableSlots(date, serviceId);
    res.json(slots);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Error al calcular horarios disponibles' });
  }
});

// ============================================================================
// HORARIOS & REGLAS DE ATENCIÓN
// ============================================================================
bookingRouter.get('/schedule', async (req: Request, res: Response) => {
  try {
    const rules = await bookingService.getScheduleRules();
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener horarios' });
  }
});

bookingRouter.put('/schedule/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await bookingService.updateScheduleRule(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar horario de atención' });
  }
});

// ============================================================================
// SERVICIOS
// ============================================================================
bookingRouter.get('/services', async (req: Request, res: Response) => {
  try {
    const services = await bookingService.getAllServices();
    res.json(services);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener servicios' });
  }
});

bookingRouter.post('/services', async (req: Request, res: Response) => {
  try {
    const created = await bookingService.createService(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al crear servicio' });
  }
});

bookingRouter.put('/services/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await bookingService.updateService(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar servicio' });
  }
});

bookingRouter.delete('/services/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await bookingService.deleteService(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al eliminar servicio' });
  }
});

// ============================================================================
// CLASES Y CURSOS
// ============================================================================
bookingRouter.get('/courses', async (req: Request, res: Response) => {
  try {
    const courses = await bookingService.getCourses();
    res.json(courses);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener cursos' });
  }
});

bookingRouter.post('/courses', async (req: Request, res: Response) => {
  try {
    const created = await bookingService.createCourse(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al crear curso' });
  }
});

bookingRouter.put('/courses/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await bookingService.updateCourse(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al actualizar curso' });
  }
});

bookingRouter.delete('/courses/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await bookingService.deleteCourse(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al eliminar curso' });
  }
});

// ============================================================================
// ALUMNOS Y MATRÍCULAS
// ============================================================================
bookingRouter.get('/students', async (req: Request, res: Response) => {
  try {
    const students = await bookingService.getStudents();
    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al obtener alumnos' });
  }
});

bookingRouter.post('/students', async (req: Request, res: Response) => {
  try {
    const student = await bookingService.createOrUpdateStudent(req.body);
    res.status(201).json(student);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al registrar alumno' });
  }
});

bookingRouter.post('/students/:phone/enroll', async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const { courseId, studentName } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId es obligatorio' });
    }
    await bookingService.enrollStudent(phone, Number(courseId), studentName);
    res.json({ success: true, message: 'Alumno matriculado exitosamente' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al matricular alumno' });
  }
});

bookingRouter.delete('/students/:phone/courses/:courseId', async (req: Request, res: Response) => {
  try {
    const { phone, courseId } = req.params;
    await bookingService.unenrollStudent(phone, Number(courseId));
    res.json({ success: true, message: 'Matrícula desvinculada exitosamente' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al desmatricular alumno' });
  }
});
