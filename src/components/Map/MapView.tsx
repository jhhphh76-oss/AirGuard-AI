import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  AQIReading,
  LocationData,
  HealthcarePoint,
  AIAdvisorResponse,
  ChatMessage,
  HourlyForecastPoint,
} from '../../types/airguard';
import { aiAdvisorService, PRESET_ADVISOR_QUESTIONS } from '../../services/aiAdvisorService';
import { locationService } from '../../services/locationService';
import { healthContextService } from '../../services/healthContextService';
import {
  MapPin,
  Compass,
  Sparkles,
  Send,
  Loader2,
  Crosshair,
  Building2,
  Phone,
  Globe,
  ExternalLink,
  Navigation,
  X,
  Clock,
  Database,
  Search,
  AlertTriangle,
  RotateCcw,
  Bot,
  User,
} from 'lucide-react';

interface MapViewProps {
  reading: AQIReading;
  forecast?: HourlyForecastPoint[];
  healthcareFacilities?: HealthcarePoint[];
  onOpenLocationSearch: () => void;
  onSelectLocation: (location: LocationData) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  reading,
  forecast = [],
  healthcareFacilities = [],
  onOpenLocationSearch,
  onSelectLocation,
}) => {
  const { location, aqi, category, categoryColor, dominantPollutant, pollutants } = reading;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Selected healthcare facility card on map
  const [selectedFacility, setSelectedFacility] = useState<HealthcarePoint | null>(null);

  // Geolocation loading state
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // AI Advisor Conversational State (strictly inside Map)
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(true);
  const [advisorQuery, setAdvisorQuery] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [currentLocationName, setCurrentLocationName] = useState(location.name);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init_welcome',
      role: 'assistant',
      text: `Hello! I’m **AirGuard AI**, your air-quality and environmental health assistant. I have live access to verified Open-Meteo telemetry for **${location.name}** (${aqi} US AQI · ${category}, dominant factor: ${dominantPollutant}).\n\nFeel free to ask me anything about the air here, specific pollutants (PM2.5, PM10, ozone), outdoor activity precautions, or any general questions!`,
      timestamp: Date.now(),
      source: 'AirGuard AI',
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // When location changes, update location context and notify in chat
  useEffect(() => {
    if (location.name !== currentLocationName) {
      setCurrentLocationName(location.name);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `loc_${Date.now()}`,
          role: 'assistant',
          text: `📍 *Location context updated to **${location.name}** (AQI ${aqi} · ${category}). I will now answer using this location's verified data.*`,
          timestamp: Date.now(),
          source: 'AirGuard AI',
        },
      ]);
    }
  }, [location.name, aqi, category, currentLocationName]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (isAdvisorOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, advisorLoading, isAdvisorOpen]);

  // Carry forward Other Concern context from Health section (Requirement 3)
  useEffect(() => {
    const healthCtx = healthContextService.getHealthContext();
    if (healthCtx.selectedSymptom === 'Other concern') {
      const concernDetail = healthCtx.customConcern ? `("${healthCtx.customConcern}")` : '';
      setChatMessages((prev) => {
        const hasConcern = prev.some((m) => m.id.startsWith('concern_entry_'));
        if (hasConcern) return prev;
        return [
          ...prev,
          {
            id: `concern_entry_${Date.now()}`,
            role: 'assistant',
            text: `I notice you selected **Other concern** ${concernDetail} from the Health section for **${location.name}** (${aqi} US AQI · ${category}, dominant factor: ${dominantPollutant}).\n\nI'm ready to discuss your specific concern and how current air quality and pollutant levels may relate to it. What would you like to know or discuss?`,
            timestamp: Date.now(),
            source: 'AirGuard AI',
          },
        ];
      });
      setIsAdvisorOpen(true);
    }
  }, [location.name, aqi, category, dominantPollutant]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [location.latitude, location.longitude],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      // Free OpenStreetMap tile layer with © OpenStreetMap contributors attribution
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Attribution control in compact bottom-right, displaying strictly "© OpenStreetMap contributors"
      L.control
        .attribution({ position: 'bottomright', prefix: false })
        .addTo(map);

      // Markers Layer Group
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      // Map Click Interaction: Select coordinates and update location
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        try {
          const newLoc = await locationService.reverseGeocode(lat, lng);
          onSelectLocation(newLoc);
        } catch {
          onSelectLocation({
            name: `Coordinate (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
            country: '',
            latitude: Number(lat.toFixed(4)),
            longitude: Number(lng.toFixed(4)),
            source: 'map_selected',
          });
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map view and markers when location or facilities change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    map.setView([location.latitude, location.longitude], map.getZoom() || 12, {
      animate: true,
    });

    markersLayer.clearLayers();

    // 1. User / Active Location Pulsing Marker
    const locationIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:0; border-radius:9999px; background:${categoryColor}40; animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width:26px; height:26px; border-radius:9999px; background:${categoryColor}; border:2px solid #ffffff; box-shadow:0 0 12px ${categoryColor}; display:flex; align-items:center; justify-content:center; color:#071A24; font-weight:800; font-size:10px; font-family:monospace;">
            ${aqi}
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    L.marker([location.latitude, location.longitude], {
      icon: locationIcon,
      zIndexOffset: 1000,
    })
      .addTo(markersLayer)
      .bindTooltip(
        `<strong>${location.name}</strong><br/>US AQI: ${aqi} (${category})`,
        { direction: 'top', offset: [0, -18] }
      );

    // 2. Real Healthcare Facilities Markers
    healthcareFacilities.forEach((med) => {
      if (med.latitude === undefined || med.longitude === undefined) return;

      const isEmergency = med.emergencyAvailable;
      const markerColor = isEmergency ? '#EF4444' : '#0F766E';
      const borderColor = isEmergency ? '#FCA5A5' : '#5EEAD4';

      const medIcon = L.divIcon({
        className: 'custom-healthcare-marker',
        html: `
          <div style="width:28px; height:28px; border-radius:8px; background:${markerColor}; border:2px solid ${borderColor}; box-shadow:0 2px 8px rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; color:#ffffff; cursor:pointer;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 6v12"/><path d="M6 12h12"/>
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([med.latitude, med.longitude], { icon: medIcon }).addTo(
        markersLayer
      );

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedFacility(med);
      });
    });
  }, [location, aqi, category, categoryColor, healthcareFacilities]);

  // Handle Current Location Detection
  const handleDetectLocation = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const loc = await locationService.getCurrentBrowserLocation();
      onSelectLocation(loc);
    } catch (err: any) {
      console.warn('Geolocation detection error:', err);
      setLocationError(err.message || 'Unable to retrieve your current location. Check browser settings.');
      setTimeout(() => setLocationError(null), 5000);
    } finally {
      setIsLocating(false);
    }
  };

  // Handle AI Advisor Multi-Turn Conversational Queries
  const handleAskAdvisor = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || advisorLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    // Update conversation state immediately
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setAdvisorQuery('');
    setAdvisorLoading(true);

    // Extract history turns for context preservation
    const historyTurns = updatedMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        text: m.text,
      }));

    try {
      const resp = await aiAdvisorService.askAdvisor(trimmed, reading, historyTurns, forecast);
      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        text: resp.answer,
        timestamp: Date.now(),
        source: resp.source || 'AirGuard AI',
        isError: resp.answer.includes('trouble connecting'),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Friendly, non-crashing error per rule 11
      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant_err_${Date.now()}`,
          role: 'assistant',
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: Date.now(),
          source: 'AirGuard AI',
          isError: true,
        },
      ]);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: `init_new_${Date.now()}`,
        role: 'assistant',
        text: `Conversation cleared. I’m **AirGuard AI**, ready to assist you with air quality in **${location.name}** (AQI ${aqi} · ${category}) or any general questions!`,
        timestamp: Date.now(),
        source: 'AirGuard AI',
      },
    ]);
  };

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 1. Real Environmental Map Container */}
      <section className="bg-[#09212D] border border-[#263238] rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Map Stage Header HUD */}
        <div className="p-3 border-b border-[#263238] flex items-center justify-between bg-[#071A24]/90 backdrop-blur-md z-10 relative">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/20 text-[#06B6D4] border border-[#0F766E]/30 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-xs font-bold text-white truncate"
                title={`${location.name}${location.admin1 ? `, ${location.admin1}` : ''}, ${location.country}`}
              >
                {location.name}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="p-2 rounded-xl bg-[#09212D] hover:bg-slate-800 text-[#5EEAD4] border border-slate-700/80 transition-colors"
              title="Detect my current location"
              aria-label="Locate me"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#06B6D4]" />
              ) : (
                <Crosshair className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onOpenLocationSearch}
              className="py-1.5 px-2.5 rounded-xl bg-[#09212D] hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700/80 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Search</span>
            </button>
          </div>
        </div>

        {locationError && (
          <div className="px-4 py-2 bg-[#EF4444]/15 border-b border-[#EF4444]/30 text-[11px] text-[#EF4444] flex items-center justify-between animate-in fade-in">
            <span>{locationError}</span>
            <button
              onClick={() => setLocationError(null)}
              className="text-[#EF4444] hover:text-white ml-2 text-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Real Leaflet Map Viewport */}
        <div className="relative w-full h-[360px]">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Interactive Hint Pill */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <span className="px-2.5 py-1 rounded-full bg-[#071A24]/90 backdrop-blur-md border border-slate-700/70 text-[10px] font-mono text-slate-300 shadow">
              Tap anywhere on map to query air
            </span>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-8 h-8 rounded-lg bg-[#071A24]/90 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center border border-slate-700 shadow"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-8 h-8 rounded-lg bg-[#071A24]/90 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center border border-slate-700 shadow"
              aria-label="Zoom out"
            >
              −
            </button>
          </div>

          {/* Selected Healthcare Facility Detail Floating Card */}
          {selectedFacility && (
            <div className="absolute bottom-3 left-3 right-12 z-20 p-3 rounded-2xl bg-[#071A24]/95 backdrop-blur-lg border border-[#06B6D4]/50 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                    <h3 className="text-xs font-bold text-white leading-tight truncate">
                      {selectedFacility.name}
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {selectedFacility.distanceKm} km away · {selectedFacility.address}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFacility(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                  aria-label="Close facility details"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedFacility.latitude},${selectedFacility.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 px-2 rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Directions</span>
                </a>

                {selectedFacility.contactNumber && (
                  <a
                    href={`tel:${selectedFacility.contactNumber}`}
                    className="py-1.5 px-3 rounded-xl bg-[#071A24] hover:bg-slate-800 text-[#5EEAD4] border border-[#0F766E]/50 font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Call</span>
                  </a>
                )}

                {selectedFacility.website && (
                  <a
                    href={selectedFacility.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-[11px] flex items-center gap-1"
                    title="Website"
                  >
                    <Globe className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Environmental Telemetry Footer Strip */}
        <div className="p-3.5 bg-[#09212D] border-t border-[#263238] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: `${categoryColor}20`,
                  borderColor: `${categoryColor}50`,
                  color: categoryColor,
                }}
              >
                {category}
              </span>
              <span className="text-xs text-slate-300">
                Driver: <strong className="text-white">{dominantPollutant}</strong>
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-extrabold font-mono text-white tabular-nums">
                {aqi}{' '}
                <span className="text-[10px] font-normal text-slate-400">US AQI</span>
              </span>
            </div>
          </div>

          {/* Quick Pollutant Chips */}
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
            <div className="p-1.5 rounded-xl bg-[#071A24] border border-slate-800">
              <span className="text-slate-400 block text-[9px]">PM2.5</span>
              <span className="font-bold text-white">
                {pollutants.pm2_5 !== null ? `${pollutants.pm2_5}` : 'N/A'}
              </span>
            </div>
            <div className="p-1.5 rounded-xl bg-[#071A24] border border-slate-800">
              <span className="text-slate-400 block text-[9px]">PM10</span>
              <span className="font-bold text-white">
                {pollutants.pm10 !== null ? `${pollutants.pm10}` : 'N/A'}
              </span>
            </div>
            <div className="p-1.5 rounded-xl bg-[#071A24] border border-slate-800">
              <span className="text-slate-400 block text-[9px]">O₃</span>
              <span className="font-bold text-white">
                {pollutants.o3 !== null ? `${pollutants.o3}` : 'N/A'}
              </span>
            </div>
            <div className="p-1.5 rounded-xl bg-[#071A24] border border-slate-800">
              <span className="text-slate-400 block text-[9px]">NO₂</span>
              <span className="font-bold text-white">
                {pollutants.no2 !== null ? `${pollutants.no2}` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <Database className="w-3 h-3 text-slate-500" /> Air quality data: Open-Meteo
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />{' '}
              {new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </section>

      {/* 2. AI Advisor Entry (Strictly inside Map) */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>AirGuard AI Advisor</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#071A24] border border-slate-800 text-[#5EEAD4]">
                  {location.name} · AQI {aqi}
                </span>
              </h2>
              <p className="text-[10px] text-slate-400">
                Open-ended conversational environmental assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {chatMessages.length > 1 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 rounded-xl bg-[#071A24] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAdvisorOpen(!isAdvisorOpen)}
              className="py-1 px-3 rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-semibold text-xs transition-colors"
            >
              {isAdvisorOpen ? 'Hide' : 'Open Advisor'}
            </button>
          </div>
        </div>

        {isAdvisorOpen && (
          <div className="space-y-3 pt-1 animate-in fade-in">
            {/* Scrollable Chat Messages Thread */}
            <div className="max-h-[360px] min-h-[140px] overflow-y-auto space-y-2.5 p-3 rounded-2xl bg-[#05141D] border border-slate-800/90 text-xs">
              {chatMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-6 h-6 rounded-full bg-[#0F766E]/30 text-[#5EEAD4] border border-[#0F766E]/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 shadow-md ${
                        isUser
                          ? 'bg-[#0F766E] text-white rounded-tr-sm'
                          : msg.isError
                          ? 'bg-[#EF4444]/15 border border-[#EF4444]/40 text-slate-200 rounded-tl-sm'
                          : 'bg-[#071A24] border border-slate-800 text-slate-200 rounded-tl-sm'
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1 border-b border-slate-800/60 pb-0.5">
                          <span className="font-bold text-[#5EEAD4]">AirGuard AI</span>
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                      <div className="leading-relaxed text-[11px] whitespace-pre-wrap break-words">
                        {msg.text}
                      </div>
                    </div>
                    {isUser && (
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}

              {advisorLoading && (
                <div className="flex items-start gap-2 justify-start animate-in fade-in">
                  <div className="w-6 h-6 rounded-full bg-[#0F766E]/30 text-[#5EEAD4] border border-[#0F766E]/50 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-[#5EEAD4] animate-spin" />
                    <span className="text-[11px] font-mono">AirGuard AI is analyzing...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggested Follow-up Prompts (Optional chips, not limiting) */}
            <div className="w-full overflow-x-auto no-scrollbar scroll-smooth pb-0.5 pt-0.5 touch-pan-x">
              <div className="flex items-center gap-1.5 min-w-max pr-4">
                {PRESET_ADVISOR_QUESTIONS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAskAdvisor(preset)}
                    className="shrink-0 flex-shrink-0 whitespace-nowrap px-2.5 py-1 rounded-xl bg-[#071A24] hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Query Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAdvisor(advisorQuery);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={advisorQuery}
                onChange={(e) => setAdvisorQuery(e.target.value)}
                placeholder="Ask AirGuard AI anything..."
                className="flex-1 px-3.5 py-2.5 bg-[#071A24] border border-[#263238] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06B6D4]"
              />
              <button
                type="submit"
                disabled={advisorLoading || !advisorQuery.trim()}
                className="p-2.5 rounded-xl bg-[#06B6D4] hover:bg-[#06B6D4]/80 text-[#071A24] font-bold disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                aria-label="Send message"
              >
                {advisorLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>

            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-1 pt-0.5">
              <span>Non-diagnostic environmental support</span>
              <span>Open-ended conversational AI</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
