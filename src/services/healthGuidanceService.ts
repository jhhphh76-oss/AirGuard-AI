import { AQIReading } from '../types/airguard';

export type SymptomType =
  | 'Eye irritation'
  | 'Skin irritation'
  | 'Throat irritation'
  | 'Sneezing'
  | 'Coughing'
  | 'Breathing discomfort'
  | 'Headache'
  | 'Nausea'
  | 'Fatigue / low energy'
  | 'Other concern'
  | 'General pollution exposure'
  | 'No symptoms — check air';

export interface SymptomOption {
  id: SymptomType;
  label: string;
  category: 'mucosal' | 'respiratory' | 'systemic' | 'general';
}

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  { id: 'Eye irritation', label: 'Eye irritation', category: 'mucosal' },
  { id: 'Skin irritation', label: 'Skin irritation', category: 'mucosal' },
  { id: 'Throat irritation', label: 'Throat irritation', category: 'mucosal' },
  { id: 'Sneezing', label: 'Sneezing', category: 'respiratory' },
  { id: 'Coughing', label: 'Coughing', category: 'respiratory' },
  { id: 'Breathing discomfort', label: 'Breathing discomfort', category: 'respiratory' },
  { id: 'Headache', label: 'Headache', category: 'systemic' },
  { id: 'Nausea', label: 'Nausea', category: 'systemic' },
  { id: 'Fatigue / low energy', label: 'Fatigue / low energy', category: 'systemic' },
  { id: 'Other concern', label: 'Other concern', category: 'general' },
  { id: 'General pollution exposure', label: 'General pollution exposure', category: 'general' },
  { id: 'No symptoms — check air', label: 'No symptoms — check air', category: 'general' },
];

export interface EnvironmentalGuidance {
  title: string;
  environmentalExplanation: string;
  possibleContributors: string[];
  observedPollutantsStatus: {
    pollutant: string;
    value: string;
    isElevated: boolean;
    note: string;
  }[];
  urgencyWarning?: string;
  actionableSteps: string[];
}

/**
 * Builds non-diagnostic environmental health guidance based on the user's selected
 * symptom and actual measured air quality readings from Open-Meteo.
 */
