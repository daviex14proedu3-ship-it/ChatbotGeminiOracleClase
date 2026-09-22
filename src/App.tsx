import React, { useState, useEffect, useCallback } from 'react';
import { DesktopSidebar, NavTab } from './components/layout/DesktopSidebar';
import { MobileNavbar } from './components/layout/MobileNavbar';
import { Header } from './components/layout/Header';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { GroupList } from './components/groups/GroupList';
import { DirectAndBulkMessaging } from './components/messaging/DirectAndBulkMessaging';
import { AiSettingsView } from './components/ai/AiSettingsView';
import { MediaCatalogView } from './components/media/MediaCatalogView';
import { ChatSimulator } from './components/simulator/ChatSimulator';
import { LiveLogsView } from './components/logs/LiveLogsView';
import { WhatsAppStatus, AppSettings } from './types';
import { api } from './services/api';
import { socket } from './services/socket';
import { useToast } from './context/ToastContext';

export const App: React.FC = () => {
  const toast = useToast();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [status, setStatus] = useState<WhatsAppStatus>({
    state: 'disconnected',
    botPhone: null,
    qrDataUrl: null,
    qrString: null,
  });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [groupsCount, setGroupsCount] = useState<number>(0);
  const [kbCount, setKbCount] = useState<number>(0);
  const [mediaCount, setMediaCount] = useState<number>(0);

  // Fetch initial WhatsApp status and settings
  const loadInitialData = useCallback(async () => {
    try {
      const [waStatus, aiSettings, kb, media] = await Promise.allSettled([
        api.getWhatsAppStatus(),
        api.getAiSettings(),
        api.getKnowledgeBase(),
        api.getMediaCatalog(),
      ]);

      if (waStatus.status === 'fulfilled') setStatus(waStatus.value);
      if (aiSettings.status === 'fulfilled') setSettings(aiSettings.value);
      if (kb.status === 'fulfilled') setKbCount(kb.value.filter((i) => i.isActive).length);
      if (media.status === 'fulfilled') setMediaCount(media.value.length);
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Listen to real-time WebSocket events
    const unsubStatus = socket.on('whatsapp_status', (newStatus: WhatsAppStatus) => {
      setStatus(newStatus);
    });

    const unsubQr = socket.on('whatsapp_qr', (qrData: { qr: string; qrDataUrl: string }) => {
      setStatus((prev) => ({
        ...prev,
        state: 'waiting_qr',
        qrDataUrl: qrData.qrDataUrl,
        qrString: qrData.qr,
      }));
    });

    return () => {
      unsubStatus();
      unsubQr();
    };
  }, [loadInitialData]);

  // Handle bot auto-responder toggle
  const handleToggleBot = async () => {
    if (!settings) return;
    const newEnabled = !settings.botEnabled;
    try {
      const updated = await api.saveAiSettings({ botEnabled: newEnabled });
      setSettings(updated);
      toast.info(newEnabled ? 'Bot auto-respondedor ACTIVADO' : 'Bot auto-respondedor EN PAUSA');
    } catch (err) {
      toast.error('Error al cambiar estado del bot');
    }
  };

  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Panel General & Estado de WhatsApp',
      subtitle: 'Monitorea la conexión, escanea el código QR y accede a los módulos principales.',
    },
    groups: {
      title: 'Extracción & Envío a Grupos de WhatsApp',
      subtitle: 'Filtra grupos donde puedes escribir o eres admin, y envía mensajes masivos.',
    },
    messaging: {
      title: 'Envíos Masivos & Directos',
      subtitle: 'Detección inteligente de columnas en Excel y portapapeles con optimización WebP.',
    },
    ai_settings: {
      title: 'Inteligencia Artificial & Base de Conocimientos',
      subtitle: 'Pool de claves de Google AI Studio con failover automático y documentos de soporte.',
    },
    media_catalog: {
      title: 'Catálogo de Medios & Optimizador WebP',
      subtitle: 'Conversión ultraligera en navegador e imágenes disponibles para despacho de la IA.',
    },
    simulator: {
      title: 'Simulador de Chat en Vivo',
      subtitle: 'Prueba la interacción con Gemini, el uso de la base de conocimientos y el envío de fotos.',
    },
    logs: {
      title: 'Consola de Actividad & Failover Logs',
      subtitle: 'Supervisa en tiempo real las respuestas de la IA, rotaciones de claves y mensajes enviados.',
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* Desktop Fixed Sidebar (h-screen full height) */}
      <DesktopSidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        status={status}
        onReconnect={() => {
          api.reconnectWhatsApp().catch(console.error);
          toast.info('Solicitando reconexión a WhatsApp...');
        }}
      />

      {/* Main Content Area (occupies full viewport width in desktop with ml-72) */}
      <div className="flex-1 md:ml-72 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Sticky Header */}
        <Header
          title={titles[currentTab].title}
          subtitle={titles[currentTab].subtitle}
          status={status}
          settings={settings || undefined}
          onToggleBot={handleToggleBot}
        />

        {/* View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardOverview
              status={status}
              settings={settings}
              onRefresh={loadInitialData}
              onSelectTab={setCurrentTab}
              groupsCount={groupsCount}
              kbCount={kbCount}
              mediaCount={mediaCount}
            />
          )}

          {currentTab === 'groups' && <GroupList status={status} />}

          {currentTab === 'messaging' && <DirectAndBulkMessaging status={status} />}

          {currentTab === 'ai_settings' && (
            <AiSettingsView
              settings={settings}
              onUpdateSettings={(newSettings) => setSettings(newSettings)}
            />
          )}

          {currentTab === 'media_catalog' && <MediaCatalogView />}

          {currentTab === 'simulator' && <ChatSimulator />}

          {currentTab === 'logs' && <LiveLogsView />}
        </main>
      </div>

      {/* Mobile Horizontal Bottom Navbar (fixed bottom-0) */}
      <MobileNavbar currentTab={currentTab} onSelectTab={setCurrentTab} />
    </div>
  );
};
