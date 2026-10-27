/**
 * AirGuard AI - Optical Feature Extraction Service
 * 
 * Pipeline step: Spectral Cube + Segmentation -> Regional Optical Features
 * 
 * Computes:
 * - Reflectance by wavelength
 * - Relative spectral differences (Red/Green ratio, Blue Index)
 * - Regional mean reflectance (normalized via calibration)
 * - Regional variation (standard deviation)
 * - Neutral labels: "Low variation" | "Moderate variation" | "Higher variation" | "Insufficient data"
 * - Language strictly avoids diagnostic claims (e.g. "Optical variation observed", never "Pollution damage detected")
 */

import {
  FaceRegion,
  RegionalOpticalFeatures,
  SpectralCube,
  VariationCategory,
} from './types';
import { SegmentationResult } from './faceSegmentationService';
import { calibrationService } from './calibrationService';

class FeatureExtractionService {
  /**
   * Extract independent optical features across all 5 research regions
   */
  public extractFeatures(
    cube: SpectralCube,
    segmentation: SegmentationResult
  ): Record<FaceRegion, RegionalOpticalFeatures> {
    const regionKeys: FaceRegion[] = [
      'forehead',
      'left_cheek',
      'right_cheek',
      'nose',
      'chin',
    ];

    const result: Partial<Record<FaceRegion, RegionalOpticalFeatures>> = {};

    regionKeys.forEach((key) => {
      const bounds = segmentation.regions[key];

      // If segmentation is not confident, mark as Insufficient Data
      if (!segmentation.isConfident) {
        result[key] = {
          region: key,
          regionLabel: bounds.label,
          meanReflectance: 0,
          variationScore: 0,
          variationCategory: 'Insufficient data',
          relativeSpectralDifferences: {
            redGreenRatio: 0,
            blueIndex: 0,
            contrastUniformity: 0,
          },
          wavelengthReflectances: cube.bands.map((b) => ({
            wavelengthNm: b.nominalWavelengthNm,
            reflectance: 0,
            bandLabel: b.label,
          })),
          confidence: segmentation.confidenceScore,
          boundingBox: {
            x: Math.round(bounds.xRatio * cube.width),
            y: Math.round(bounds.yRatio * cube.height),
            width: Math.round(bounds.widthRatio * cube.width),
            height: Math.round(bounds.heightRatio * cube.height),
          },
        };
        return;
      }

      // Compute regional coordinates inside cube grid
      const startX = Math.floor(bounds.xRatio * cube.width);
      const startY = Math.floor(bounds.yRatio * cube.height);
      const regionW = Math.max(2, Math.floor(bounds.widthRatio * cube.width));
      const regionH = Math.max(2, Math.floor(bounds.heightRatio * cube.height));

      // Calculate wavelength reflectances
      const wavelengthReflectances = cube.bands.map((band) => {
        let sum = 0;
        let count = 0;
        const grid = band.intensityGrid;

        if (grid) {
          for (let y = startY; y < startY + regionH && y < cube.height; y++) {
            for (let x = startX; x < startX + regionW && x < cube.width; x++) {
              const idx = y * cube.width + x;
              sum += grid[idx] || 0;
              count++;
            }
          }
        }

        const rawMean = count > 0 ? sum / count : 0.5;
        // Normalize using calibration standard
        const normalized = calibrationService.normalizeSample(rawMean * 255.0);

        return {
          wavelengthNm: band.nominalWavelengthNm,
          reflectance: normalized,
          bandLabel: band.label,
        };
      });

      // Overall regional mean reflectance
      const meanReflectance =
        wavelengthReflectances.reduce((acc, item) => acc + item.reflectance, 0) /
        wavelengthReflectances.length;

      // Regional variation score (spatial standard deviation across green channel 530nm)
      const greenBand = cube.bands.find((b) => b.nominalWavelengthNm === 530) || cube.bands[2];
      let varianceSum = 0;
      let pixelCount = 0;

      if (greenBand?.intensityGrid) {
        const grid = greenBand.intensityGrid;
        const gMean =
          wavelengthReflectances.find((w) => w.wavelengthNm === 530)?.reflectance ??
          meanReflectance;

        for (let y = startY; y < startY + regionH && y < cube.height; y++) {
          for (let x = startX; x < startX + regionW && x < cube.width; x++) {
            const idx = y * cube.width + x;
            const diff = (grid[idx] || 0) - gMean;
            varianceSum += diff * diff;
            pixelCount++;
          }
        }
      }

      const variationScore =
        pixelCount > 1 ? Math.sqrt(varianceSum / pixelCount) : 0.05;

      // Neutral variation categorization
      let variationCategory: VariationCategory = 'Low variation';
      if (variationScore >= 0.14) {
        variationCategory = 'Higher variation';
      } else if (variationScore >= 0.07) {
        variationCategory = 'Moderate variation';
      }

      // Relative spectral differences
      const red = wavelengthReflectances.find((w) => w.wavelengthNm === 620)?.reflectance || 0.6;
      const green = wavelengthReflectances.find((w) => w.wavelengthNm === 530)?.reflectance || 0.5;
      const blue = wavelengthReflectances.find((w) => w.wavelengthNm === 450)?.reflectance || 0.4;

      const redGreenRatio = green > 0.01 ? Math.round((red / green) * 100) / 100 : 1.0;
      const blueIndex = Math.round((blue / (red + green + blue + 0.001)) * 100) / 100;
      const contrastUniformity = Math.round((1 - Math.min(1, variationScore * 4)) * 100) / 100;

      result[key] = {
        region: key,
        regionLabel: bounds.label,
        meanReflectance: Math.round(meanReflectance * 1000) / 1000,
        variationScore: Math.round(variationScore * 1000) / 1000,
        variationCategory,
        relativeSpectralDifferences: {
          redGreenRatio,
          blueIndex,
          contrastUniformity,
        },
        wavelengthReflectances,
        confidence: segmentation.confidenceScore,
        boundingBox: {
          x: startX,
          y: startY,
          width: regionW,
          height: regionH,
        },
      };
    });

    return result as Record<FaceRegion, RegionalOpticalFeatures>;
  }
}

export const featureExtractionService = new FeatureExtractionService();
