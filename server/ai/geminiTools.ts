import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { bookingService } from '../storage/bookingService.js';
import { eventBus } from '../utils/logger.js';

export const bookingFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'consultar_horarios_disponibles',
    description: 'Consulta los horarios y turnos disponibles para agendar citas en una fecha determinada (formato YYYY-MM-DD). Úsala cuando el usuario pregunte "¿Qué horarios tienes mañana?", "¿Tienes espacio el viernes?", "¿A qué hora puedo ir?", etc.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fecha: {
          type: SchemaType.STRING,
          description: 'Fecha en formato YYYY-MM-DD (ej: 2026-09-26). Si el usuario dice "hoy", "mañana" o un día de la semana, calcula la fecha exacta en base a la fecha actual.',
        },
        nombre_servicio: {
          type: SchemaType.STRING,
          description: 'Nombre opcional del servicio o tipo de cita.',
        },
      },
      required: ['fecha'],
    },
  },
  {
    name: 'reservar_cita',
    description: 'Reserva y agenda una cita en el sistema para el cliente, validando disponibilidad. Devuelve el código de reserva.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fecha: {
          type: SchemaType.STRING,
          description: 'Fecha de la cita en formato YYYY-MM-DD.',
        },
        hora: {
          type: SchemaType.STRING,
          description: 'Hora de la cita en formato HH:MM (24 horas, ej: 16:00, 10:00).',
        },
        nombre_cliente: {
          type: SchemaType.STRING,
          description: 'Nombre de la persona para la cita.',
        },
        nombre_servicio: {
          type: SchemaType.STRING,
          description: 'Servicio solicitado (ej: Asesoría Especializada, Consulta General, Clase Personalizada 1 a 1).',
        },
        notas: {
          type: SchemaType.STRING,
          description: 'Detalles o requerimientos adicionales de la cita.',
        },
      },
      required: ['fecha', 'hora'],
    },
  },
  {
    name: 'consultar_mis_citas',
    description: 'Consulta las citas y reservas agendadas que tiene el cliente que escribe.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'cancelar_cita',
    description: 'Cancela una cita agendada por el cliente mediante el código de cita o la fecha.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_o_fecha: {
          type: SchemaType.STRING,
          description: 'Código de la cita (ej: CITA-1234) o fecha de la cita (YYYY-MM-DD).',
        },
      },
    },
  },
  {
    name: 'consultar_mis_clases_y_cursos',
    description: 'Consulta el horario de clases, materias, docentes y aulas/enlaces asignados al alumno que escribe según su número de teléfono.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_cursos_disponibles',
    description: 'Consulta la oferta de cursos y clases grupales activas, días de cursado, horarios y cupos disponibles.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
];

export async function executeBookingTool(
  name: string,
  args: any,
  context: { phone: string; contactName?: string }
): Promise<any> {
  eventBus.log('info', 'ai', `Ejecutando Tool de Gemini: "${name}" con parámetros: ${JSON.stringify(args)}`);

  try {
    switch (name) {
      case 'consultar_horarios_disponibles': {
        const slots = await bookingService.getAvailableSlots(args.fecha);
        return {
          resultado: 'OK',
          fecha_consultada: slots.date,
          dia_semana: slots.dayName,
          abierto: slots.isOpen,
          duracion_turno_minutos: slots.slotDurationMinutes,
          horarios_disponibles: slots.availableSlots,
          mensaje_estado: slots.isOpen
            ? (slots.availableSlots.length > 0 
                ? `Hay ${slots.availableSlots.length} horarios libres para esta fecha.` 
                : 'No quedan horarios libres disponibles para la fecha indicada.')
            : slots.reason,
        };
      }

      case 'reservar_cita': {
        const clientName = args.nombre_cliente || context.contactName || `Cliente ${context.phone.slice(-4)}`;
        const appointment = await bookingService.bookAppointment({
          phone: context.phone,
          clientName: clientName,
          date: args.fecha,
          time: args.hora,
          serviceName: args.nombre_servicio,
          notes: args.notas,
        });

        return {
          resultado: 'EXITO',
          codigo_reserva: appointment.booking_code,
          cliente: appointment.client_name,
          servicio: appointment.service_name,
          fecha: appointment.appointment_date,
          hora_inicio: appointment.start_time.slice(0, 5),
          hora_fin: appointment.end_time.slice(0, 5),
          estado: 'CONFIRMADA',
          instruccion: 'Indícale al usuario con entusiasmo que su cita está confirmada y entrégale los datos con el código de reserva.',
        };
      }

      case 'consultar_mis_citas': {
        const appointments = await bookingService.getAppointmentsByPhone(context.phone);
        const active = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
        return {
          resultado: 'OK',
          total_citas_activas: active.length,
          citas: active.map(a => ({
            codigo: a.booking_code,
            servicio: a.service_name,
            fecha: a.appointment_date,
            hora: `${a.start_time.slice(0, 5)} - ${a.end_time.slice(0, 5)}`,
            estado: a.status,
          })),
        };
      }

      case 'cancelar_cita': {
        const cancelResult = await bookingService.cancelAppointment(context.phone, args.codigo_o_fecha);
        return {
          resultado: cancelResult.success ? 'CANCELADA' : 'NO_ENCONTRADA',
          codigo_cancelado: cancelResult.cancelledCode,
          mensaje: cancelResult.message,
        };
      }

      case 'consultar_mis_clases_y_cursos': {
        const studentClasses = await bookingService.getStudentClasses(context.phone);
        if (!studentClasses.isEnrolled) {
          return {
            resultado: 'NO_MATRICULADO',
            mensaje: 'No encontramos cursos activos asociados a tu número de WhatsApp.',
            sugerencia: 'Ofrecerle los cursos disponibles consultando la lista de cursos.',
          };
        }
        return {
          resultado: 'ALUMNO_MATRICULADO',
          nombre_alumno: studentClasses.studentName,
          total_cursos: studentClasses.classes.length,
          clases: studentClasses.classes.map(c => ({
            curso: c.courseTitle,
            dias: c.scheduleDays,
            horario: `${c.startTime.slice(0, 5)} a ${c.endTime.slice(0, 5)}`,
            profesor: c.instructor,
            ubicacion_o_enlace: c.location,
          })),
        };
      }

      case 'consultar_cursos_disponibles': {
        const courses = await bookingService.getCourses();
        const active = courses.filter(c => c.is_active);
        return {
          resultado: 'OK',
          cursos_disponibles: active.map(c => ({
            codigo: c.code,
            titulo: c.title,
            descripcion: c.description,
            dias: c.schedule_days,
            horario: `${c.start_time.slice(0, 5)} - ${c.end_time.slice(0, 5)}`,
            profesor: c.instructor,
            cupo_maximo: c.max_capacity,
            cupos_disponibles: Math.max(0, c.max_capacity - (c.enrolled_count || 0)),
          })),
        };
      }

      default:
        throw new Error(`Función desconocida: ${name}`);
    }
  } catch (err: any) {
    eventBus.log('warn', 'ai', `Error ejecutando tool ${name}: ${err?.message || err}`);
    return {
      resultado: 'ERROR',
      error: err?.message || 'Error al procesar la solicitud.',
    };
  }
}
