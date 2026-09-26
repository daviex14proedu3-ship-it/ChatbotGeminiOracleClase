import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage, GeminiKeyConfig } from '../storage/store.js';
import { eventBus } from '../utils/logger.js';
import { buildSystemInstruction } from './promptBuilder.js';
import { databaseService } from '../storage/databaseService.js';
import { bookingFunctionDeclarations, executeBookingTool } from './geminiTools.js';

interface UserConversationTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

class GeminiFailoverService {
  private userHistories = new Map<string, UserConversationTurn[]>();
  private readonly MAX_HISTORY_TURNS = 10;

  private getActiveKey(): GeminiKeyConfig | null {
    const settings = storage.getSettings();
    const keys = settings.geminiKeys || [];

    // 1. Check if activeKeyIndex has a valid non-empty key
    const activeKey = keys[settings.activeKeyIndex];
    if (activeKey && activeKey.key && activeKey.key.trim() !== '') {
      return activeKey;
    }

    // 2. Search for ANY key in the pool that is not empty
    const firstValidIndex = keys.findIndex(k => k.key && k.key.trim() !== '');
    if (firstValidIndex !== -1) {
      storage.updateSettings({ activeKeyIndex: firstValidIndex });
      return keys[firstValidIndex];
    }

    // 3. Check environment variable as fallback
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      return {
        id: 'env-key',
        key: process.env.GEMINI_API_KEY.trim(),
        name: 'Clave de Entorno (.env)',
        status: 'active',
        errorCount: 0,
      };
    }

