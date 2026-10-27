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
  | 'Check general exposure on face'
  | 'Other concern'
  | 'General pollution exposure'
  | 'No symptoms / just checking air'
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
  { id: 'Check general exposure on face', label: 'Check general exposure on face', category: 'general' },
  { id: 'Other concern', label: 'Other concern', category: 'general' },
  { id: 'No symptoms / just checking air', label: 'No symptoms / just checking air', category: 'general' },
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
  // Big 3 Structure (Requirement 2)
  whyThisMatters: string;
  doList: string[];
  dontList: string[];
  whenToGetHelp: string;
}

/**
 * Builds non-diagnostic environmental health guidance based on the user's selected
 * symptom(s) and actual measured air quality readings from Open-Meteo.
 */
export function getHealthGuidance(
  symptomInput: SymptomType | SymptomType[],
  reading: AQIReading,
  customConcernText?: string
): EnvironmentalGuidance {
  const { aqi, category, pollutants, indicators } = reading;

  // Handle multi-symptom array
  if (Array.isArray(symptomInput)) {
    if (symptomInput.length === 0) {
      return getSingleSymptomGuidance('No symptoms / just checking air', reading, customConcernText);
    }
    if (symptomInput.length === 1) {
      return getSingleSymptomGuidance(symptomInput[0], reading, customConcernText);
    }

    // Filter out "No symptoms" if mixed
    const activeSymptoms = symptomInput.filter(
      (s) => s !== 'No symptoms / just checking air' && s !== 'No symptoms — check air'
    );

    if (activeSymptoms.length === 0) {
      return getSingleSymptomGuidance('No symptoms / just checking air', reading, customConcernText);
    }

    const individualResults = activeSymptoms.map((s) =>
      getSingleSymptomGuidance(s, reading, customConcernText)
    );

    const title = `Reported Concerns: ${activeSymptoms.slice(0, 3).join(', ')}${
      activeSymptoms.length > 3 ? ` +${activeSymptoms.length - 3} more` : ''
    }`;

    const environmentalExplanation = `Current environmental conditions may contribute to irritation or discomfort. Some pollutants can be associated with respiratory or irritation-related symptoms like ${activeSymptoms.join(
      ', '
    )}. Ambient air quality is a possible contributor rather than a proven cause, as non-environmental factors (allergens, indoor dust, viral irritation) can also cause similar symptoms.`;

    const contributorsSet = new Set<string>();
    individualResults.forEach((res) => {
      res.possibleContributors.forEach((c) => contributorsSet.add(c));
    });

    const actionableSet = new Set<string>();
    individualResults.forEach((res) => {
      res.actionableSteps.forEach((step) => actionableSet.add(step));
    });

    const doSet = new Set<string>();
    individualResults.forEach((res) => {
      res.doList?.forEach((d) => doSet.add(d));
    });

    const dontSet = new Set<string>();
    individualResults.forEach((res) => {
      res.dontList?.forEach((d) => dontSet.add(d));
    });

    const urgencyWarning = individualResults.find((res) => res.urgencyWarning)?.urgencyWarning;

    const whyThisMatters = `Current ambient conditions in ${reading.location.name} (AQI ${aqi}, ${category}) with ${reading.dominantPollutant} as primary pollutant may interact with mucous membranes or respiratory pathways. While environmental pollutants can irritate sensitive barriers, reported symptoms may also involve allergies, viral factors, or non-environmental causes.`;

    const whenToGetHelp = urgencyWarning
      ? urgencyWarning
      : 'Seek professional medical advice if your symptoms persist for more than a few days, do not improve in clean indoor air, or if you develop fever, severe pain, or breathing difficulty.';

    return {
      title,
      environmentalExplanation,
      possibleContributors: Array.from(contributorsSet).slice(0, 6),
      observedPollutantsStatus: individualResults[0].observedPollutantsStatus,
      urgencyWarning,
      actionableSteps: Array.from(actionableSet).slice(0, 6),
      whyThisMatters,
      doList: Array.from(doSet).slice(0, 4),
      dontList: Array.from(dontSet).slice(0, 4),
      whenToGetHelp,
    };
  }

  return getSingleSymptomGuidance(symptomInput, reading, customConcernText);
}

