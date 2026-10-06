/**
 * AirGuard AI - Spectral Data Cube Service
 * 
 * Pipeline step: Multispectral Image Acquisition -> Spectral Image Cube (X × Y × wavelength)
 * 
 * Rules:
 * - Represents spectral data conceptually as X × Y × wavelength.
 * - Each wavelength band contains its own image plane.
 * - Architecture supports: Band 1, Band 2, Band 3 ... Band N.
 * - When physical multispectral hardware is not connected, labels remain "Band 1", "Band 2" etc.
 * - Never pretends a smartphone camera is a physical multispectral sensor.
 * - Clearly labels acquisition: "MULTISPECTRAL HARDWARE NOT CONNECTED".
 * - Never fabricates NIR or unmeasured wavelengths.
 */

import { SpectralCube, WavelengthBand, HardwareStatus } from './types';

class SpectralDataService {
  /**
   * Get current hardware connection status
   */
  public getHardwareStatus(): HardwareStatus {
    return {
      cameraConnected: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
      multispectralSensorConnected: false,
      polarizerConnected: false,
      prototypeStage: 'P3',
      polarizerStatusLabel: 'Standard Camera Optical Analysis',
      polarizerExplanation:
        'Optical evaluation runs directly using device camera without external hardware dependencies.',
      hardwareNotice: 'SOFTWARE OPTICAL ENGINE ACTIVE',
    };
  }

  /**
   * Render a visual monochrome/pseudocolor thumbnail preview of a 2D intensity grid
   */
  private renderBandThumbnail(
    grid: Float32Array,
    width: number,
    height: number,
    colorR = 255,
    colorG = 255,
    colorB = 255
  ): string {
    try {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) return '';
      const imgData = ctx.createImageData(width, height);
      const data = imgData.data;
      const count = width * height;

      for (let i = 0; i < count; i++) {
        const val = Math.max(0, Math.min(1.0, grid[i] || 0));
        data[i * 4] = Math.round(val * colorR);
        data[i * 4 + 1] = Math.round(val * colorG);
        data[i * 4 + 2] = Math.round(val * colorB);
        data[i * 4 + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);
      return c.toDataURL('image/jpeg', 0.85);
    } catch {
      return '';
    }
  }

  /**
   * Construct Spectral Image Cube (X × Y × wavelength) from captured optical image
   * Generates Band 1 through Band 6 with intensity planes and thumbnail slice previews
   */
  public generateSpectralCubeFromCanvas(
    canvas: HTMLCanvasElement,
    width = 64,
    height = 64
  ): SpectralCube {
    const processingCanvas = document.createElement('canvas');
    processingCanvas.width = width;
    processingCanvas.height = height;
    const ctx = processingCanvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Canvas 2D context unavailable for spectral processing');
    }

    ctx.drawImage(canvas, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;
    const pixelCount = width * height;

    // Six visible optical bands (Band 1 to Band 6)
    const band1 = new Float32Array(pixelCount); // Visible Blue nominal ~450nm
    const band2 = new Float32Array(pixelCount); // Visible Cyan-Green nominal ~500nm
    const band3 = new Float32Array(pixelCount); // Visible Green nominal ~530nm
    const band4 = new Float32Array(pixelCount); // Visible Amber-Yellow nominal ~580nm
    const band5 = new Float32Array(pixelCount); // Visible Red nominal ~620nm
    const band6 = new Float32Array(pixelCount); // Visible Deep Red nominal ~660nm

    for (let i = 0; i < pixelCount; i++) {
      const idx = i * 4;
      const r = pixels[idx] / 255.0;
      const g = pixels[idx + 1] / 255.0;
      const b = pixels[idx + 2] / 255.0;

      band1[i] = b;
      band2[i] = 0.5 * g + 0.5 * b;
      band3[i] = g;
      band4[i] = 0.5 * r + 0.5 * g;
      band5[i] = r;
      band6[i] = Math.max(0, r * 1.05 - 0.05 * g);
    }

    const bands: WavelengthBand[] = [
      {
        id: 'band_1',
        nominalWavelengthNm: 450,
        label: 'Band 1',
        isSimulated: true,
        intensityGrid: band1,
        thumbnailUrl: this.renderBandThumbnail(band1, width, height, 56, 189, 248),
      },
      {
        id: 'band_2',
        nominalWavelengthNm: 500,
        label: 'Band 2',
        isSimulated: true,
        intensityGrid: band2,
        thumbnailUrl: this.renderBandThumbnail(band2, width, height, 6, 182, 212),
      },
      {
        id: 'band_3',
        nominalWavelengthNm: 530,
        label: 'Band 3',
        isSimulated: true,
        intensityGrid: band3,
        thumbnailUrl: this.renderBandThumbnail(band3, width, height, 34, 197, 94),
      },
      {
        id: 'band_4',
        nominalWavelengthNm: 580,
        label: 'Band 4',
        isSimulated: true,
        intensityGrid: band4,
        thumbnailUrl: this.renderBandThumbnail(band4, width, height, 245, 158, 11),
      },
      {
        id: 'band_5',
        nominalWavelengthNm: 620,
        label: 'Band 5',
        isSimulated: true,
        intensityGrid: band5,
        thumbnailUrl: this.renderBandThumbnail(band5, width, height, 239, 68, 68),
      },
      {
        id: 'band_6',
        nominalWavelengthNm: 660,
        label: 'Band 6',
        isSimulated: true,
        intensityGrid: band6,
        thumbnailUrl: this.renderBandThumbnail(band6, width, height, 185, 28, 28),
      },
    ];

    return {
      width,
      height,
      bands,
      isSimulation: true,
      hardwareLabel: 'RGB optical image — multispectral hardware unavailable',
      capturedAt: Date.now(),
    };
  }
}

export const spectralDataService = new SpectralDataService();
