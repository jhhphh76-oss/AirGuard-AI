import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Shield,
  Smartphone,
} from 'lucide-react';

interface HealthCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelected: (photoDataUrl: string, fileBlob?: Blob) => void;
}

type CameraState =
  | 'idle'
  | 'requesting'
  | 'streaming'
  | 'captured'
  | 'permission_denied'
  | 'unavailable'
  | 'error';

export const HealthCameraModal: React.FC<HealthCameraModalProps> = ({
  isOpen,
  onClose,
  onPhotoSelected,
}) => {
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Stop all active media tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('Error stopping camera tracks:', err);
      }
      streamRef.current = null;
    }
  }, []);

  // Clean shutdown when modal closes
  const handleClose = useCallback(() => {
    stopStream();
    setCapturedImage(null);
    setCapturedBlob(null);
    setCameraState('idle');
    setErrorMessage('');
    onClose();
  }, [stopStream, onClose]);

  // Start device camera using navigator.mediaDevices.getUserMedia({ video: true })
  const startCamera = useCallback(async () => {
    stopStream();
    setCapturedImage(null);
    setCapturedBlob(null);

    // 1. Verify browser supports getUserMedia
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      console.warn('getUserMedia is unsupported in this environment');
      setCameraState('unavailable');
      setErrorMessage('Camera unavailable. You can upload an image instead.');
      return;
    }

    setCameraState('requesting');
    setErrorMessage('');

    try {
      // 2. Request camera with fallback timeout to prevent permanent "Opening Camera"
      const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: true,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('CAMERA_TIMEOUT'));
        }, 5000);
      });

      const stream = await Promise.race([cameraPromise, timeoutPromise]);

      streamRef.current = stream;
      setCameraState('streaming');
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      const errName = err?.name || '';
      const errMsg = err?.message || '';

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraState('permission_denied');
        setErrorMessage('Camera permission denied. You can upload an image instead.');
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errName === 'OverconstrainedError' ||
        errMsg === 'CAMERA_TIMEOUT'
      ) {
        setCameraState('unavailable');
        setErrorMessage('Camera unavailable. You can upload an image instead.');
      } else {
        setCameraState('error');
        setErrorMessage(
          err?.message ? `Camera error: ${err.message}` : 'Camera unavailable. You can upload an image instead.'
        );
      }
    }
  }, [stopStream]);

  // Attach stream to video element when streaming state is reached
  useEffect(() => {
    if (cameraState === 'streaming' && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch((playErr) => {
        console.warn('Video playback delayed or prevented:', playErr);
      });
    }
  }, [cameraState]);

  // Automatically start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  // Capture video frame to canvas and store image
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        stopStream();
        setCapturedImage(dataUrl);
        setCapturedBlob(blob);
        setCameraState('captured');
      },
      'image/jpeg',
      0.9
    );
  };

  // File upload fallback handler (from gallery or native camera picker)
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        stopStream();
        onPhotoSelected(dataUrl, file);
        handleClose();
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  // Confirm captured photo selection
  const handleUsePhoto = () => {
    if (capturedImage) {
      onPhotoSelected(capturedImage, capturedBlob || undefined);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-[420px] bg-[#071A24] border border-[#263238] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-[#263238] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/30 text-[#06B6D4] border border-[#0F766E]/40">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 id="camera-modal-title" className="text-sm font-bold text-white">
                Take Photo
              </h2>
              <p className="text-[10px] text-slate-400">Environmental Visual Reference</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Close camera"
            aria-label="Close camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Inputs for fallback options */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          aria-hidden="true"
        />
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
          aria-hidden="true"
        />

        {/* Viewport / Stage Container */}
        <div className="p-4 flex-1 flex flex-col justify-center items-center bg-[#051017] min-h-[320px] relative overflow-hidden">
          {/* Live Camera View */}
          {cameraState === 'streaming' && (
            <div className="w-full h-[320px] relative rounded-2xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay */}
              <div className="absolute inset-4 border border-white/20 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-t-2 border-l-2 border-[#06B6D4]" />
                  <span className="w-3 h-3 border-t-2 border-r-2 border-[#06B6D4]" />
                </div>
                <div className="flex justify-between">
                  <span className="w-3 h-3 border-b-2 border-l-2 border-[#06B6D4]" />
                  <span className="w-3 h-3 border-b-2 border-r-2 border-[#06B6D4]" />
                </div>
              </div>
            </div>
          )}

          {/* Captured Image Review */}
          {cameraState === 'captured' && capturedImage && (
            <div className="w-full h-[320px] relative rounded-2xl overflow-hidden border border-[#06B6D4]/50 shadow-xl bg-black">
              <img
                src={capturedImage}
                alt="Captured visual reference"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-2 left-2 bg-[#071A24]/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-[#5EEAD4] border border-[#0F766E]/40">
                Photo Captured
              </span>
            </div>
          )}

          {/* Loading / Requesting State (Protected by 5-sec timeout) */}
          {cameraState === 'requesting' && (
            <div className="text-center space-y-3 py-10 px-4">
              <div className="p-3.5 rounded-2xl bg-[#0F766E]/20 text-[#06B6D4] mx-auto w-fit animate-spin border border-[#0F766E]/40">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Opening Camera</p>
                <p className="text-xs text-slate-400">
                  Requesting device video access...
                </p>
              </div>
            </div>
          )}

          {/* Permission Denied State */}
          {cameraState === 'permission_denied' && (
            <div className="text-center space-y-3 py-6 px-4 max-w-xs">
              <div className="p-3 rounded-2xl bg-[#F59E0B]/20 text-[#F59E0B] mx-auto w-fit border border-[#F59E0B]/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Camera Permission Denied</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Camera unavailable. You can upload an image instead.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Image Instead</span>
                </button>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-[#38BDF8]" />
                  <span>Device Camera App</span>
                </button>
              </div>
            </div>
          )}

          {/* Unavailable / Timeout / Unsupported State */}
          {(cameraState === 'unavailable' || cameraState === 'error') && (
            <div className="text-center space-y-3 py-6 px-4 max-w-xs">
              <div className="p-3 rounded-2xl bg-slate-800 text-slate-400 mx-auto w-fit border border-slate-700">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Camera Unavailable</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {errorMessage || 'Camera unavailable. You can upload an image instead.'}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Image Instead</span>
                </button>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-[#38BDF8]" />
                  <span>Device Camera App</span>
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white text-xs transition-colors"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Privacy Notice */}
        <div className="px-4 py-2 bg-[#09212D] border-t border-[#263238] flex items-center gap-2 text-[10px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
          <span>
            Photos are stored locally in your session and passed securely to Gemini for analysis.
          </span>
        </div>

        {/* Modal Controls / Actions Footer */}
        <div className="p-3 bg-[#071A24] border-t border-[#263238] flex items-center justify-between gap-2">
          {cameraState === 'streaming' && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="flex-1 py-3 px-4 rounded-xl bg-[#06B6D4] hover:bg-[#06B6D4]/80 text-[#071A24] font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Photo</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="py-2.5 px-3 rounded-xl text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </>
          )}

          {cameraState === 'captured' && (
            <>
              <button
                type="button"
                onClick={startCamera}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Use This Photo</span>
              </button>
            </>
          )}

          {cameraState !== 'streaming' && cameraState !== 'captured' && (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