    return null;
  }

  private rotateToNextKey(failedKeyId: string, errorMessage: string): GeminiKeyConfig | null {
    const settings = storage.getSettings();
    const keys = [...settings.geminiKeys];
    
    // Mark failed key
    const failedIndex = keys.findIndex(k => k.id === failedKeyId);
    if (failedIndex !== -1) {
      const isQuotaError = errorMessage.toLowerCase().includes('quota') || 
                           errorMessage.includes('429') || 
                           errorMessage.toLowerCase().includes('resource exhausted');
      keys[failedIndex] = {
        ...keys[failedIndex],
        status: isQuotaError ? 'exhausted' : 'invalid',
        errorCount: (keys[failedIndex].errorCount || 0) + 1,
        lastError: errorMessage,
      };
    }

    // Find next available key
    let nextIndex = -1;
    for (let i = 1; i <= keys.length; i++) {
      const candidateIndex = (settings.activeKeyIndex + i) % keys.length;
      if (keys[candidateIndex].key && keys[candidateIndex].key.trim() !== '') {
        nextIndex = candidateIndex;
        break;
      }
    }

    if (nextIndex === -1 || nextIndex === failedIndex) {
      eventBus.log('error', 'ai', `No hay más claves API de Gemini disponibles para failover`);
      storage.updateSettings({ geminiKeys: keys });
      return null;
    }

    const newActiveKey = keys[nextIndex];
    newActiveKey.status = 'active';

    storage.updateSettings({
      geminiKeys: keys,
      activeKeyIndex: nextIndex,
    });

    eventBus.log(
      'failover',
      'ai',
      `Failover activado: Clave "${keys[failedIndex]?.name || failedKeyId}" falló. Cambiando automáticamente a "${newActiveKey.name}".`,
      { error: errorMessage, previousKey: failedKeyId, newKey: newActiveKey.id }
    );

    return newActiveKey;
  }

  public async generateResponse(
    userPhone: string,
    incomingMessage: string,
    contactName?: string
  ): Promise<{ text: string; mediaIdToSend?: string }> {
    const settings = storage.getSettings();
    const totalKeys = settings.geminiKeys.length;
    let attempts = 0;

    let currentKeyConfig = this.getActiveKey();
    if (!currentKeyConfig || !currentKeyConfig.key) {
      throw new Error('No hay claves API de Google AI Studio configuradas.');
    }

    const memoryEnabled = settings.memoryEnabled !== false;
    const maxTurns = settings.memoryLimitTurns || 10;

    const systemInstruction = buildSystemInstruction();
    let currentModelName = settings.selectedModel || 'gemini-2.0-flash';
    const fallbackModels = [
      currentModelName,
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    while (attempts < Math.max(1, totalKeys)) {
      attempts++;
      try {
        const apiKey = currentKeyConfig.key.trim();
        const genAI = new GoogleGenerativeAI(apiKey);
        
        let responseText: string | null = null;
        let lastModelError: any = null;

        // Try candidate models in order if one returns 404 / not found
        for (const candidate of fallbackModels) {
          try {
            const model = genAI.getGenerativeModel({
              model: candidate,
              systemInstruction: systemInstruction,
              tools: [{ functionDeclarations: bookingFunctionDeclarations }],
            });

            // Retrieve conversation history from DB or in-memory
            let history: UserConversationTurn[] = [];
            if (memoryEnabled) {
              try {
                history = await databaseService.getConversationHistoryForGemini(userPhone, maxTurns);
              } catch (dbErr) {
                console.warn('Error reading history from databaseService, using in-memory:', dbErr);
                history = this.userHistories.get(userPhone) || [];
              }
            } else {
              history = this.userHistories.get(userPhone) || [];
            }
            
            // Start chat with history
            const chat = model.startChat({
              history: history.map(turn => ({
                role: turn.role,
                parts: turn.parts,
              })),
            });

            eventBus.log('info', 'ai', `Enviando prompt a ${candidate} con clave "${currentKeyConfig.name}"...`);
            let chatResult = await chat.sendMessage(incomingMessage);
            let response = chatResult.response;

            // Handle Function Calls (Tools) Loop
            let toolTurns = 0;
            while (toolTurns < 5) {
              const calls = response.functionCalls();
              if (!calls || calls.length === 0) {
                break;
              }
              toolTurns++;
              const functionResponses: any[] = [];
              for (const call of calls) {
                const toolOutput = await executeBookingTool(call.name, call.args, {
                  phone: userPhone,
                  contactName,
                });
                functionResponses.push({
                  functionResponse: {
                    name: call.name,
                    response: toolOutput,
                  },
                });
              }

              chatResult = await chat.sendMessage(functionResponses);
              response = chatResult.response;
            }

            responseText = response.text();
            currentModelName = candidate;
            break;
          } catch (modelErr: any) {
            lastModelError = modelErr;
            const modelErrMsg = modelErr?.message || String(modelErr);
            const isModelNotFoundError =
              modelErrMsg.includes('404') ||
              modelErrMsg.toLowerCase().includes('not found') ||
              modelErrMsg.toLowerCase().includes('unsupported');

            if (isModelNotFoundError && candidate !== fallbackModels[fallbackModels.length - 1]) {
              eventBus.log('warn', 'ai', `Modelo "${candidate}" no disponible en API. Probando modelo alternativo...`);
              continue;
            }
            throw modelErr;
          }
        }

        if (!responseText) {
          throw lastModelError || new Error('No se pudo generar respuesta del modelo');
        }

        // Update successful key status
        if (currentKeyConfig.status !== 'active') {
          const keys = [...settings.geminiKeys];
          const idx = keys.findIndex(k => k.id === currentKeyConfig!.id);
          if (idx !== -1) {
            keys[idx].status = 'active';
            keys[idx].lastUsed = new Date().toISOString();
            storage.updateSettings({ geminiKeys: keys });
          }
        }

        // Check if response contains [SEND_MEDIA:ID]
        let cleanedText = responseText;
        let mediaIdToSend: string | undefined;

        const mediaMatch = responseText.match(/\[SEND_MEDIA:\s*([^\]]+)\]/i);
        if (mediaMatch) {
          mediaIdToSend = mediaMatch[1].trim();
          cleanedText = responseText.replace(/\[SEND_MEDIA:\s*[^\]]+\]/gi, '').trim();
          eventBus.log('info', 'ai', `IA determinó enviar archivo multimedia ID: "${mediaIdToSend}"`);
        }

        // Save conversation history to Database and local memory cache
        if (memoryEnabled) {
          try {
            await databaseService.saveTurn(
              userPhone,
              incomingMessage,
              cleanedText,
              contactName,
              mediaIdToSend
            );
          } catch (dbErr) {
            console.warn('Error saving turn to databaseService:', dbErr);
          }
        }

        let history = this.userHistories.get(userPhone) || [];
        history.push(
          { role: 'user', parts: [{ text: incomingMessage }] },
          { role: 'model', parts: [{ text: cleanedText }] }
        );
        if (history.length > this.MAX_HISTORY_TURNS * 2) {
          history = history.slice(-this.MAX_HISTORY_TURNS * 2);
        }
        this.userHistories.set(userPhone, history);

        eventBus.log('success', 'ai', `Respuesta generada exitosamente para ${userPhone}`);
        return { text: cleanedText, mediaIdToSend };
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        eventBus.log('warn', 'ai', `Error con clave "${currentKeyConfig.name}": ${errMsg}`);

        // Try failover
        const nextKey = this.rotateToNextKey(currentKeyConfig.id, errMsg);
        if (!nextKey) {
          throw new Error(`Fallaron todas las claves API de Google AI Studio. Último error: ${errMsg}`);
        }
        currentKeyConfig = nextKey;
      }
    }

    throw new Error('Se agotaron los intentos de failover con todas las claves configuradas.');
  }

  public async testKey(key: string, modelName = 'gemini-2.0-flash'): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const genAI = new GoogleGenerativeAI(key.trim());
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Responde únicamente con la palabra: OK');
      const text = result.response.text();
      const latencyMs = Date.now() - start;
      return {
        success: text.toLowerCase().includes('ok'),
        message: 'Clave válida. Respuesta recibida.',
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error desconocido al validar clave',
        latencyMs: Date.now() - start,
      };
    }
  }

  public async listDynamicModels(customKey?: string): Promise<{
    id: string;
    name: string;
    displayName: string;
    description: string;
    isFlashLite: boolean;
    recommended: boolean;
  }[]> {
    const settings = storage.getSettings();
    const activeKey = this.getActiveKey();
    const apiKey = (customKey || activeKey?.key || '').trim();

    // Modelos base prioritarios con Flash-Lite como preferidos
    const defaultCurated = [
      {
        id: 'gemini-3.5-flash-lite',
        name: 'models/gemini-3.5-flash-lite',
        displayName: 'Gemini 3.5 Flash-Lite (Gratuito / Ultrarrápido)',
        description: 'Modelo insignia actual de Google AI Studio para alto volumen, mínima latencia y cero consumo de saldo.',
        isFlashLite: true,
        recommended: true,
      },
      {
        id: 'gemini-3.1-flash-lite',
        name: 'models/gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash-Lite (Alta Eficiencia)',
        description: 'Optimizado para respuestas ultraligeras y alto rendimiento en mensajería de WhatsApp.',
        isFlashLite: true,
        recommended: true,
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'models/gemini-2.5-flash-lite',
        displayName: 'Gemini 2.5 Flash-Lite',
        description: 'Versión ligera previa para tareas rápidas y económicas de atención.',
        isFlashLite: true,
        recommended: false,
      },
      {
        id: 'gemini-2.0-flash',
        name: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        description: 'Modelo multimodal estándar equilibrado.',
        isFlashLite: false,
        recommended: false,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'models/gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        description: 'Modelo clásico con ventana de contexto de 1 millón de tokens.',
        isFlashLite: false,
        recommended: false,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'models/gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        description: 'Mayor razonamiento y análisis complejo (mayor consumo de tokens).',
        isFlashLite: false,
        recommended: false,
      },
    ];

    if (!apiKey) {
      return defaultCurated;
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) {
        return defaultCurated;
      }

      const data = (await res.json()) as any;
      if (data && data.models && Array.isArray(data.models)) {
        const fetched: typeof defaultCurated = [];
        const seenIds = new Set<string>();

        for (const m of data.models) {
          if (!m.supportedGenerationMethods || !m.supportedGenerationMethods.includes('generateContent')) {
            continue;
          }

          const modelId = m.name.replace(/^models\//, '');
          if (
            modelId.includes('embedding') ||
            modelId.includes('aqa') ||
            modelId.includes('imagen') ||
            modelId.includes('tts')
          ) {
            continue;
          }

          const isFlashLite =
            modelId.toLowerCase().includes('flash-lite') ||
            modelId.toLowerCase().includes('flash_lite');

          const isRecommended =
            modelId.includes('3.5-flash-lite') ||
            modelId.includes('3.1-flash-lite');

          seenIds.add(modelId);
          fetched.push({
            id: modelId,
            name: m.name,
            displayName: m.displayName ? `${m.displayName} ${isFlashLite ? '⚡ (Flash-Lite)' : ''}` : modelId,
            description: m.description || (isFlashLite ? 'Modelo optimizado de bajo consumo y alta velocidad.' : ''),
            isFlashLite,
            recommended: isRecommended,
          });
        }

        // Add 3.5 & 3.1 curated if not already present from endpoint
        for (const cur of defaultCurated) {
          if (!seenIds.has(cur.id)) {
            fetched.push(cur);
          }
        }

        // Sort: Flash-Lite first, then recommended, then name
        fetched.sort((a, b) => {
          if (a.isFlashLite && !b.isFlashLite) return -1;
          if (!a.isFlashLite && b.isFlashLite) return 1;
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          return a.id.localeCompare(b.id);
        });

        return fetched;
      }
    } catch (err) {
      eventBus.log('warn', 'ai', `No se pudieron cargar modelos dinámicos en vivo: ${err}`);
    }

    return defaultCurated;
  }

  public async clearUserHistory(userPhone: string): Promise<void> {
    this.userHistories.delete(userPhone);
    try {
      await databaseService.clearConversationMemory(userPhone);
    } catch (e) {
      console.warn('Error clearing history in databaseService:', e);
    }
  }
}

export const geminiService = new GeminiFailoverService();
