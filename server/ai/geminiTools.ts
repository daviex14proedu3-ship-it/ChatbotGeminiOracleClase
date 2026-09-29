import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { bookingService } from '../storage/bookingService.js';
import { financeService } from '../storage/financeService.js';
import { eventBus } from '../utils/logger.js';

export const bookingFunctionDeclarations: FunctionDeclaration[] = [
  // ============================================================================
  // CITAS, HORARIOS Y CALENDARIOS
  // ============================================================================
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

  // ============================================================================
  // CLASES Y CURSOS
  // ============================================================================
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

  // ============================================================================
  // PAGOS, MENSUALIDADES Y ESTADOS DE CUENTA
  // ============================================================================
  {
    name: 'consultar_estado_cuenta',
    description: 'Consulta el estado de cuenta financiero del alumno o cliente: mensualidades pendientes, saldo por pagar, fecha de vencimiento y cuotas al día. Úsala cuando pregunte "¿Cuánto debo?", "¿Tengo pagos pendientes?", "¿Cuándo vence mi cuota?", "¿Cuál es mi saldo actual?".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_planes_y_tarifas',
    description: 'Consulta los planes mensuales, cuotas, membresías y costos de los cursos disponibles para brindar información de precios a clientes.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },

  // ============================================================================
  // ANALÍTICA EJECUTIVA & MÉTRICAS DEL NEGOCIO
  // ============================================================================
  {
    name: 'consultar_metricas_negocio',
    description: 'Consulta métricas y estadísticas consolidadas del negocio en tiempo real: recaudación del mes, saldo pendiente por cobrar, número de alumnos activos, cuotas vencidas y comprobantes validados hoy.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_deudores',
    description: 'Consulta la lista y resumen de alumnos con cuotas o mensualidades vencidas o pendientes de pago, con montos y conceptos.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_resumen_ejecutivo',
    description: 'Genera un informe integral del negocio combinando citas para hoy/mañana, cursos activos, alumnos inscritos y métricas de recaudación financiera.',
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
      // 1. Horarios
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

      // 2. Reserva de citas
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

      // 3. Mis citas
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

      // 4. Cancelar cita
      case 'cancelar_cita': {
        const cancelResult = await bookingService.cancelAppointment(context.phone, args.codigo_o_fecha);
        return {
          resultado: cancelResult.success ? 'CANCELADA' : 'NO_ENCONTRADA',
          codigo_cancelado: cancelResult.cancelledCode,
          mensaje: cancelResult.message,
        };
      }

      // 5. Mis clases
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

      // 6. Cursos disponibles
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

      // 7. Estado de cuenta y mensualidades del cliente
      case 'consultar_estado_cuenta': {
        const bills = await financeService.getBillsByPhone(context.phone);
        const pendingBills = bills.filter(b => b.status === 'pending' || b.status === 'partial' || b.status === 'overdue');
        const paidBills = bills.filter(b => b.status === 'paid');
        const totalPending = pendingBills.reduce((acc, b) => acc + (b.balance_pending || 0), 0);

        return {
          resultado: 'OK',
          alumno: context.contactName || `Cliente ${context.phone.slice(-4)}`,
          tiene_deuda: pendingBills.length > 0,
          saldo_pendiente_total: totalPending,
          total_cuotas_pendientes: pendingBills.length,
          cuotas_pendientes: pendingBills.map(b => ({
            codigo: b.bill_code,
            concepto: b.concept,
            monto_total: b.amount,
            abonado: b.amount_paid,
            saldo_a_pagar: b.balance_pending,
            fecha_vencimiento: b.due_date,
            estado: b.status,
          })),
          total_cuotas_pagadas: paidBills.length,
          mensaje_instruccion: pendingBills.length > 0
            ? 'Informa al usuario amablemente sobre su saldo pendiente y explícale que puede enviar su comprobante de pago por este mismo chat para validarlo al instante.'
            : 'Felicita al usuario porque se encuentra 100% al día con sus mensualidades y pagos.',
        };
      }

      // 8. Planes y tarifas
      case 'consultar_planes_y_tarifas': {
        const plans = await financeService.getPlans();
        const active = plans.filter(p => p.is_active);
        return {
          resultado: 'OK',
          planes_disponibles: active.map(p => ({
            codigo: p.code,
            nombre: p.name,
            precio: p.price,
            ciclo: p.billing_cycle === 'monthly' ? 'Mensual' : p.billing_cycle,
            descripcion: p.description,
          })),
        };
      }

      // 9. Métricas del negocio (Analítica en vivo)
      case 'consultar_metricas_negocio': {
        const stats = await financeService.getFinancialStats();
        const bookingStats = await bookingService.getDashboardStats();
        return {
          resultado: 'OK',
          recaudacion_mes_actual: stats.totalCollectedMonth,
          saldo_pendiente_por_cobrar: stats.totalPendingAmount,
          tasa_cobranza_porcentaje: stats.collectionRatePct,
          cuotas_vencidas: stats.overdueBillsCount,
          vouchers_validados_hoy: stats.vouchersValidatedToday,
          alumnos_activos: stats.activeStudents,
          citas_hoy: bookingStats.todayAppointments,
          proximas_citas: bookingStats.upcomingAppointments,
          cursos_activos: bookingStats.activeCourses,
        };
      }

      // 10. Reporte de deudores
      case 'consultar_deudores': {
        const debtors = await financeService.getDebtors();
        const totalDebt = debtors.reduce((acc, d) => acc + (d.total_debt || 0), 0);
        return {
          resultado: 'OK',
          total_alumnos_con_deuda: debtors.length,
          deuda_total_acumulada: totalDebt,
          deudores: debtors.map(d => ({
            alumno: d.student_name,
            telefono: d.student_phone,
            deuda: d.total_debt,
            cuotas_pendientes: d.bills_count,
            vencimiento_mas_antiguo: d.oldest_due_date,
            conceptos: d.concepts,
          })),
        };
      }

      // 11. Resumen ejecutivo integral
      case 'consultar_resumen_ejecutivo': {
        const finStats = await financeService.getFinancialStats();
        const debtors = await financeService.getDebtors();
        const bookingStats = await bookingService.getDashboardStats();
        const appointmentsToday = await bookingService.getAppointmentsList({
          date: new Date().toISOString().split('T')[0],
        });

        return {
          resultado: 'OK',
          finanzas: {
            recaudacion_mes: finStats.totalCollectedMonth,
            saldo_por_cobrar: finStats.totalPendingAmount,
            tasa_cobranza: `${finStats.collectionRatePct}%`,
            alumnos_con_deuda: debtors.length,
            vouchers_validados_hoy: finStats.vouchersValidatedToday,
          },
          operaciones: {
            alumnos_activos: finStats.activeStudents,
            citas_hoy: bookingStats.todayAppointments,
            citas_programadas_hoy: appointmentsToday.map(a => ({
              codigo: a.booking_code,
              cliente: a.client_name,
              servicio: a.service_name,
              horario: `${a.start_time.slice(0, 5)} - ${a.end_time.slice(0, 5)}`,
              estado: a.status,
            })),
            cursos_activos: bookingStats.activeCourses,
          },
          recomendacion_ejecutiva: debtors.length > 0
            ? `Se recomienda enviar recordatorios preventivos a los ${debtors.length} alumnos con pagos pendientes para maximizar el flujo de caja.`
            : 'El negocio opera con 100% de cumplimiento en cobranzas y agenda al día.',
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