export function getHealthGuidance(
  symptom: SymptomType,
  reading: AQIReading,
  customConcernText?: string
): EnvironmentalGuidance {
  const { aqi, category, pollutants, indicators } = reading;

  // Evaluate actual measured readings against benchmark thresholds
  const pm25Elevated = pollutants.pm2_5 !== null && pollutants.pm2_5 > 15;
  const pm10Elevated = pollutants.pm10 !== null && pollutants.pm10 > 45;
  const o3Elevated = pollutants.o3 !== null && pollutants.o3 > 60;
  const no2Elevated = pollutants.no2 !== null && pollutants.no2 > 40;
  const so2Elevated = pollutants.so2 !== null && pollutants.so2 > 20;
  const dustElevated = indicators?.dust !== null && indicators.dust !== undefined && indicators.dust > 30;

  // Pollutant statuses with real data verification
  const observedPollutantsStatus = [
    {
      pollutant: 'PM2.5 (Fine)',
      value: pollutants.pm2_5 !== null ? `${pollutants.pm2_5} µg/m³` : 'Not available in current data',
      isElevated: pm25Elevated,
      note: pm25Elevated
        ? 'Elevated fine particles can penetrate deep into airways and alveolar tissue.'
        : 'Currently within lower exposure ranges.',
    },
    {
      pollutant: 'PM10 (Coarse)',
      value: pollutants.pm10 !== null ? `${pollutants.pm10} µg/m³` : 'Not available in current data',
      isElevated: pm10Elevated,
      note: pm10Elevated
        ? 'Elevated coarse particles can settle in the upper respiratory tract and eyes.'
        : 'Within normal ambient bounds.',
    },
    {
      pollutant: 'Ozone (O₃)',
      value: pollutants.o3 !== null ? `${pollutants.o3} µg/m³` : 'Not available in current data',
      isElevated: o3Elevated,
      note: o3Elevated
        ? 'Ground-level ozone can act as a reactive respiratory and mucosal oxidant.'
        : 'Current solar photochemical concentration is low.',
    },
    {
      pollutant: 'Nitrogen Dioxide (NO₂)',
      value: pollutants.no2 !== null ? `${pollutants.no2} µg/m³` : 'Not available in current data',
      isElevated: no2Elevated,
      note: no2Elevated
        ? 'Combustion emissions can irritate bronchial mucosal lining.'
        : 'Traffic emission concentration is within typical baseline.',
    },
    {
      pollutant: 'Sulphur Dioxide (SO₂)',
      value: pollutants.so2 !== null ? `${pollutants.so2} µg/m³` : 'Not available in current data',
      isElevated: so2Elevated,
      note: so2Elevated
        ? 'Acidic gas capable of triggering bronchial constriction.'
        : 'Industrial plume indicators remain low.',
    },
  ];

  // Specific guidance per concern
  switch (symptom) {
    case 'Eye irritation': {
      const contributors: string[] = [];
      if (pm25Elevated || pm10Elevated) contributors.push('Elevated airborne particulate matter (PM2.5 / PM10)');
      if (o3Elevated) contributors.push('Photochemical ground-level ozone');
      if (dustElevated) contributors.push('Airborne dust and mineral particles');
      if (contributors.length === 0) contributors.push('Ambient dry air, pollen, or environmental micro-particles');

      return {
        title: 'Eye Irritation & Environmental Factors',
        environmentalExplanation:
          'Elevated particulate matter or ground-level ozone can be possible environmental contributors to eye irritation by settling on the ocular tear film. Airborne dust and photochemical smog may also increase dryness and stinging sensations, though eye irritation has many non-environmental causes such as screen strain, dryness, and allergies.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Rinse eyes gently with clean water or sterile saline solution if irritation feels particulate-related.',
          'Consider wearing wraparound sunglasses outdoors during windy, high-dust conditions.',
          'Limit rubbing your eyes, as abrasive particles can scratch delicate corneal surfaces.',
          'Rest eyes from digital screens and use lubricating artificial tears if dryness persists.',
        ],
      };
    }

    case 'Skin irritation': {
      const contributors: string[] = [];
      if (pm10Elevated || pm25Elevated) contributors.push('Suspended combustion and road-dust particles');
      if (dustElevated) contributors.push('Mineral dust deposition');
      if (contributors.length === 0) contributors.push('Atmospheric dryness and environmental micro-pollutants');

      return {
        title: 'Skin Irritation & Environmental Exposure',
        environmentalExplanation:
          'Air pollution, coarse dust, and ambient particulate matter can sometimes settle on exposed skin and contribute to surface dryness or minor irritation, especially when relative humidity is low. However, skin irritation frequently stems from dermatological, allergic, or contact triggers, and ambient air is only one potential external factor.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Wash exposed skin, neck, and hands with a gentle cleanser after prolonged outdoor exposure.',
          'Apply an unscented barrier moisturizer to help seal the skin against particulate deposition.',
          'Avoid harsh exfoliants while your skin feels sensitive or irritated.',
          'Consult a dermatologist if redness, hives, or swelling develops or persists.',
        ],
      };
    }

    case 'Throat irritation': {
      const contributors: string[] = [];
      if (pm25Elevated) contributors.push('Inhalable fine particulate matter (PM2.5)');
      if (o3Elevated) contributors.push('Elevated ambient ozone (O₃)');
      if (no2Elevated) contributors.push('Nitrogen dioxide from vehicular emissions');
      if (so2Elevated) contributors.push('Sulphur dioxide (SO₂)');
      if (contributors.length === 0) contributors.push('Dry atmospheric air or background particulate concentrations');

      return {
        title: 'Throat Irritation & Airway Exposure',
        environmentalExplanation:
          'Particulate matter, ozone, nitrogen dioxide, and sulphur dioxide can irritate mucous membranes lining the pharynx and upper airways when elevated, contributing to scratchiness, dryness, or mild soreness. Environmental air is a recognized mucosal irritant, though throat symptoms can also indicate infectious or vocal causes.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Stay well-hydrated with warm water to maintain moist airway mucosal barriers.',
          'Consider wearing an N95/FFP2 respirator along high-traffic routes to filter inhalable particles.',
          'Avoid secondary respiratory irritants such as cigarette smoke, chemical cleaners, and incense.',
          'Gargle with warm salt water to soothe irritated pharyngeal tissues.',
        ],
      };
    }

    case 'Sneezing': {
      const contributors: string[] = [];
      if (pm10Elevated) contributors.push('Coarse inhalable particulate matter (PM10)');
      if (dustElevated) contributors.push('Airborne dust and particulate resuspension');
      contributors.push('Pollen, spores, and aeroallergens');

      return {
        title: 'Sneezing & Nasal Reflexes',
        environmentalExplanation:
          'Airborne particles, coarse dust, pollen, and other environmental irritants can stimulate sensory nerve endings in the nasal mucosa, triggering the sneezing reflex as the upper airway attempts to expel foreign material. Sneezing is a natural protective reflex and may also be tied to seasonal allergic rhinitis.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Keep windows closed during peak windy or dusty hours of the day.',
          'Use a saline nasal spray or gentle nasal rinse to clear trapped particles from nasal passages.',
          'Change clothes and rinse your face after returning indoors from busy roads.',
          'Operate an indoor HEPA air purifier to reduce circulating coarse and fine allergens.',
        ],
      };
    }

    case 'Coughing': {
      const contributors: string[] = [];
      if (pm25Elevated) contributors.push('Deep-penetrating PM2.5 aerosols');
      if (o3Elevated) contributors.push('Oxidative ozone (O₃)');
      if (no2Elevated) contributors.push('Traffic exhaust gases (NO₂)');
      if (contributors.length === 0) contributors.push('General ambient air particulate loading');

      return {
        title: 'Coughing & Airway Defense',
        environmentalExplanation:
          'Inhaled fine and coarse particulate matter, along with reactive atmospheric oxidants such as ozone, can stimulate bronchial cough receptors. While coughing can represent a natural airway clearance mechanism in response to particulate loading, persistent or deep coughing requires medical evaluation to distinguish from respiratory infection or asthma.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Reduce strenuous outdoor exercise while air quality remains elevated.',
          'Sip warm fluids or honey-lemon water to calm sensitive airway reflexes.',
          'Use mechanical HEPA filtration in your main sleeping or living quarters.',
          'Consult a physician if coughing produces colored sputum, persists beyond a few days, or is accompanied by fever.',
        ],
      };
    }

    case 'Breathing discomfort': {
      const contributors: string[] = [];
      if (pm25Elevated) contributors.push('PM2.5 particles depositing in lower alveolar tracts');
      if (o3Elevated) contributors.push('Elevated ground-level ozone causing airway tightness');
      if (no2Elevated) contributors.push('Nitrogen dioxide increasing bronchial reactivity');
      if (contributors.length === 0) contributors.push('General elevated atmospheric pollutant concentration');

      return {
        title: 'Breathing Discomfort & Respiratory Caution',
        environmentalExplanation:
          'Polluted air can increase airway resistance and worsen respiratory irritation or discomfort for some individuals, particularly those with pre-existing bronchial reactivity. However, breathing discomfort can stem from serious acute or chronic cardiovascular and pulmonary conditions that require clinical evaluation.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        urgencyWarning:
          'Important medical caution: If you or someone with you experiences severe shortness of breath, chest pain, wheezing that does not respond to a prescribed inhaler, or bluish lips/fingertips, seek immediate professional emergency medical assistance.',
        actionableSteps: [
          'Stop outdoor physical activities immediately and move into a clean, air-conditioned or filtered indoor space.',
          'If you have a doctor-prescribed asthma or COPD action plan, follow your prescribed medication protocol.',
          'Sit upright in a relaxed posture to ease thoracic chest expansion.',
          'Seek medical attention promptly if breathing does not quickly return to baseline comfort.',
        ],
      };
    }

    case 'Headache': {
      const contributors: string[] = [];
      if (pollutants.co !== null && pollutants.co > 500) contributors.push('Elevated combustion exhaust gases (CO)');
      if (no2Elevated) contributors.push('Traffic exhaust (NO₂)');
      if (pm25Elevated) contributors.push('Particulate matter contributing to sinus irritation');
      if (contributors.length === 0) contributors.push('Environmental stress factors or sensory irritation');

      return {
        title: 'Headache & Environmental Factors',
        environmentalExplanation:
          'Headaches have numerous common causes including dehydration, muscular tension, eye strain, lack of sleep, and stress. When ambient air pollution is elevated, exposure to exhaust gases or nasal sinus congestion from fine particulate inhalation may act as potential contributing environmental factors.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Drink a large glass of water to ensure proper systemic hydration.',
          'Rest in a quiet, dimly lit, well-ventilated indoor room with clean filtered air.',
          'Avoid crowded roadways, idling diesel vehicles, and scented chemical fumes.',
          'Consult a healthcare provider if headaches are unusually sudden, severe, or recurrent.',
        ],
      };
    }

    case 'Nausea': {
      const contributors: string[] = [];
      if (so2Elevated || no2Elevated) contributors.push('Combustion or industrial exhaust gases');
      contributors.push('Non-environmental gastrointestinal or systemic causes');

      return {
        title: 'Nausea & Environmental Exposure',
        environmentalExplanation:
          'Nausea arises from a wide range of gastrointestinal, dietary, metabolic, and inner-ear causes. While intense exposure to noxious industrial fumes or vehicle exhaust can occasionally provoke nausea, ambient air quality is only one potential external factor and should not be assumed as the sole cause.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Move away from any noticeable fuel, vehicle exhaust, or chemical odors into fresh indoor air.',
          'Sip small amounts of clear water, ginger tea, or oral rehydration fluids.',
          'Rest in a comfortable seated or semi-reclined position.',
          'Seek medical evaluation if nausea is accompanied by high fever, severe abdominal pain, or confusion.',
        ],
      };
    }

    case 'Fatigue / low energy': {
      const contributors: string[] = [];
      if (pm25Elevated) contributors.push('Systemic inflammatory burden from fine particulate inhalation');
      if (o3Elevated) contributors.push('Airway oxidation load during daytime peak ozone');
      contributors.push('Sleep quality, physical exertion, hydration, and nutritional factors');

      return {
        title: 'Fatigue, Energy & Environmental Air',
        environmentalExplanation:
          'Feelings of fatigue or low energy have many primary physiological causes, including sleep deficits, nutrition, and daily exertion. When breathing elevated particulate matter or ozone, the respiratory system expends additional energy filtering inhalants, which may be one potential environmental factor contributing to lethargy.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Ensure adequate restorative sleep in an aerated, low-particulate bedroom.',
          'Schedule active physical workouts during hours with cleaner air (such as early mornings).',
          'Keep hydration levels balanced throughout the day.',
          'Consult a physician if persistent fatigue interferes with your normal daily routines.',
        ],
      };
    }

    case 'Other concern': {
      return {
        title: 'Individual Health Concern Context',
        environmentalExplanation: customConcernText
          ? `Regarding "${customConcernText}": Individual sensitivity to air quality varies widely based on age, respiratory baseline, and personal exposure duration. The current measured US AQI of ${aqi} (${category}) provides context on the atmospheric background, though personal symptoms can stem from many non-air-quality causes.`
          : 'Individual sensitivity to air quality varies based on age, respiratory health, and duration of exposure. This environmental assessment connects current air data to general exposure considerations without providing medical diagnosis.',
        possibleContributors: [
          `Current dominant pollutant: ${reading.dominantPollutant}`,
          `Overall atmospheric exposure level: ${category}`,
        ],
        observedPollutantsStatus,
        actionableSteps: [
          'Monitor whether your concern correlates with time spent outdoors in heavy traffic.',
          'Review the measured pollutant levels below to gauge current particulate and gaseous exposure.',
          'Maintain clean indoor air with mechanical HEPA filtration when possible.',
          'Discuss any specific or lingering medical concerns with a licensed healthcare provider.',
        ],
      };
    }

    case 'General pollution exposure': {
      return {
        title: 'General Air Quality Exposure Summary',
        environmentalExplanation: `Current atmospheric conditions in ${reading.location.name} show a US AQI of ${aqi} (${category}), primarily driven by ${reading.dominantPollutant}. Understanding your cumulative daily exposure helps you adjust outdoor activities, commute routes, and indoor ventilation to protect long-term respiratory and cardiovascular well-being.`,
        possibleContributors: [
          `Primary driving pollutant: ${reading.dominantPollutant}`,
          pm25Elevated ? 'PM2.5 elevated above baseline' : 'PM2.5 within moderate thresholds',
          o3Elevated ? 'Elevated daytime ozone' : 'Ozone levels within standard bounds',
        ],
        observedPollutantsStatus,
        actionableSteps: [
          aqi > 100
            ? 'Reduce prolonged or strenuous outdoor cardiovascular exercise during peak pollution hours.'
            : 'Outdoor conditions are generally acceptable for regular physical activities.',
          'Avoid exercising immediately adjacent to busy arterial roadways and diesel transport corridors.',
          'Ventilate living spaces during afternoon breezy hours when morning thermal inversions have lifted.',
          'Check the 72-hour AI Forecast tab to plan cleaner-air windows for outdoor commitments.',
        ],
      };
    }

    case 'No symptoms — check air': {
      return {
        title: 'Preventive Air Quality Check',
        environmentalExplanation:
          "You don't need to have symptoms to check air quality. Proactively monitoring atmospheric conditions helps you maintain optimal respiratory health, schedule outdoor workouts, and implement protective ventilation habits before airborne irritants accumulate in your respiratory tract.",
        possibleContributors: [
          `Active location: ${reading.location.name}`,
          `Current Air Quality Index: ${aqi} US AQI (${category})`,
          `Dominant factor: ${reading.dominantPollutant}`,
        ],
        observedPollutantsStatus,
        actionableSteps: [
          aqi <= 50
            ? 'Air quality is satisfactory — great time for outdoor exercise, walking, and natural indoor ventilation.'
            : aqi <= 100
            ? 'Air quality is acceptable for most; unusually sensitive individuals should consider taking occasional rest breaks.'
            : 'Air pollution is elevated; consider shifting vigorous outdoor workouts to cleaner-air windows or indoors.',
          'Keep indoor spaces ventilated with clean filtered air.',
          'Stay hydrated throughout the day to support mucosal defense mechanisms.',
        ],
      };
    }
  }
}
