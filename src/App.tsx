import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  BarChart3,
  CheckCircle2,
  Send,
  Trash2,
  Settings,
  Zap,
  Pizza,
  Plus,
  RefreshCw
} from 'lucide-react';
import rawModelData from './data/pizzaModelData.json';
import { CartItem, CityItem, FactVentaRow, PizzaItem, SaleChannelItem } from './types';
import {
  getExcelSerialDate,
  getFormattedExcelTime,
  syncRowsToGoogleSheets
} from './services/sheetsBridge';
import {
  GeminiLiveVoiceSession,
  AdminVoiceRecorder,
  processTextTurnWithVerifiedGemini,
  speakSpanish,
  stopSpeaking
} from './services/geminiLiveService';
import {
  askBICopilot,
  askBICopilotByAudio,
  BICopilotContext
} from './services/biCopilotService';

const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyX746NrWYxPV8bHbHiq7WEhaJ4DYlGUvXasMDPId-Rut0_kM2tDt38fvHxLwo3DTjI/exec';

export function App() {
  const pizzas = rawModelData.pizzas as PizzaItem[];
  const cities = rawModelData.cities as CityItem[];
  const channels = rawModelData.channels as SaleChannelItem[];

  const [activeTab, setActiveTab] = useState<'cashier' | 'admin'>('cashier');

  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    const env = (import.meta as any).env || {};
    return env.VITE_GEMINI_API_KEY_1 || localStorage.getItem('pizza_gemini_key') || env.VITE_GEMINI_API_KEY || '';
  });
  const [appsScriptUrl, setAppsScriptUrl] = useState<string>(() => {
    const saved = localStorage.getItem('pizza_apps_script_url');
    if (!saved || saved.includes('AKfycbx8MtmqY8p1j6pAjxIR76r3RNQd1UENVO3v4jSxachoGE37ElRO9eUxs_SxTmTQtEdwjQ')) {
      return DEFAULT_APPS_SCRIPT_URL;
    }
    return saved;
  });
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

  // Estado del Pedido
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<number>(1);
  const [selectedChannelId, setSelectedChannelId] = useState<number>(1);
  const [quickPizzaId, setQuickPizzaId] = useState<string>(pizzas[0]?.pizza_id || 'hawaiian_m');

  const [liveRows, setLiveRows] = useState<FactVentaRow[]>(() => {
    const saved = localStorage.getItem('pizza_live_rows');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [lastOrderId, setLastOrderId] = useState<number>(() => {
    const saved = localStorage.getItem('pizza_last_order_id');
    return saved ? parseInt(saved, 10) : rawModelData.summary.lastOrderId;
  });

  // Estado de Voz Cajero
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [voiceStatusDetail, setVoiceStatusDetail] = useState<string>('Toca el micrófono para iniciar la conversación');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [aiResponseText, setAiResponseText] = useState<string>(
    'Hola, bienvenido a PizzaCorp. Puedes pedirme tus pizzas, preguntarme sus ingredientes o cambiar tu pedido en cualquier momento.'
  );
  const [manualInput, setManualInput] = useState<string>('');
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [cashierHistory, setCashierHistory] = useState<Array<{ role: string; text: string }>>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Estado Tablero de Consultas Admin con IA
  const [biViewMode, setBiViewMode] = useState<'mirror' | 'skus' | 'live_table'>('mirror');
  const [biMessages, setBiMessages] = useState<Array<{ role: 'user' | 'ai'; text: string; spoken?: string }>>([
    {
      role: 'ai',
      text: 'Hola. Soy el Analista IA conectado en tiempo real a las tablas de tu modelo Excel (56,864 filas base). Puedes preguntarme por voz o texto sobre ventas por ciudad, canales, top pizzas, ingredientes o pedidos del día.',
      spoken: 'Hola. Soy el analista IA conectado a los datos de tu modelo Excel. ¿Qué deseas consultar?'
    }
  ]);
  const [biInput, setBiInput] = useState<string>('');
  const [biLoading, setBiLoading] = useState<boolean>(false);
  const [isBiMicListening, setIsBiMicListening] = useState<boolean>(false);
  const [biAudioLevel, setBiAudioLevel] = useState<number>(0);
  const [isBiSpeaking, setIsBiSpeaking] = useState<boolean>(false);
  const [syncingBatch, setSyncingBatch] = useState<boolean>(false);

  const voiceSessionRef = useRef<GeminiLiveVoiceSession | null>(null);
  const adminRecorderRef = useRef<AdminVoiceRecorder | null>(null);
  const biChatEndRef = useRef<HTMLDivElement | null>(null);

  const cartRef = useRef(cart);
  cartRef.current = cart;
  const cityRef = useRef(selectedCityId);
  cityRef.current = selectedCityId;
  const channelRef = useRef(selectedChannelId);
  channelRef.current = selectedChannelId;
  const lastOrderIdRef = useRef(lastOrderId);
  lastOrderIdRef.current = lastOrderId;

  useEffect(() => {
    localStorage.setItem('pizza_live_rows', JSON.stringify(liveRows));
  }, [liveRows]);

  useEffect(() => {
    localStorage.setItem('pizza_last_order_id', String(lastOrderId));
  }, [lastOrderId]);

  useEffect(() => {
    localStorage.setItem('pizza_gemini_key', geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    localStorage.setItem('pizza_apps_script_url', appsScriptUrl);
  }, [appsScriptUrl]);

  useEffect(() => {
    biChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [biMessages, biLoading]);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const liveAnalytics = useMemo<BICopilotContext>(() => {
    const byCity = JSON.parse(JSON.stringify(rawModelData.analytics.byCity));
    const byChannel = JSON.parse(JSON.stringify(rawModelData.analytics.byChannel));
    const byCategory = JSON.parse(JSON.stringify(rawModelData.analytics.byCategory));
    const bySize = JSON.parse(JSON.stringify(rawModelData.analytics.bySize));
    const byYear = JSON.parse(JSON.stringify((rawModelData.analytics as any).byYear || {}));
    const byMonth = JSON.parse(JSON.stringify((rawModelData.analytics as any).byMonth || {}));
    const byYearMonth = JSON.parse(JSON.stringify((rawModelData.analytics as any).byYearMonth || {}));
    const byDayOfWeek = JSON.parse(JSON.stringify((rawModelData.analytics as any).byDayOfWeek || {}));
    const topPizzas = JSON.parse(JSON.stringify(rawModelData.analytics.topPizzas));
    const bottomPizzas = JSON.parse(JSON.stringify(rawModelData.analytics.bottomPizzas));

    let liveRevenue = 0;
    let liveQty = 0;

    for (const row of liveRows) {
      liveRevenue += row.total_price;
      liveQty += row.quantity;

      if (!byCity[row.city_name]) byCity[row.city_name] = { orders: 0, qty: 0, revenue: 0 };
      byCity[row.city_name].orders += 1;
      byCity[row.city_name].qty += row.quantity;
      byCity[row.city_name].revenue = Number((byCity[row.city_name].revenue + row.total_price).toFixed(2));

      if (!byChannel[row.channel_name]) byChannel[row.channel_name] = { orders: 0, qty: 0, revenue: 0 };
      byChannel[row.channel_name].orders += 1;
      byChannel[row.channel_name].qty += row.quantity;
      byChannel[row.channel_name].revenue = Number((byChannel[row.channel_name].revenue + row.total_price).toFixed(2));

      if (!bySize[row.size]) bySize[row.size] = { qty: 0, revenue: 0 };
      bySize[row.size].qty += row.quantity;
      bySize[row.size].revenue = Number((bySize[row.size].revenue + row.total_price).toFixed(2));

      const jsDate = new Date((row.date - 25569) * 86400 * 1000);
      const yr = String(jsDate.getUTCFullYear() || 2026);
      if (!byYear[yr]) byYear[yr] = { orders: 0, qty: 0, revenue: 0 };
      byYear[yr].orders += 1;
      byYear[yr].qty += row.quantity;
      byYear[yr].revenue = Number((byYear[yr].revenue + row.total_price).toFixed(2));
    }

    return {
      totalHistoricalRows: rawModelData.summary.totalHistoricalRows,
      totalRevenue: Number((rawModelData.summary.totalRevenue + liveRevenue).toFixed(2)),
      totalQuantity: rawModelData.summary.totalQuantity + liveQty,
      liveOrdersCount: liveRows.length,
      liveRevenue: Number(liveRevenue.toFixed(2)),
      byCity,
      byChannel,
      byCategory,
      bySize,
      byYear,
      byMonth,
      byYearMonth,
      byDayOfWeek,
      topPizzas,
      bottomPizzas,
      recentLiveRows: liveRows
    };
  }, [liveRows]);

  const findPizzaByIdOrFuzzy = (pizzaId: string): PizzaItem | undefined => {
    const clean = pizzaId.toLowerCase().trim();
    return (
      pizzas.find((p) => p.pizza_id.toLowerCase() === clean) ||
      pizzas.find((p) => p.pizza_type_id.toLowerCase() === clean && p.size.toUpperCase() === 'M') ||
      pizzas.find((p) => p.pizza_id.toLowerCase().includes(clean))
    );
  };

  const handleAddPizzaById = (pizzaId: string, quantity: number = 1) => {
    const found = findPizzaByIdOrFuzzy(pizzaId);
    if (!found) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.pizza.pizza_id === found.pizza_id);
      const next = existing
        ? prev.map((item) =>
            item.pizza.pizza_id === found.pizza_id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        : [...prev, { pizza: found, quantity }];
      cartRef.current = next;
      return next;
    });
  };

  const handleRemovePizzaById = (pizzaId: string, quantity?: number) => {
    const clean = pizzaId.toLowerCase().trim();
    setCart((prev) => {
      const next = prev
        .map((item) => {
          const matches =
            item.pizza.pizza_id.toLowerCase() === clean ||
            item.pizza.pizza_type_id.toLowerCase() === clean ||
            item.pizza.pizza_id.toLowerCase().includes(clean);
          if (!matches) return item;
          if (quantity === undefined || quantity <= 0 || item.quantity <= quantity) {
            return null;
          }
          return { ...item, quantity: item.quantity - quantity };
        })
        .filter(Boolean) as CartItem[];
      cartRef.current = next;
      return next;
    });
  };

  const handleSetCartItems = (items: Array<{ pizzaId: string; quantity: number }>) => {
    const built: CartItem[] = [];
    for (const entry of items) {
      const found = findPizzaByIdOrFuzzy(entry.pizzaId);
      if (found && entry.quantity > 0) {
        const existing = built.find((b) => b.pizza.pizza_id === found.pizza_id);
        if (existing) {
          existing.quantity += entry.quantity;
        } else {
          built.push({ pizza: found, quantity: entry.quantity });
        }
      }
    }
    cartRef.current = built;
    setCart(built);
  };

  const handleConfirmOrder = async (source: 'voz_ia' | 'manual' = 'voz_ia') => {
    const currentCart = cartRef.current;
    if (currentCart.length === 0) {
      showToastMsg('Agrega al menos una pizza antes de confirmar.');
      return;
    }

    const now = new Date();
    const excelDate = getExcelSerialDate(now);
    const excelTime = getFormattedExcelTime(now);
    const cityObj = cities.find((c) => c.city_id === cityRef.current) || cities[0];
    const channelObj = channels.find((ch) => ch.salechannel_id === channelRef.current) || channels[0];

    const newOrderId = lastOrderIdRef.current + 1;
    const newRows: FactVentaRow[] = currentCart.map((item) => ({
      order_id: newOrderId,
      date: excelDate,
      time: excelTime,
      city_id: cityObj.city_id,
      city_name: cityObj.nombreCiudad,
      salechannel_id: channelObj.salechannel_id,
      channel_name: channelObj.nombreChannel,
      quantity: item.quantity,
      pizza_id: item.pizza.pizza_id,
      pizza_name: item.pizza.name,
      size: item.pizza.size,
      unit_price: item.pizza.price,
      total_price: Number((item.pizza.price * item.quantity).toFixed(2)),
      source,
      syncedToSheets: true
    }));

    setLastOrderId(newOrderId);
    setLiveRows((prev) => [...newRows, ...prev]);
    cartRef.current = [];
    setCart([]);

    const syncRes = await syncRowsToGoogleSheets(appsScriptUrl, newRows);
    if (syncRes.ok) {
      showToastMsg(`✅ Pedido #${newOrderId} enviado a Google Sheets (${syncRes.message})`);
    } else {
      showToastMsg(`Pedido #${newOrderId} registrado (${syncRes.message})`);
    }
  };

  const handleSimulateRushHour = async () => {
    setSyncingBatch(true);
    const now = new Date();
    const excelDate = getExcelSerialDate(now);
    const excelTime = getFormattedExcelTime(now);
    let nextId = lastOrderIdRef.current;

    const batch: FactVentaRow[] = [];
    for (let i = 0; i < 10; i++) {
      nextId += 1;
      const randomPizza = pizzas[Math.floor(Math.random() * pizzas.length)];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const randomChannel = channels[Math.floor(Math.random() * channels.length)];
      const qty = Math.random() > 0.7 ? 2 : 1;

      batch.push({
        order_id: nextId,
        date: excelDate,
        time: excelTime,
        city_id: randomCity.city_id,
        city_name: randomCity.nombreCiudad,
        salechannel_id: randomChannel.salechannel_id,
        channel_name: randomChannel.nombreChannel,
        quantity: qty,
        pizza_id: randomPizza.pizza_id,
        pizza_name: randomPizza.name,
        size: randomPizza.size,
        unit_price: randomPizza.price,
        total_price: Number((randomPizza.price * qty).toFixed(2)),
        source: 'simulador_ia',
        syncedToSheets: true
      });
    }

    setLastOrderId(nextId);
    setLiveRows((prev) => [...batch, ...prev]);

    const syncRes = await syncRowsToGoogleSheets(appsScriptUrl, batch);
    setSyncingBatch(false);
    if (syncRes.ok) {
      showToastMsg(`⚡ +10 ventas enviadas a Google Sheets (${syncRes.message})`);
    } else {
      showToastMsg('⚡ +10 ventas simuladas agregadas al modelo.');
    }
  };

  const handleResyncLiveRows = async () => {
    if (liveRows.length === 0) {
      showToastMsg('No hay filas nuevas en esta sesión para sincronizar.');
      return;
    }
    setSyncingBatch(true);
    const syncRes = await syncRowsToGoogleSheets(appsScriptUrl, liveRows.slice(0, 25));
    setSyncingBatch(false);
    if (syncRes.ok) {
      showToastMsg(`✅ ${Math.min(25, liveRows.length)} filas sincronizadas con Google Sheets.`);
    }
  };

  const toggleVoiceSession = async () => {
    if (voiceStatus !== 'idle') {
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
      return;
    }

    const session = new GeminiLiveVoiceSession(
      geminiApiKey,
      pizzas,
      cities,
      channels,
      {
        getCurrentCart: () => cartRef.current,
        onAddPizza: (pid, qty) => handleAddPizzaById(pid, qty),
        onRemovePizza: (pid, qty) => handleRemovePizzaById(pid, qty),
        onSetCart: (items) => handleSetCartItems(items),
        onSetCity: (cid) => setSelectedCityId(cid),
        onSetChannel: (chid) => setSelectedChannelId(chid),
        onConfirmOrder: () => handleConfirmOrder('voz_ia'),
        onClearCart: () => {
          cartRef.current = [];
          setCart([]);
        },
        onTranscriptUser: (text) => setUserTranscript(text),
        onTranscriptAI: (text) => setAiResponseText(text),
        onStatusChange: (st, detail) => {
          setVoiceStatus(st);
          if (detail) setVoiceStatusDetail(detail);
        },
        onAudioLevel: (lvl) => setAudioLevel(lvl)
      }
    );

    voiceSessionRef.current = session;
    await session.start();
  };

  const handleManualCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim() || manualLoading) return;
    const phrase = manualInput.trim();
    setManualInput('');
    setUserTranscript(phrase);
    setManualLoading(true);

    const updatedHist = [...cashierHistory, { role: 'user', text: phrase }];
    const reply = await processTextTurnWithVerifiedGemini(
      phrase,
      updatedHist,
      pizzas,
      geminiApiKey,
      {
        getCurrentCart: () => cartRef.current,
        onAddPizza: (pid, qty) => handleAddPizzaById(pid, qty),
        onRemovePizza: (pid, qty) => handleRemovePizzaById(pid, qty),
        onSetCart: (items) => handleSetCartItems(items),
        onSetCity: (cid) => setSelectedCityId(cid),
        onSetChannel: (chid) => setSelectedChannelId(chid),
        onConfirmOrder: () => handleConfirmOrder('voz_ia'),
        onClearCart: () => {
          cartRef.current = [];
          setCart([]);
        },
        onTranscriptUser: () => {},
        onTranscriptAI: () => {},
        onStatusChange: () => {},
        onAudioLevel: () => {}
      }
    );

    setManualLoading(false);
    setCashierHistory([...updatedHist, { role: 'ai', text: reply }]);
    setAiResponseText(reply);
    speakSpanish(reply, geminiApiKey);
  };

  const handleAskBICopilot = async (questionText: string, speakReply = true) => {
    if (!questionText.trim()) return;
    stopSpeaking();
    setBiMessages((prev) => [...prev, { role: 'user', text: questionText }]);
    setBiInput('');
    setBiLoading(true);

    const res = await askBICopilot(questionText, liveAnalytics, geminiApiKey);
    setBiLoading(false);
    setBiMessages((prev) => [
      ...prev,
      { role: 'ai', text: res.answer, spoken: res.spokenSummary }
    ]);

    if (speakReply) {
      setIsBiSpeaking(true);
      await speakSpanish(
        res.spokenSummary || res.answer,
        geminiApiKey,
        () => setIsBiSpeaking(true),
        () => setIsBiSpeaking(false)
      );
    }
  };

  const toggleBiVoiceQuestion = async () => {
    if (isBiMicListening) {
      adminRecorderRef.current?.stop();
      setIsBiMicListening(false);
      return;
    }

    stopSpeaking();
    setIsBiSpeaking(false);
    setIsBiMicListening(true);

    const recorder = new AdminVoiceRecorder();
    adminRecorderRef.current = recorder;

    await recorder.start(
      (lvl) => setBiAudioLevel(lvl),
      async (base64Audio, mimeType) => {
        setIsBiMicListening(false);
        setBiAudioLevel(0);
        setBiLoading(true);

        const audioResult = await askBICopilotByAudio(
          base64Audio,
          mimeType,
          liveAnalytics,
          geminiApiKey
        );

        setBiLoading(false);
        if (!audioResult || !audioResult.userQuestion) {
          showToastMsg('No se detectó una pregunta clara. Intenta hablar un poco más cerca del micrófono.');
          return;
        }

        setBiMessages((prev) => [
          ...prev,
          { role: 'user', text: `🎙️ "${audioResult.userQuestion}"` },
          { role: 'ai', text: audioResult.answer, spoken: audioResult.spokenSummary }
        ]);

        setIsBiSpeaking(true);
        await speakSpanish(
          audioResult.spokenSummary || audioResult.answer,
          geminiApiKey,
          () => setIsBiSpeaking(true),
          () => setIsBiSpeaking(false)
        );
      },
      (errMsg) => {
        setIsBiMicListening(false);
        setBiAudioLevel(0);
        showToastMsg(errMsg);
      }
    );
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.pizza.price * item.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* HEADER SIMPLE Y LIMPIO */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Pizza className="w-5 h-5" />
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900">
              PizzaCorp <span className="text-blue-600 font-medium">AI</span>
            </span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                stopSpeaking();
                setActiveTab('cashier');
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'cashier'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Pedidos por Voz
            </button>
            <button
              onClick={() => {
                if (voiceStatus !== 'idle') {
                  voiceSessionRef.current?.stop();
                  voiceSessionRef.current = null;
                }
                setActiveTab('admin');
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Consultas Admin IA
              {liveRows.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  +{liveRows.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setShowSetupModal(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
            title="Configuración"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* NOTIFICACIÓN FLOTANTE */}
      {toast && (
        <div className="max-w-5xl mx-auto w-full px-4 pt-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="text-emerald-700 font-bold ml-4">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {activeTab === 'cashier' ? (
          /* =========================================================
             VISTA 1: PEDIDOS POR VOZ (CON INGREDIENTES Y ARREPENTIMIENTO)
             ========================================================= */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* IZQUIERDA: CONVERSACIÓN DE VOZ CON GEMINI */}
            <div className="md:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col items-center text-center">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-6">
                Asistente de Voz IA
              </span>

              <button
                onClick={toggleVoiceSession}
                style={{
                  transform: voiceStatus === 'listening' ? `scale(${1 + audioLevel / 300})` : undefined
                }}
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-150 shadow-lg ${
                  voiceStatus === 'idle'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25'
                    : voiceStatus === 'speaking'
                    ? 'bg-indigo-600 text-white ring-8 ring-indigo-100'
                    : voiceStatus === 'connecting'
                    ? 'bg-amber-500 text-white ring-8 ring-amber-100 animate-pulse'
                    : 'bg-red-500 text-white ring-8 ring-red-100'
                }`}
              >
                {voiceStatus === 'idle' ? (
                  <>
                    <Mic className="w-10 h-10 mb-1" />
                    <span className="text-[11px] font-bold uppercase">Hablar</span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-9 h-9 mb-1" />
                    <span className="text-[11px] font-bold uppercase">Detener</span>
                  </>
                )}
              </button>

              {voiceStatus === 'listening' && (
                <div className="w-40 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.max(8, audioLevel)}%` }}
                  />
                </div>
              )}

              <p className="text-xs font-semibold text-slate-600 mt-3">
                {voiceStatusDetail}
              </p>

              {voiceStatus === 'listening' && (
                <button
                  onClick={() => voiceSessionRef.current?.finishCurrentTurnNow()}
                  className="mt-2 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 transition-all"
                >
                  Ya terminé de hablar → Enviar a Gemini
                </button>
              )}

              {/* DIÁLOGO ACTUAL */}
              <div className="w-full mt-6 space-y-3 text-left">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">
                    Tú dijiste
                  </div>
                  <p className="text-sm text-slate-800">
                    {userTranscript
                      ? `"${userTranscript}"`
                      : 'Ej: "Quiero 2 pizzas hawaianas" → "Mejor que sean 2 de pollo medianas" → "¿Qué ingredientes tiene?"'}
                  </p>
                </div>

                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-blue-700 uppercase">
                      Respuesta Gemini
                    </span>
                    <button
                      onClick={() => speakSpanish(aiResponseText, geminiApiKey)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Escuchar
                    </button>
                  </div>
                  <p className="text-sm text-slate-900">
                    {manualLoading ? '⏳ Procesando tu solicitud con Gemini...' : aiResponseText}
                  </p>
                </div>
              </div>

              {/* ENTRADA POR TEXTO OPCIONAL */}
              <form onSubmit={handleManualCommand} className="w-full mt-4 flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Escribe tu pedido, cambia una pizza o pregunta ingredientes..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* DERECHA: RESUMEN DEL PEDIDO ACTUAL -> EXCEL */}
            <div className="md:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="font-bold text-base text-slate-900">Pedido Actual</h2>
                    <p className="text-xs text-slate-500">
                      Se guardará en <code className="text-blue-600">fact_ventas</code> como orden #{lastOrderId + 1}
                    </p>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={() => {
                        cartRef.current = [];
                        setCart([]);
                      }}
                      className="text-xs text-slate-400 hover:text-red-600 font-medium"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {/* CIUDAD Y CANAL */}
                <div className="grid grid-cols-2 gap-3 my-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Ciudad
                    </label>
                    <select
                      value={selectedCityId}
                      onChange={(e) => setSelectedCityId(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                    >
                      {cities.map((c) => (
                        <option key={c.city_id} value={c.city_id}>
                          {c.nombreCiudad}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                      Canal
                    </label>
                    <select
                      value={selectedChannelId}
                      onChange={(e) => setSelectedChannelId(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                    >
                      {channels.map((ch) => (
                        <option key={ch.salechannel_id} value={ch.salechannel_id}>
                          {ch.nombreChannel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* AGREGAR PIZZA MANUALMENTE RÁPIDO */}
                <div className="flex gap-2 mb-4">
                  <select
                    value={quickPizzaId}
                    onChange={(e) => setQuickPizzaId(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  >
                    {pizzas.map((p) => (
                      <option key={p.pizza_id} value={p.pizza_id}>
                        {p.name} ({p.size}) — ${p.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAddPizzaById(quickPizzaId, 1)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>

                {/* LISTA DE ÍTEMS EN EL CARRITO CON INGREDIENTES */}
                <div className="space-y-2 min-h-[160px] max-h-[250px] overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="h-36 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-4 text-center">
                      No hay pizzas en la orden todavía. Puedes agregarlas hablando o pedirle a la IA que las cambie si te arrepientes.
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.pizza.pizza_id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900">
                            {item.pizza.name} ({item.pizza.size})
                          </div>
                          <div className="text-[11px] text-slate-500 truncate" title={item.pizza.ingredients}>
                            {item.pizza.ingredients}
                          </div>
                          <div className="text-[11px] text-blue-600 font-mono-code mt-0.5">
                            ID: {item.pizza.pizza_id} • ${item.pizza.price.toFixed(2)} c/u
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleRemovePizzaById(item.pizza.pizza_id, 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-200 font-bold"
                          >
                            -
                          </button>
                          <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => handleAddPizzaById(item.pizza.pizza_id, 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-200 font-bold"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleRemovePizzaById(item.pizza.pizza_id)}
                            className="text-slate-400 hover:text-red-600 ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TOTAL Y BOTÓN DE ENVIAR A EXCEL */}
              <div className="pt-4 mt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500">Total a Registrar</span>
                  <span className="text-xl font-extrabold text-slate-900">
                    ${cartTotal.toFixed(2)} USD
                  </span>
                </div>

                <button
                  onClick={() => handleConfirmOrder('manual')}
                  disabled={cart.length === 0}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar y Guardar en Google Sheets (Excel)
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             VISTA 2: TABLERO DE CONSULTAS ADMIN CON IA
             ========================================================= */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* IZQUIERDA: MÉTRICAS EJECUTIVAS DEL MODELO EXCEL */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              {/* 3 KPIS + SIMULADOR */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">Ingresos Totales</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    ${liveAnalytics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  {liveAnalytics.liveRevenue > 0 && (
                    <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                      +${liveAnalytics.liveRevenue.toFixed(2)} hoy
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">Filas en fact_ventas</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {(liveAnalytics.totalHistoricalRows + liveAnalytics.liveOrdersCount).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {liveAnalytics.liveOrdersCount > 0
                      ? `${liveAnalytics.liveOrdersCount} nuevas en sesión`
                      : `${liveAnalytics.totalQuantity.toLocaleString()} pizzas`}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center gap-1.5">
                  <button
                    onClick={handleSimulateRushHour}
                    disabled={syncingBatch}
                    className="w-full py-2 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {syncingBatch ? 'Enviando...' : '+10 Ventas IA'}
                  </button>
                  <span className="text-[10px] text-slate-400 text-center">
                    Inyectar en Google Sheets
                  </span>
                </div>
              </div>

              {/* PESTAÑAS INTERNAS DEL PANEL ADMIN */}
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 overflow-x-auto">
                <button
                  onClick={() => setBiViewMode('mirror')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    biViewMode === 'mirror'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Ciudades y Canales
                </button>
                <button
                  onClick={() => setBiViewMode('skus')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    biViewMode === 'skus'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Top & Menor Rotación
                </button>
                <button
                  onClick={() => setBiViewMode('live_table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                    biViewMode === 'live_table'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Filas Nuevas ({liveRows.length})
                </button>
              </div>

              {/* CONTENIDO SEGÚN PESTAÑA DEL ADMIN */}
              {biViewMode === 'mirror' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2">
                      Ganancias por Año (dim_fecha)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {Object.entries(liveAnalytics.byYear)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([yr, st]) => (
                          <div
                            key={yr}
                            className="bg-blue-50/50 p-3 rounded-xl border border-blue-200/70 text-xs"
                          >
                            <div className="text-[11px] font-bold text-blue-700">Año {yr}</div>
                            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                              ${st.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {st.orders.toLocaleString()} filas • {st.qty.toLocaleString()} uds
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2.5">
                      Facturación por Ciudad (dim_city)
                    </h4>
                    <div className="space-y-2.5">
                      {Object.entries(liveAnalytics.byCity)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .map(([city, st]) => {
                          const pct = ((st.revenue / liveAnalytics.totalRevenue) * 100).toFixed(1);
                          return (
                            <div key={city} className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-bold text-slate-900">{city}</span>
                                <span className="font-mono-code text-slate-700 font-semibold">
                                  ${st.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                                  <span className="text-slate-400 font-normal">
                                    ({st.orders.toLocaleString()} órdenes • {pct}%)
                                  </span>
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2">
                        Por Canal (dim_saleChannel)
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(liveAnalytics.byChannel)
                          .sort((a, b) => b[1].revenue - a[1].revenue)
                          .map(([ch, st]) => (
                            <div
                              key={ch}
                              className="bg-slate-50 px-3 py-2.5 rounded-xl text-xs border border-slate-200/70 flex items-center justify-between"
                            >
                              <span className="font-semibold text-slate-800">{ch}</span>
                              <span className="font-bold text-slate-900">
                                ${st.revenue.toLocaleString('en-US')}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2">
                        Por Categoría (dim_pizaTipeID)
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(liveAnalytics.byCategory)
                          .sort((a, b) => b[1].revenue - a[1].revenue)
                          .map(([cat, st]) => (
                            <div
                              key={cat}
                              className="bg-slate-50 px-3 py-2.5 rounded-xl text-xs border border-slate-200/70 flex items-center justify-between"
                            >
                              <span className="font-semibold text-slate-800">{cat}</span>
                              <span className="font-bold text-slate-900">
                                ${st.revenue.toLocaleString('en-US')}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {biViewMode === 'skus' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-700 mb-2.5">
                      🏆 Top 5 Pizzas Más Vendidas
                    </h4>
                    <div className="space-y-2">
                      {liveAnalytics.topPizzas.slice(0, 5).map((p, i) => (
                        <div
                          key={p.pizza_id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="font-bold text-slate-900">
                            {i + 1}. {p.name} ({p.size})
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span className="font-mono-code">{p.pizza_id}</span>
                            <span className="font-bold text-emerald-700">
                              ${p.revenue.toLocaleString('en-US')} ({p.qty} uds)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-amber-700 mb-2.5">
                      📉 Top 5 Menor Rotación
                    </h4>
                    <div className="space-y-2">
                      {liveAnalytics.bottomPizzas.slice(0, 5).map((p, i) => (
                        <div
                          key={p.pizza_id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                        >
                          <div className="font-bold text-slate-900">
                            {i + 1}. {p.name} ({p.size})
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span className="font-mono-code">{p.pizza_id}</span>
                            <span className="font-bold text-amber-700">
                              ${p.revenue.toLocaleString('en-US')} ({p.qty} uds)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {biViewMode === 'live_table' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Últimas filas insertadas en <code className="text-blue-600">fact_ventas</code>
                    </span>
                    <div className="flex items-center gap-2">
                      {liveRows.length > 0 && (
                        <>
                          <button
                            onClick={handleResyncLiveRows}
                            disabled={syncingBatch}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Reenviar a Sheets
                          </button>
                          <button
                            onClick={() => setLiveRows([])}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-[11px] font-semibold"
                          >
                            Limpiar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {liveRows.length === 0 ? (
                    <div className="h-56 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-xs text-slate-400 p-6 text-center gap-2">
                      <p>Aún no has agregado filas en esta sesión.</p>
                      <p>Usa el Asistente de Voz o pulsa el botón "+10 Ventas IA" arriba.</p>
                    </div>
                  ) : (
                    <div className="max-h-[320px] overflow-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead className="bg-slate-100 text-slate-600 sticky top-0">
                          <tr>
                            <th className="p-2">order_id</th>
                            <th className="p-2">date</th>
                            <th className="p-2">city_id</th>
                            <th className="p-2">channel</th>
                            <th className="p-2">qty</th>
                            <th className="p-2">pizza_id</th>
                            <th className="p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {liveRows.slice(0, 50).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-mono-code font-bold text-blue-600">#{r.order_id}</td>
                              <td className="p-2 font-mono-code">{r.date}</td>
                              <td className="p-2">{r.city_id} ({r.city_name})</td>
                              <td className="p-2">{r.salechannel_id} ({r.channel_name})</td>
                              <td className="p-2 font-bold">{r.quantity}</td>
                              <td className="p-2 font-mono-code">{r.pizza_id}</td>
                              <td className="p-2 text-right font-bold">${r.total_price.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DERECHA: TABLERO DE CONSULTAS ADMIN CON IA */}
            <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col h-[540px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Tablero de Consultas Admin con IA</h3>
                  <p className="text-xs text-slate-500">
                    Pregunta por voz o texto sobre ventas, sedes e ingredientes
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {isBiSpeaking && (
                    <button
                      onClick={() => {
                        stopSpeaking();
                        setIsBiSpeaking(false);
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs"
                      title="Detener lectura de voz"
                    >
                      <VolumeX className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={toggleBiVoiceQuestion}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isBiMicListening
                        ? 'bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-100'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isBiMicListening ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" /> Enviar Voz
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" /> Preguntar por Voz
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* BARRA DE ONDA DE VOZ DEL ADMIN CUANDO ESTÁ ESCUCHANDO */}
              {isBiMicListening && (
                <div className="my-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold text-emerald-800">
                    🎙️ Escuchando tu pregunta...
                  </span>
                  <div className="w-28 h-2 bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${Math.max(10, biAudioLevel)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* PREGUNTAS RÁPIDAS SUGERIDAS */}
              <div className="flex gap-1.5 overflow-x-auto py-2.5 border-b border-slate-100">
                {[
                  'Ganancias por año',
                  '¿Qué ciudad vende más?',
                  'Top 5 pizzas más vendidas',
                  '¿Qué ingredientes lleva la Hawaiana?',
                  '¿Cuál es la pizza menos vendida?',
                  'Ventas por canal'
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleAskBICopilot(q, true)}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-[11px] text-slate-700 border border-slate-200 whitespace-nowrap transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* HISTORIAL DE MENSAJES DEL ANALISTA IA */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {biMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs whitespace-pre-line ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-50 border border-slate-200 text-slate-800'
                      }`}
                    >
                      <div>{m.text}</div>
                      {m.role === 'ai' && (
                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex justify-end">
                          <button
                            onClick={() =>
                              speakSpanish(
                                m.spoken || m.text,
                                geminiApiKey,
                                () => setIsBiSpeaking(true),
                                () => setIsBiSpeaking(false)
                              )
                            }
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                          >
                            <Volume2 className="w-3 h-3" /> Escuchar resumen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {biLoading && (
                  <div className="text-xs text-blue-600 font-medium animate-pulse">
                    ⏳ Analizando modelo de datos con Gemini...
                  </div>
                )}
                <div ref={biChatEndRef} />
              </div>

              {/* INPUT DE TEXTO DEL ADMIN */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskBICopilot(biInput, true);
                }}
                className="pt-3 border-t border-slate-100 flex gap-2"
              >
                <input
                  type="text"
                  value={biInput}
                  onChange={(e) => setBiInput(e.target.value)}
                  placeholder="Pregunta sobre ciudades, canales, ingresos o ingredientes..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={biLoading}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* MODAL SIMPLE DE CONFIGURACIÓN */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Configuración de Conexión</h3>
              <button onClick={() => setShowSetupModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL de Google Apps Script (Hoja corregida):
                </label>
                <input
                  type="text"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clave API de Gemini:
                </label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
