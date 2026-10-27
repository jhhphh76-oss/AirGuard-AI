import React, { useState } from 'react';
import { X, Camera, Trash2, Calendar, MapPin, Layers } from 'lucide-react';
import { ResearchMeasurementRecord, SpectralCube } from '../../services/research/types';
import { ResearchVisualizationCard } from './ResearchVisualizationCard';
import { researchAnalysisService } from '../../services/research/researchAnalysisService';
import { spectralDataService } from '../../services/research/spectralDataService';

interface ResearchMeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ResearchMeasurementRecord | null;
  onRecordUpdated?: () => void;
  onRecordDeleted?: () => void;
}

export const ResearchMeasurementModal: React.FC<ResearchMeasurementModalProps> = ({
  isOpen,
  onClose,
  record,
  onRecordUpdated,
  onRecordDeleted,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!isOpen || !record) return null;

  // Reconstruct spectral cube for visualization
  const reconstructedCube: SpectralCube = {
    width: 64,
    height: 64,
    bands: [
      { id: 'band_1', nominalWavelengthNm: 450, label: 'Band 1', isSimulated: true },
      { id: 'band_2', nominalWavelengthNm: 500, label: 'Band 2', isSimulated: true },
      { id: 'band_3', nominalWavelengthNm: 530, label: 'Band 3', isSimulated: true },
      { id: 'band_4', nominalWavelengthNm: 580, label: 'Band 4', isSimulated: true },
      { id: 'band_5', nominalWavelengthNm: 620, label: 'Band 5', isSimulated: true },
      { id: 'band_6', nominalWavelengthNm: 660, label: 'Band 6', isSimulated: true },
    ],
    isSimulation: true,
    hardwareLabel: record.sourceType,
    capturedAt: record.timestamp,
  };

  const handleDeleteRecord = () => {
    researchAnalysisService.deleteMeasurement(record.id);
    setShowConfirmDelete(false);
    onClose();
    if (onRecordDeleted) onRecordDeleted();
  };

  const handleDeletePhoto = () => {
    researchAnalysisService.deleteImageForMeasurement(record.id);
    if (onRecordUpdated) onRecordUpdated();
  };

  const recordDate = new Date(record.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const recordTime = new Date(record.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-[#071A24] border border-[#263238] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#263238] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/30 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="record-detail-title" className="text-sm font-bold text-white truncate">
                Research Measurement #{record.sessionIndex}
              </h2>
              <p className="text-[10px] text-slate-400 truncate">
                {recordDate} at {recordTime} · {record.location?.name || 'Local Site'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Facial Image Preview if retained */}
          {record.imageDataUrl && (
            <div className="relative w-full aspect-video max-h-48 bg-black rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center shadow-inner">
              <img
                src={record.imageDataUrl}
                alt="Captured facial target"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[9px] font-mono text-[#5EEAD4] border border-[#0F766E]">
                {record.acquisitionMode === 'live_camera' ? 'Live Camera' : 'Gallery Upload'}
              </div>
            </div>
          )}

          {/* Full Research Visualization Component */}
          <ResearchVisualizationCard
            cube={reconstructedCube}
            regionalFeatures={record.opticalFeatures}
            environmental={record.environmentalMeasurements}
            calibration={record.calibration}
            hardware={spectralDataService.getHardwareStatus()}
            interpretation={record.analysis}
            imageQuality={record.imageQuality}
            timeAlignment={record.timeAlignment}
            baselineComparison={record.baselineComparison}
            dataQuality={record.dataQuality}
            dataStatus={record.dataStatus}
            onDeleteImage={record.imageDataUrl ? handleDeletePhoto : undefined}
            imageDataUrl={record.imageDataUrl}
          />

          {/* Delete Record Confirmation / Button */}
          <div className="pt-2 border-t border-slate-800">
            {showConfirmDelete ? (
              <div className="p-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-xs text-white space-y-2">
                <span className="font-bold text-[#EF4444] block">
                  Permanently delete this measurement?
                </span>
                <p className="text-[11px] text-slate-300">
                  This action cannot be undone. Any baseline references to this measurement will be cleared.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteRecord}
                    className="px-3 py-1.5 rounded-xl bg-[#EF4444] hover:bg-[#EF4444]/80 text-white text-xs font-bold"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-[#EF4444]/15 hover:border-[#EF4444]/40 border border-slate-800 text-slate-400 hover:text-[#EF4444] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Research Measurement</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#071A24] border-t border-[#263238] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
