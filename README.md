# OmniBot WhatsApp SaaS (Monolito en 1 Solo Puerto)

Plataforma SaaS moderna construida en **TypeScript (TSX)** para automatización de WhatsApp, con **Baileys**, Inteligencia Artificial con **Google AI Studio (Gemini)** con soporte para múltiples claves y **failover automático**, extractor avanzado de grupos con filtros y selección múltiple, optimizador de imágenes a **WebP en el navegador (frontend)**, y motor de envíos masivos e individuales con **detección inteligente de columnas desde Excel o portapapeles**.

---

## 🌟 Características Destacadas

### 1. Monolito en Un Solo Puerto (`http://localhost:3000`)
- Servidor Express unificado que integra tanto la **API REST**, el canal bidireccional **WebSocket**, el motor **Baileys** y la interfaz gráfica **React + Vite**.
- Cero configuraciones de múltiples puertos ni problemas de CORS.

### 2. Cero Alertas Nativas (`No window.alert`)
- Todas las interacciones, advertencias, confirmaciones y errores se presentan a través de:
  - **Modales Modernos con desenfoque (`backdrop-blur`)**: Para confirmaciones destructivas, configuración y previsualizaciones.
  - **Sistema de Toasts Reactivos (Sonner-like)**: Alertas deslizantes con soporte para notificación instantánea cuando se activa un **failover** de IA.

### 3. Diseño Responsivo SaaS Moderno
- **Desktop (Escritorio)**:
  - Ocupa el 100% del ancho del viewport.
  - Sidebar fijo a la izquierda de altura completa (`h-screen`) con acceso rápido, estado de conexión de WhatsApp y resumen de claves.
- **Móvil (Smartphones y Tablets)**:
  - Totalmente adaptativo.
  - El sidebar colapsa y se convierte en una **barra de navegación inferior horizontal fija (`bottom-0`)** para fácil navegación táctil.

### 4. Inteligencia Artificial con Google AI Studio (Failover Multi-Key)
- **Múltiples API Keys**: Registra tantas claves de Gemini como necesites con auto-guardado en tiempo real.
- **Failover Transparente**: Si la clave activa arroja error `429 Too Many Requests` (cuota agotada) o fallo de servicio, el sistema rota automáticamente en milisegundos a la siguiente clave disponible y reintenta la solicitud sin interrumpir la experiencia del cliente.
- **Modelos Prioritarios Flash-Lite**: Prioriza **Gemini 3.5 Flash-Lite** y **Gemini 3.1 Flash-Lite** para operación ultrarrápida, alta concurrencia y cero costo de tokens.
- **Carga Dinámica de Modelos**: Consulta en vivo el catálogo de modelos disponibles en Google AI Studio (`GET /api/ai/models`).
- **Base de Conocimientos (Knowledge Base)**: Administrador CRUD de artículos, preguntas frecuentes (FAQ) y políticas de empresa inyectadas en el prompt del sistema.
- **Despacho Automático de Imágenes**: Si el cliente solicita fotos o catálogos y existen en el servidor, la IA detecta la intención y despacha el archivo multimedia correspondiente.

### 5. Extractor y Gestor Avanzado de Grupos
- Extracción de grupos en tiempo real vía Baileys.
- **Filtros inteligentes**:
  - ¿Puedo enviar mensajes? (Grupos abiertos vs restringidos solo a administradores).
  - ¿Soy Administrador? (Grupos donde el bot tiene permisos de administración).
  - Ordenamiento: Alfabético (A-Z / Z-A) o por Cantidad de Participantes (Mayor / Menor).
  - Buscador en vivo por nombre.
- **Selección múltiple**:
  - Checkboxes individuales, "Seleccionar visibles", "Invertir selección", "Deseleccionar todos".
  - Envío masivo con mensaje personalizado, adjunto WebP y retardo configurable anti-baneo.

### 6. Optimizador de Imágenes a WebP en el Frontend
- **Conversión en el cliente antes de la subida**: Utiliza Canvas API del navegador para transformar imágenes JPG, PNG o HEIC a formato **WebP ultraligero**.
- Reduce el peso hasta en un **90%** antes de transmitir el archivo al servidor o a WhatsApp, ahorrando ancho de banda y acelerando la entrega.
- Muestra métricas de tamaño original vs tamaño WebP y porcentaje de ahorro.

### 7. Envíos Masivos e Individuales con Detección Inteligente de Excel
- **Pegar directo desde Excel/Google Sheets**: Copia celdas y pégalas directamente (formato tabular TSV/CSV).
- **Subida de archivos Excel**: Soporte nativo para `.xlsx`, `.xls` y `.csv`.
- **Algoritmo de Detección Inteligente**:
  - Analiza nombres de encabezados y formatos de celdas para identificar automáticamente qué columna corresponde al Teléfono, Nombre o Variables personalizadas.
  - Selector interactivo para reasignar o ignorar columnas.
- **Plantilla con Variables Dinámicas**:
  - Inserta tags como `{{Nombre}}`, `{{Variable_1}}`.
  - Vista previa en tiempo real con selector de fila (Contacto 1, 2, 3...).
- **Protección Anti-Baneo**:
  - Intervalos con retardo aleatorio (jitter) entre mensajes.
  - Monitor de progreso en tiempo real con estadísticas y botón de pausar/cancelar.

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+ (o Node.js LTS 24+)
- pnpm

### Ejecución en Desarrollo (Monolito en 1 solo comando)
```bash
pnpm dev
```
Abre tu navegador en:
👉 **`http://localhost:3000`**

### Compilación y Ejecución en Producción
```bash
pnpm build
pnpm start
```
