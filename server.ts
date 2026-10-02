import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateScientificRulesFallback(question: string, context: any): string {
  const { locationName, aqi, category, dominantPollutant, pollutants } = context || {};
  const q = (question || '').toLowerCase().trim();

  // 1. Identity queries
  if (
    q.includes('who are you') ||
    q.includes('what are you') ||
    q.includes('what is your name') ||
    q.includes("what's your name") ||
    q.includes('are you an ai')
  ) {
    return "I’m AirGuard AI, your air-quality and environmental health assistant. I can help you understand pollution, AQI readings, pollutants, forecasts, and general questions.";
  }

  // 2. Pollutant explanations
  if (q.includes('pm2.5') || q.includes('pm25')) {
    return `PM2.5 refers to fine inhalable particles with diameters 2.5 micrometers and smaller (roughly 30 times finer than a strand of human hair). Because of their microscopic scale, they can bypass upper airway defenses, penetrate deep into alveolar lung tissue, and enter the bloodstream. In ${locationName}, current PM2.5 is **${pollutants?.pm2_5 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('pm10')) {
    return `PM10 consists of inhalable particles with diameters of 10 micrometers and smaller, including airborne road dust, pollen, mold spores, and mechanical abrasion debris. They primarily settle in the upper respiratory tract. In ${locationName}, current PM10 is **${pollutants?.pm10 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('ozone') || q.includes('o3')) {
    return `Ground-level ozone (O3) is a secondary pollutant created by photochemical reactions between nitrogen oxides (NOx) and volatile organic compounds (VOCs) under sunlight. Unlike stratospheric ozone that protects us from UV, ground-level ozone is a powerful lung irritant. In ${locationName}, current O3 is **${pollutants?.o3 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('seven pollutants') || q.includes('7 pollutants')) {
    return `AirGuard monitors the primary environmental pollutants affecting respiratory and cardiovascular wellness:\n\n1. **PM2.5** — Fine particulate matter\n2. **PM10** — Inhalable coarse particles\n3. **NO2** — Nitrogen dioxide from combustion\n4. **O3** — Ground-level ozone\n5. **CO** — Carbon monoxide\n6. **SO2** — Sulphur dioxide\n7. **CO2** — Atmospheric carbon dioxide`;
  }

  if (q.includes('difference between aqi and pm2.5') || q.includes('aqi and pm2.5')) {
    return `**PM2.5** is a physical measurement of mass concentration (in micrograms per cubic meter, µg/m³) of fine particles in the air.\n\n**AQI (Air Quality Index)** is a standardized index (0 to 500) designed by environmental agencies to translate raw pollutant concentrations into a simple, color-coded health risk scale (Good, Moderate, Unhealthy, etc.).`;
  }

  // 3. Child/Simplified explanations
  if (q.includes('like i\'m 10') || q.includes('like im 10') || q.includes('for a kid') || q.includes('simple')) {
    return `Imagine the air around us is like a big glass of clear water. Air pollution is like tiny invisible specks of dust and smoke floating inside that water. When the air has too many specks, it can make our throats tickle or make it harder to run fast. In ${locationName}, the air is currently **${category}** (AQI ${aqi}), so it's a good idea to check before big outdoor games!`;
  }

  // 4. Urban pollution
  if (q.includes('cities') || q.includes('urban') || q.includes('traffic')) {
    return `Air pollution increases in urban centers due to dense vehicular traffic (diesel and gasoline exhaust), localized industrial emissions, asphalt heat retention, and reduced natural vegetation. Tall buildings can also create "urban street canyons" that trap exhaust near street level during periods of weak atmospheric wind mixing.`;
  }

  // 5. Why is AQI high / current status
  if (q.includes('why is') && (q.includes('high') || q.includes('poor') || q.includes('aqi'))) {
    return `In **${locationName}**, the current US AQI is **${aqi}** (**${category}**), with **${dominantPollutant}** as the primary driver. Elevated levels may be influenced by localized vehicular emissions, heating or industrial outputs, and atmospheric temperature inversions that suppress vertical pollutant dispersion.`;
  }

  // 6. Precautions / What can I do
  if (q.includes('what can i do') || q.includes('precaution') || q.includes('protect') || q.includes('advice')) {
    return `When ambient air quality is ${category} (AQI ${aqi}) in ${locationName}, recommended practical precautions include:\n\n• **Indoor air protection:** Keep windows closed along congested roads during peak rush hours, and run mechanical HEPA air purifiers.\n• **Activity scheduling:** Shift intense cardiovascular training to early morning or filtered indoor facilities.\n• **Personal protection:** Active seniors, children, and individuals with asthma should carry prescribed rescue inhalers and consider certified N95/FFP2 masks for prolonged outdoor exposure.`;
  }

  // 7. Interesting facts
  if (q.includes('interesting') || q.includes('fun fact') || q.includes('fact')) {
    return `Here is a fascinating atmospheric fact: Microscopic fine particles (PM2.5) are so lightweight that they can remain suspended in the atmosphere for weeks, traveling thousands of miles across oceans on continental jet streams! For example, Saharan dust plumes regularly travel across the Atlantic to the Americas.`;
  }

  // 8. General conversational questions
  if (q.includes('why is the sky blue') || q.includes('sky blue')) {
    return `The sky is blue due to a physical phenomenon called **Rayleigh scattering**. Earth's atmospheric gases scatter shorter wavelengths of sunlight (blue and violet) in all directions much more strongly than longer wavelengths (red and yellow). Because human eyes are more sensitive to blue light, we perceive the daytime sky as blue!`;
  }

  if (q.includes('joke')) {
    return `Why did the atmospheric sensor break up with the air filter? Because it felt too much pressure! 😄`;
  }

  if (q.includes('summarise') || q.includes('summary') || q.includes('overview') || q.includes('reading')) {
    return `### Air Quality Summary for ${locationName}\n\n• **Current US AQI:** ${aqi} (${category})\n• **Dominant Factor:** ${dominantPollutant}\n• **PM2.5 Level:** ${pollutants?.pm2_5 ?? 'Unavailable'} µg/m³\n• **PM10 Level:** ${pollutants?.pm10 ?? 'Unavailable'} µg/m³\n\nConditions are currently within the **${category}** threshold. Atmospheric dispersion is monitored continuously.`;
  }

  if (q.includes('exercise') || q.includes('outdoor')) {
    if (aqi <= 50) {
      return `### Outdoor Exercise Guidance\n\nOutdoor exercise is **highly recommended** in ${locationName}. Atmospheric air quality is optimal (${aqi} US AQI, Good).`;
    }
    if (aqi <= 100) {
      return `### Outdoor Exercise Guidance\n\nOutdoor exercise is **reasonable** for most people in ${locationName}. Sensitive individuals should monitor for mild breathing fatigue.`;
    }
    return `### Outdoor Exercise Guidance\n\nOutdoor exercise should be **reduced or shifted indoors** in ${locationName}. Elevated particulate levels (${aqi} US AQI, ${category}) increase alveolar deposition during high respiration rates.`;
  }

  return `### Air Quality Analysis for ${locationName}\n\n• **Current AQI:** ${aqi} (${category})\n• **Dominant Factor:** ${dominantPollutant}\n• **PM2.5:** ${pollutants?.pm2_5 ?? 'Unavailable'} µg/m³ · **PM10:** ${pollutants?.pm10 ?? 'Unavailable'} µg/m³\n\nI can help you understand this reading, explain specific pollutants, recommend outdoor precautions, or answer general questions!`;
}

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Increase payload limit to support captured photos and image attachments
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Initialize server-side Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // Server-side AI Advisor endpoint
  app.post('/api/gemini/advisor', async (req, res) => {
    try {
      const { question, context, history } = req.body;
      if (!question || !context) {
        return res.status(400).json({ error: 'Missing question or context payload' });
      }

      if (!ai) {
        return res.json({
          answer: generateScientificRulesFallback(question, context),
          source: 'AirGuard AI',
        });
      }

      const systemInstruction = `You are AirGuard AI, the dedicated air-quality and environmental health assistant inside the AirGuard application.

IDENTITY & PERSONA:
- Your name is AirGuard AI.
- If asked "Who are you?", "What are you?", "What's your name?", "Are you an AI?", or similar questions, answer naturally:
  "I’m AirGuard AI, your air-quality and environmental health assistant. I can help you understand pollution, AQI readings, pollutants, forecasts, and general questions."
- Never claim to be OpenAI, ChatGPT, Gemini, or any external AI. AirGuard AI is the assistant identity inside this application.
- You are conversational, intelligent, helpful, and natural.

KNOWLEDGE & SCOPE:
- OPEN-ENDED: You are NOT limited to air quality. You must NOT say "I can only answer questions about air quality."
- If asked general questions (e.g., "Why is the sky blue?", "Explain air pollution like I'm 10", "Tell me a joke", or general knowledge), answer naturally, accurately, and pleasantly.
- Respond naturally without unnecessarily forcing every conversation back to AQI.

LOCATION & REAL AIRGUARD CONTEXT:
The user is currently viewing:
- Location: ${context.locationName} (${context.latitude}, ${context.longitude})
- Current US AQI: ${context.aqi} (${context.category})
- Dominant Pollutant: ${context.dominantPollutant}
- Measured Pollutants from Open-Meteo:
  * PM2.5: ${context.pollutants?.pm2_5 != null ? `${context.pollutants.pm2_5} µg/m³` : 'Unavailable'}
  * PM10: ${context.pollutants?.pm10 != null ? `${context.pollutants.pm10} µg/m³` : 'Unavailable'}
  * NO2: ${context.pollutants?.no2 != null ? `${context.pollutants.no2} µg/m³` : 'Unavailable'}
  * O3 (Ozone): ${context.pollutants?.o3 != null ? `${context.pollutants.o3} µg/m³` : 'Unavailable'}
  * CO: ${context.pollutants?.co != null ? `${context.pollutants.co} µg/m³` : 'Unavailable'}
  * SO2: ${context.pollutants?.so2 != null ? `${context.pollutants.so2} µg/m³` : 'Unavailable'}
  * CO2: ${context.pollutants?.co2 != null ? `${context.pollutants.co2} ppm` : 'Unavailable'}
- Environmental Indicators:
  * AOD (Aerosol Optical Depth): ${context.indicators?.aod != null ? context.indicators.aod : 'Unavailable'}
  * Dust: ${context.indicators?.dust != null ? `${context.indicators.dust} µg/m³` : 'Unavailable'}
  * UV Index: ${context.indicators?.uv_index != null ? context.indicators.uv_index : 'Unavailable'}

AIR-QUALITY RULES:
1. When asked about current air quality or pollution, always ground your response in the actual measurements above for ${context.locationName}.
2. Do NOT invent missing values. If a pollutant or reading is marked "Unavailable", clearly say it is not available from the current telemetry feed.
3. Reason scientifically from the data. If PM2.5 is high, explain that PM2.5 is one of the measured pollutants contributing to current conditions. If multiple pollutants are elevated, explain each separately.
4. HEALTH SAFETY BOUNDARIES:
   - You are an environmental health assistant, NOT a doctor or diagnostic system.
   - Do NOT diagnose medical conditions.
   - Do NOT claim that pollution definitely caused a symptom.
   - Use cautious phrasing: "may contribute to", "can be associated with", or "may worsen symptoms in some people".
   - Suggest practical exposure precautions (e.g. running HEPA purifiers, timing outdoor exercise, using certified N95 masks when AQI is poor).
   - If symptoms sound severe (e.g. severe breathlessness, chest pain), urge immediate evaluation by a qualified medical professional.
5. CONVERSATION CONTEXT:
   - Maintain context across previous turns in this conversation. If the user asks a follow-up ("Why is it dangerous?", "What about PM10?", "Explain it like I'm 10"), connect it seamlessly without asking the user to repeat context.`;

      // Build contents array for multi-turn conversation
      const contents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const turn of history.slice(-10)) {
          if (turn.text && turn.text.trim()) {
            const role = turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user';
            if (contents.length === 0 && role !== 'user') {
              continue;
            }
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
              contents[contents.length - 1].parts[0].text += `\n${turn.text}`;
            } else {
              contents.push({
                role,
                parts: [{ text: turn.text }],
              });
            }
          }
        }
      }

      // Append current user question
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts[0].text += `\n${question}`;
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: question }],
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.6,
        },
      });

      const text = response.text || "I'm having trouble connecting right now. Please try again in a moment.";
      res.json({ answer: text, source: 'AirGuard AI' });
    } catch (err: any) {
      console.error('Gemini advisor error:', err);
      // Friendly fallback adhering strictly to rule 11
      const fallback = generateScientificRulesFallback(req.body?.question || '', req.body?.context);
      res.json({
        answer: fallback || "I'm having trouble connecting right now. Please try again in a moment.",
        source: 'AirGuard AI',
      });
    }
  });

  // Server-side Gemini Multimodal Photo Analysis Endpoint
  app.post('/api/gemini/analyze-photo', async (req, res) => {
    try {
      const { imageBase64, context } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "We couldn't analyze this image. Please try another photo." });
      }

      if (!ai) {
        return res.status(503).json({ error: "We couldn't analyze this image. Please try another photo." });
      }

      // Parse base64 and mime type safely
      let mimeType = 'image/jpeg';
      let rawData = imageBase64;
      if (imageBase64.includes(';base64,')) {
        const parts = imageBase64.split(';base64,');
        const match = parts[0].match(/data:(.*?)$/);
        if (match) {
          mimeType = match[1];
        }
        rawData = parts[1];
      }

      const systemInstruction = `You are the AirGuard AI Environmental Vision Specialist.
Analyze the user's submitted photograph in the context of ambient air quality, environmental conditions, and visible physical or atmospheric observations.

VISUAL OBSERVATION GUIDELINES:
1. For environmental or pollution-related images, identify visible features such as:
   - Haze, smog, or reduced visibility
   - Smoke-like appearance or emissions
   - Dust or particulate accumulation
   - Visible environmental and weather conditions (cloud cover, sunlight, horizon clarity)
   - Other relevant visual observations
2. For health-related images (e.g. skin, eye surface, throat):
   - You must NOT diagnose any disease, illness, clinical condition, or medical disorder.
   - You must NOT claim that any visible symptom was definitely caused by pollution or environmental factors.
   - You MUST use cautious language such as:
     * "This image may show..."
     * "Possible environmental contributors include..."
     * "An image alone cannot determine the exact cause."
3. If an image is unclear, blurry, or unrelated, describe what is visible and state clearly what cannot be determined.

RESPONSE REQUIREMENTS:
Return structured JSON with:
- visibleContent: An objective description of what is visible in the image (identifying haze, smoke, dust, environmental features, or visible surface features).
- environmentalObservations: Visible environmental, haze, particulate, or atmospheric observations correlating visible elements with the user's ambient air quality telemetry.
- potentialFactors: Possible non-diagnostic environmental contributors using the required cautious language ("This image may show...", "Possible environmental contributors include...", "An image alone cannot determine the exact cause.").
- precautions: 3 to 4 practical, non-diagnostic protective precautions (e.g. clean saline rinse, gentle cleansing, barrier support, limiting outdoor exertion during peak pollution, consulting a healthcare professional if irritation persists).`;

      const promptText = `Ambient Air Quality Context:
Location: ${context?.locationName || 'Current Location'}
Current AQI: ${context?.aqi || 'N/A'} (${context?.category || 'N/A'}, US AQI)
Dominant Pollutant: ${context?.dominantPollutant || 'N/A'}
PM2.5: ${context?.pollutants?.pm2_5 ?? 'N/A'} µg/m³
PM10: ${context?.pollutants?.pm10 ?? 'N/A'} µg/m³
Ozone (O3): ${context?.pollutants?.o3 ?? 'N/A'} µg/m³
Nitrogen Dioxide (NO2): ${context?.pollutants?.no2 ?? 'N/A'} µg/m³
User Stated Concern: ${context?.userConcern || 'Visual reference assessment'}

Analyze the attached image and return the structured assessment.`;

      // Use gemini-3.1-flash-lite for responsive multimodal image reasoning
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: rawData,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              visibleContent: {
                type: Type.STRING,
                description: 'Objective description of what is visible in the image.',
              },
              environmentalObservations: {
                type: Type.STRING,
                description: 'Visible environmental or air-quality observations relevant to the image and location telemetry.',
              },
              potentialFactors: {
                type: Type.STRING,
                description: 'Non-diagnostic potential contributors using mandatory phrasing (This may be consistent with..., Possible environmental contributors include..., The image alone cannot determine the cause).',
              },
              precautions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Appropriate protective precautions when relevant.',
              },
            },
            required: ['visibleContent', 'environmentalObservations', 'potentialFactors', 'precautions'],
          },
        },
      });

      const jsonText = response.text;
      if (!jsonText) {
        throw new Error('Empty response from vision model');
      }

      const parsed = JSON.parse(jsonText);
      res.json({
        result: parsed,
        source: 'gemini-3.1-flash-lite',
      });
    } catch (err: any) {
      console.error('Vision analysis error:', err);
      res.status(500).json({
        error: "We couldn't analyze this image. Please try another photo.",
        details: err?.message,
      });
    }
  });

  // Server-side Real Healthcare Facilities Search Proxy
  const healthcareCache = new Map<string, { facilities: any[]; timestamp: number }>();
  app.get('/api/healthcare', async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const radiusKm = parseFloat(req.query.radius as string) || 10;

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: 'Valid lat and lon query parameters required' });
      }

      const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}_${radiusKm}`;
      const cached = healthcareCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3600000) {
        return res.json({ facilities: cached.facilities, source: 'cached' });
      }

      // Delta bounds in degrees
      const latDelta = radiusKm / 111;
      const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
      const left = lon - lonDelta;
      const bottom = lat - latDelta;
      const right = lon + lonDelta;
      const top = lat + latDelta;

      const url = `https://nominatim.openstreetmap.org/search?q=hospital&format=json&viewbox=${left.toFixed(4)},${top.toFixed(4)},${right.toFixed(4)},${bottom.toFixed(4)}&bounded=1&limit=25&addressdetails=1&extratags=1`;

      const osmRes = await fetch(url, {
        headers: {
          'User-Agent': 'AirGuard-AI/1.0 (contact@airguard.app; Environmental Intelligence)',
          'Accept': 'application/json',
        },
      });

      if (!osmRes.ok) {
        return res.status(502).json({ error: 'External healthcare registry unavailable' });
      }

      const items: any[] = await osmRes.json();
      if (!Array.isArray(items)) {
        return res.json({ facilities: [] });
      }

      const facilities = items
        .map((item) => {
          const itemLat = parseFloat(item.lat);
          const itemLon = parseFloat(item.lon);
          if (isNaN(itemLat) || isNaN(itemLon)) return null;

          // Ignore transit stops or unrelated objects named 'hospital'
          if (item.class === 'highway' || item.type === 'bus_stop') return null;

          const name = item.name || item.display_name?.split(',')[0]?.trim();
          if (!name || name.length < 2 || name.toLowerCase() === 'hospital') return null;

          // Haversine distance
          const R = 6371;
          const dLat = ((itemLat - lat) * Math.PI) / 180;
          const dLon = ((itemLon - lon) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat * Math.PI) / 180) *
              Math.cos((itemLat * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceKm = Math.round(R * c * 10) / 10;

          const typeLower = (item.type || item.class || '').toLowerCase();
          const nameLower = name.toLowerCase();

          let facilityType = 'hospital';
          if (nameLower.includes('urgent') || typeLower.includes('urgent')) {
            facilityType = 'urgent_care';
          } else if (nameLower.includes('pulmon') || nameLower.includes('respirat') || nameLower.includes('chest')) {
            facilityType = 'respiratory_clinic';
          } else if (typeLower.includes('clinic') || nameLower.includes('clinic')) {
            facilityType = 'respiratory_clinic';
          } else if (nameLower.includes('health') || nameLower.includes('medical center')) {
            facilityType = 'medical_center';
          }

          const isEmergency =
            facilityType === 'hospital' ||
            item.extratags?.emergency === 'yes' ||
            nameLower.includes('emergency') ||
            nameLower.includes('trauma');

          const realPhone = item.extratags?.phone || item.extratags?.['contact:phone'] || undefined;
          const realWebsite = item.extratags?.website || item.extratags?.['contact:website'] || undefined;

          const addrObj = item.address || {};
          const road = addrObj.road || addrObj.suburb || addrObj.neighbourhood || '';
          const city = addrObj.city || addrObj.town || addrObj.county || addrObj.state || '';
          const address = [road, city].filter(Boolean).join(', ') || item.display_name;

          return {
            id: `osm_${item.place_id || item.osm_id}`,
            name,
            type: facilityType,
            distanceKm,
            address,
            latitude: itemLat,
            longitude: itemLon,
            emergencyAvailable: isEmergency,
            contactNumber: realPhone,
            website: realWebsite,
            specialty: isEmergency
              ? 'Emergency Services & Acute Inpatient Care'
              : 'Outpatient Care & Consultation',
          };
        })
        .filter(Boolean);

      facilities.sort((a: any, b: any) => a.distanceKm - b.distanceKm);

      healthcareCache.set(cacheKey, { facilities, timestamp: Date.now() });
      res.json({ facilities, source: 'OpenStreetMap Nominatim Verified' });
    } catch (err: any) {
      console.error('Healthcare search error:', err);
      res.status(500).json({ error: 'Failed to search healthcare facilities' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AirGuard AI server running on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