function getSingleSymptomGuidance(
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
        whyThisMatters:
          'Elevated particulate matter (PM2.5 / PM10) and ozone can irritate the ocular surface tear film. Airborne dust can cause friction, dryness, and stinging sensations, though eye irritation also commonly stems from screen strain or allergies.',
        doList: [
          'Rinse eyes gently with clean water or sterile saline solution to flush airborne particles.',
          'Wear wraparound sunglasses outdoors during windy or high-dust conditions.',
          'Use lubricating artificial tears to support natural tear-film protection.',
        ],
        dontList: [
          'Avoid rubbing your eyes, as abrasive particles can scratch corneal surfaces.',
          'Avoid wearing soft contact lenses outdoors if eyes are already irritated by smog or dust.',
        ],
        whenToGetHelp:
          'Seek medical attention if you experience severe eye pain, vision changes or blurring, extreme light sensitivity, or persistent thick discharge.',
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
        whyThisMatters:
          'Fine particulates and combustion residue can deposit on exposed skin and disturb the lipid barrier, potentially contributing to localized dryness or itching. However, skin symptoms also frequently stem from contact allergies, eczema, or humidity changes.',
        doList: [
          'Wash exposed facial and neck skin with a mild, soap-free cleanser after outdoor exposure.',
          'Apply an unscented barrier moisturizer to help seal the skin against particulate deposition.',
          'Wear protective clothing or broad-spectrum mineral sunscreen when outdoors in traffic.',
        ],
        dontList: [
          'Avoid aggressive chemical scrubs or hot water while skin feels irritated or sensitized.',
          'Avoid scratching irritated areas, which can break the epidermal barrier and increase infection risk.',
        ],
        whenToGetHelp:
          'Seek medical attention if you develop spreading redness, facial swelling, hives, open sores, or signs of localized infection.',
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
        whyThisMatters:
          'Inhaled fine particles (PM2.5), nitrogen dioxide, and ozone can irritate the mucous membranes of the pharynx, contributing to dryness or scratchiness. Throat soreness can also stem from viral infections or vocal strain.',
        doList: [
          'Stay well hydrated with warm water or herbal teas to lubricate mucosal linings.',
          'Consider wearing a certified N95/FFP2 respirator when commuting along busy roads.',
          'Gargle with warm salt water to soothe sensitive pharyngeal tissue.',
        ],
        dontList: [
          'Avoid exposure to secondary irritants such as tobacco smoke, vaping, or aerosol cleaners.',
          'Avoid clearing your throat forcefully, which can further aggravate vocal cords.',
        ],
        whenToGetHelp:
          'Seek medical attention if you experience difficulty swallowing, breathing trouble, high fever, or throat soreness persisting beyond several days.',
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
        whyThisMatters:
          'Coarse particulate matter (PM10), road dust, and aeroallergens stimulate nasal sensory endings, triggering the sneezing reflex to clear trapped particles from the upper airway. Sneezing is a natural defense reflex that may also reflect allergic rhinitis.',
        doList: [
          'Keep windows closed during windy or high-traffic hours to reduce indoor dust.',
          'Use a sterile saline nasal spray or gentle rinse to clear particles from nasal passages.',
          'Rinse face and change clothing after spending extended time near heavy traffic.',
        ],
        dontList: [
          'Avoid forcefully holding back sneezes, which can create sudden pressure in the ears.',
          'Avoid vacuuming without a HEPA filter when nasal passages are already sensitized.',
        ],
        whenToGetHelp:
          'Seek medical evaluation if sneezing is accompanied by severe facial sinus pain, fever, continuous nosebleeds, or wheezing.',
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
        whyThisMatters:
          'Inhaled fine particles and reactive oxidants like ozone stimulate bronchial cough receptors. Coughing serves as a protective reflex to expel trapped matter, but persistent coughing requires medical attention to rule out infection or asthma.',
        doList: [
          'Reduce strenuous outdoor cardiovascular exercise while air quality is elevated.',
          'Sip warm fluids to soothe hypersensitive airway cough receptors.',
          'Run a mechanical HEPA air purifier in living and sleeping spaces.',
        ],
        dontList: [
          'Avoid outdoor cardio workouts near high-traffic or industrial corridors.',
          'Avoid burning candles, incense, or unvented gas appliances indoors.',
        ],
        whenToGetHelp:
          'Seek prompt medical care if coughing produces blood or rust-colored phlegm, causes chest pain, is accompanied by wheezing, or lasts longer than a week.',
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
        whyThisMatters:
          'Elevated fine particles (PM2.5) and ozone penetrate deep into bronchioles and alveolar tracts, which may contribute to airway constriction and increased breathing effort. Breathing discomfort can indicate acute or chronic cardiovascular or pulmonary conditions requiring clinical evaluation.',
        doList: [
          'Stop outdoor physical activity immediately and rest in a filtered, clean indoor room.',
          'If you have a doctor-prescribed asthma or COPD action plan, follow your prescribed medication instructions.',
          'Sit upright with relaxed shoulders to facilitate thoracic lung expansion.',
        ],
        dontList: [
          'Do not engage in outdoor exercise or strenuous physical exertion.',
          'Do not ignore worsening shortness of breath or rely solely on environmental adjustments.',
        ],
        whenToGetHelp:
          'EMERGENCY: Seek immediate emergency medical care (dial 911 / emergency services) if you experience severe shortness of breath, chest pressure, blue lips or fingers, or wheezing unresponsive to prescribed medication.',
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
        whyThisMatters:
          'Traffic exhaust, combustion gases, and fine particulates can contribute to sinus congestion, olfactory irritation, and systemic fatigue. Headaches also commonly arise from dehydration, screen strain, hunger, or stress.',
        doList: [
          'Drink a full glass of water to ensure systemic hydration.',
          'Rest in a quiet, dimly lit, well-ventilated indoor room with clean filtered air.',
          'Apply a cool compress to your forehead or temples.',
        ],
        dontList: [
          'Avoid walking or exercising alongside heavy diesel traffic or idling vehicles.',
          'Avoid strong artificial fragrances, chemical fumes, or loud environments.',
        ],
        whenToGetHelp:
          'Seek immediate medical care if headache is sudden and unusually severe ("thunderclap"), or accompanied by stiff neck, fever, confusion, weakness, or vision changes.',
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
        whyThisMatters:
          'Exposure to strong exhaust odors, industrial sulfur emissions, or vehicle fumes can trigger olfactory sensory nausea in sensitive individuals. However, nausea predominantly stems from dietary, gastrointestinal, or inner-ear causes rather than ambient air quality.',
        doList: [
          'Move away from fuel, vehicle exhaust, or chemical odors into fresh indoor air.',
          'Sip small amounts of cool water, ginger tea, or electrolyte fluids.',
          'Rest in a comfortable upright or slightly reclined position.',
        ],
        dontList: [
          'Avoid heavy, greasy, or strongly spiced meals while feeling nauseated.',
          'Avoid enclosed spaces with vehicle fumes or solvent vapors.',
        ],
        whenToGetHelp:
          'Seek medical evaluation if nausea is accompanied by severe abdominal pain, high fever, inability to retain fluids for 12 hours, or confusion.',
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
        whyThisMatters:
          'Breathing elevated fine particulates or daytime ozone requires increased metabolic energy for airway clearance and respiratory defense, which may contribute to feelings of lethargy. Fatigue is multifaceted, tied most often to sleep, nutrition, stress, and exertion.',
        doList: [
          'Ensure adequate restorative rest in a HEPA-filtered, clean indoor bedroom.',
          'Schedule physical exertion during cleaner-air hours (typically early morning).',
          'Maintain balanced hydration throughout the day.',
        ],
        dontList: [
          'Avoid pushing through strenuous workouts outdoors when air pollution is elevated.',
          'Avoid relying on excessive caffeine, which can worsen dehydration.',
        ],
        whenToGetHelp:
          'Consult a physician if persistent fatigue lasts more than two weeks or is accompanied by chest pain, unexplained weight loss, or shortness of breath.',
      };
    }

    case 'Check general exposure on face': {
      const contributors: string[] = [];
      if (pm25Elevated || pm10Elevated) contributors.push('Suspended combustion and road particulate matter');
      if (o3Elevated) contributors.push('Photochemical oxidants and ground-level ozone');
      if (dustElevated) contributors.push('Coarse dust and resuspension');
      if (contributors.length === 0) contributors.push('Ambient baseline particulates and environmental micro-pollutants');

      return {
        title: 'Facial Exposure & Environmental Contact',
        environmentalExplanation:
          'Facial skin and mucous membranes have direct, unshielded contact with ambient air. Airborne particles, coarse dust, and oxidants may settle on the skin barrier and ocular tear film, potentially contributing to surface dryness, pore congestion, or minor irritation. A photograph provides observational context and does not prove pollution causation or diagnose clinical disorders.',
        possibleContributors: contributors,
        observedPollutantsStatus,
        actionableSteps: [
          'Gently cleanse facial skin with a mild, soap-free cleanser after outdoor exposure.',
          'Apply an antioxidant or barrier moisturizer to help protect exposed skin surfaces.',
          'Rinse eyes with sterile saline if particulate grittiness is felt.',
          'Review the Research-Style Analysis for detailed observational and scientific context.',
        ],
        whyThisMatters:
          'Facial skin and mucosal membranes (eyes, nose, lips) have direct unshielded contact with ambient air. Coarse particles, combustion soot, and photochemical smog can settle on the skin barrier and ocular surface, potentially contributing to localized dryness, pore congestion, or surface irritation.',
        doList: [
          'Wash face gently with a mild cleanser after returning indoors from outdoor commutes.',
          'Apply an antioxidant or barrier moisturizer to help seal the stratum corneum.',
          'Rinse eyes with clean water or sterile saline if particulate grittiness occurs.',
        ],
        dontList: [
          'Avoid scrubbing facial skin abrasively, which can grind particles into the epidermal layer.',
          'Avoid touching or rubbing face with unwashed hands while in traffic or dusty areas.',
        ],
        whenToGetHelp:
          'Seek medical attention if you develop persistent facial swelling, spreading rash, hives, or painful ocular redness.',
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
        whyThisMatters:
          'Individual sensitivity to ambient air varies based on underlying health, age, and exposure duration. Current air quality provides background context, though personal concerns often involve multiple non-environmental factors.',
        doList: [
          'Monitor whether your symptoms correlate with time spent outdoors near high traffic.',
          'Maintain clean indoor air with mechanical HEPA filtration when possible.',
          'Discuss your concern with the AI Advisor for detailed interactive reasoning.',
        ],
        dontList: [
          'Avoid assuming ambient pollution is the sole cause of symptoms without medical evaluation.',
          'Avoid self-medicating with unprescribed medications.',
        ],
        whenToGetHelp:
          'Discuss any specific, severe, or worsening health concerns with a licensed physician.',
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
        whyThisMatters:
          `Current ambient conditions in ${reading.location.name} reflect an AQI of ${aqi} (${category}) with ${reading.dominantPollutant} as primary pollutant. Understanding cumulative exposure helps you adapt activity timing and ventilation to protect overall wellness.`,
        doList: [
          aqi > 100
            ? 'Shift strenuous cardio workouts to indoor filtered spaces.'
            : 'Enjoy outdoor activities while monitoring peak traffic windows.',
          'Ventilate living spaces during afternoon breezy hours when morning inversions have lifted.',
        ],
        dontList: [
          'Avoid exercising directly alongside congested roadways or industrial corridors.',
          'Avoid leaving windows open during high-pollen or high-dust afternoon hours.',
        ],
        whenToGetHelp:
          'Consult a healthcare provider if you develop unexpected respiratory tightness or chest discomfort during regular physical activities.',
      };
    }

    case 'No symptoms / just checking air':
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
        whyThisMatters:
          'Checking ambient air before outdoor plans helps you maintain optimal respiratory health before airborne irritants accumulate.',
        doList: [
          'Check the 72-hour forecast to pick optimal cleaner-air windows for outdoor runs.',
          'Keep indoor spaces well ventilated with mechanical filtration when outdoor air is dusty.',
        ],
        dontList: [
          'Avoid prolonged heavy exertion next to idling diesel trucks or highway corridors.',
        ],
        whenToGetHelp:
          'Seek medical attention if you ever develop sudden chest tightness, wheezing, or difficulty breathing.',
      };
    }
  }
}
