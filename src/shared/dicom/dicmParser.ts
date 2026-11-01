import * as dicomParserNs from 'dicom-parser';
import type { DicomModality, DicomTagEntry, ExtractedDicomMetadata } from '../types';

const dicomParser: typeof dicomParserNs =
  (dicomParserNs as unknown as { default?: typeof dicomParserNs }).default ?? dicomParserNs;

const KNOWN_TAG_NAMES: Record<string, { name: string; vr: string }> = {
  x00020002: { name: 'Media Storage SOP Class UID', vr: 'UI' },
  x00020003: { name: 'Media Storage SOP Instance UID', vr: 'UI' },
  x00020010: { name: 'Transfer Syntax UID', vr: 'UI' },
  x00020012: { name: 'Implementation Class UID', vr: 'UI' },
  x00020013: { name: 'Implementation Version Name', vr: 'SH' },
  x00080008: { name: 'Tipo de Imagen (ImageType)', vr: 'CS' },
  x00080016: { name: 'SOP Class UID', vr: 'UI' },
  x00080018: { name: 'SOP Instance UID', vr: 'UI' },
  x00080020: { name: 'Fecha del Estudio (StudyDate)', vr: 'DA' },
  x00080030: { name: 'Hora del Estudio (StudyTime)', vr: 'TM' },
  x00080050: { name: 'Número de Acceso (AccessionNumber)', vr: 'SH' },
  x00080060: { name: 'Modalidad (Modality)', vr: 'CS' },
  x00080070: { name: 'Fabricante del Equipo (Manufacturer)', vr: 'LO' },
  x00080080: { name: 'Institución de Origen (InstitutionName)', vr: 'LO' },
  x00080090: { name: 'Médico Referente (ReferringPhysicianName)', vr: 'PN' },
  x00081030: { name: 'Descripción del Estudio (StudyDescription)', vr: 'LO' },
  x0008103e: { name: 'Descripción de la Serie (SeriesDescription)', vr: 'LO' },
  x00100010: { name: 'Nombre del Paciente (PatientName)', vr: 'PN' },
  x00100020: { name: 'ID del Paciente (PatientID)', vr: 'LO' },
  x00100030: { name: 'Fecha de Nacimiento (PatientBirthDate)', vr: 'DA' },
  x00100040: { name: 'Sexo del Paciente (PatientSex)', vr: 'CS' },
  x00180015: { name: 'Región Anatómica (BodyPartExamined)', vr: 'CS' },
  x00180050: { name: 'Espesor de Corte mm (SliceThickness)', vr: 'DS' },
  x00180060: { name: 'Kilovoltaje Pico (KVP)', vr: 'DS' },
  x0020000d: { name: 'Study Instance UID', vr: 'UI' },
  x0020000e: { name: 'Series Instance UID', vr: 'UI' },
  x00200011: { name: 'Número de Serie (SeriesNumber)', vr: 'IS' },
  x00200013: { name: 'Número de Corte / Instancia (InstanceNumber)', vr: 'IS' },
  x00200032: { name: 'Posición de Imagen (ImagePositionPatient)', vr: 'DS' },
  x00280002: { name: 'Muestras por Píxel (SamplesPerPixel)', vr: 'US' },
  x00280004: { name: 'Interpretación Fotométrica', vr: 'CS' },
  x00280008: { name: 'Número de Cuadros (NumberOfFrames)', vr: 'IS' },
  x00280010: { name: 'Filas / Alto (Rows)', vr: 'US' },
  x00280011: { name: 'Columnas / Ancho (Columns)', vr: 'US' },
  x00280030: { name: 'Espaciado de Píxel mm (PixelSpacing)', vr: 'DS' },
  x00280100: { name: 'Bits Asignados (BitsAllocated)', vr: 'US' },
  x00280101: { name: 'Bits Almacenados (BitsStored)', vr: 'US' },
  x00280102: { name: 'Bit Alto (HighBit)', vr: 'US' },
  x00280103: { name: 'Representación de Píxel (0=Unsigned, 1=Signed)', vr: 'US' },
  x00281050: { name: 'Centro de Ventana (WindowCenter)', vr: 'DS' },
  x00281051: { name: 'Ancho de Ventana (WindowWidth)', vr: 'DS' },
  x00281052: { name: 'Intercepto de Reescalado HU (RescaleIntercept)', vr: 'DS' },
  x00281053: { name: 'Pendiente de Reescalado (RescaleSlope)', vr: 'DS' },
};

export interface ParsedDicomVolume {
  metadata: ExtractedDicomMetadata;
  byteArray: Uint8Array;
  pixelDataOffset: number | null;
  pixelDataLength: number | null;
  isEncapsulatedPixelData: boolean;
}

export function hasDicmMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 132) return false;
  return (
    bytes[128] === 0x44 && // 'D'
    bytes[129] === 0x49 && // 'I'
    bytes[130] === 0x43 && // 'C'
    bytes[131] === 0x4d // 'M'
  );
}

function normalizeModality(raw: string): DicomModality {
  const upper = raw.trim().toUpperCase();
  if (
    upper === 'CT' ||
    upper === 'MR' ||
    upper === 'DX' ||
    upper === 'CR' ||
    upper === 'US' ||
    upper === 'MG'
  ) {
    return upper;
  }
  return 'OT';
}

function formatDicomDate(raw: string): string {
  const clean = raw.replace(/[^0-9]/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function parseFirstFloat(raw: string | undefined): number | null {
  if (!raw) return null;
  const first = raw.split('\\')[0]?.trim();
  if (!first) return null;
  const num = Number(first);
  return Number.isFinite(num) ? num : null;
}

function formatTagId(tagKey: string): string {
  if (tagKey.length === 9 && tagKey.startsWith('x')) {
    return `(${tagKey.slice(1, 5).toUpperCase()},${tagKey.slice(5, 9).toUpperCase()})`;
  }
  return tagKey;
}

export function parseDicomBytes(inputBytes: Uint8Array): ParsedDicomVolume {
  // Ensure clean Uint8Array slice backed by exact offset alignment
  const byteArray =
    inputBytes.byteOffset === 0 && inputBytes.byteLength === inputBytes.buffer.byteLength
      ? inputBytes
      : new Uint8Array(inputBytes);

  const hasPreamble = hasDicmMagicBytes(byteArray);
  let dataSet: dicomParserNs.DataSet;

  try {
    dataSet = dicomParser.parseDicom(byteArray);
  } catch (err) {
    throw new Error(
      `El archivo no cumple con la estructura binaria DICOM (ISO 12052): ${
        err instanceof Error ? err.message : 'formato desconocido'
      }`
    );
  }

  const str = (tag: string): string => (dataSet.string(tag) ?? '').replace(/\0/g, '').trim();
  const uint16 = (tag: string): number | undefined => dataSet.uint16(tag);
  const intString = (tag: string): number | undefined => dataSet.intString(tag);

  const rows = uint16('x00280010') ?? 0;
  const columns = uint16('x00280011') ?? 0;
  const modalityRaw = str('x00080060');
  const sopInstanceUid = str('x00080018') || str('x00020003');
  const elementCount = Object.keys(dataSet.elements).length;

  if (!hasPreamble && elementCount < 3) {
    throw new Error('Archivo inválido: no contiene preámbulo DICM ni etiquetas clínicas válidas.');
  }

  const bitsAllocated = uint16('x00280100') ?? 16;
  const bitsStored = uint16('x00280101') ?? bitsAllocated;
  const pixelRepresentation = uint16('x00280103') ?? 0;
  const samplesPerPixel = uint16('x00280002') ?? 1;
  const photometricInterpretation = str('x00280004') || 'MONOCHROME2';
  const transferSyntaxUid = str('x00020010') || '1.2.840.10008.1.2.1';
  const windowCenter = parseFirstFloat(str('x00281050'));
  const windowWidth = parseFirstFloat(str('x00281051'));
  const rescaleSlope = parseFirstFloat(str('x00281053')) ?? 1;
  const rescaleIntercept = parseFirstFloat(str('x00281052')) ?? 0;
  const numberOfFrames = Math.max(1, intString('x00280008') ?? 1);

  const tags: DicomTagEntry[] = [];
  const sortedKeys = Object.keys(dataSet.elements).sort();

  for (const key of sortedKeys) {
    if (key === 'x7fe00010') {
      const pxEl = dataSet.elements[key];
      tags.push({
        tag: '(7FE0,0010)',
        vr: pxEl.vr ?? 'OW',
        name: 'Datos de Píxeles (PixelData)',
        value: `[ Binario médico sin pérdida: ${pxEl.length.toLocaleString()} bytes ]`,
      });
      continue;
    }

    const el = dataSet.elements[key];
    const known = KNOWN_TAG_NAMES[key];
    const vr = el.vr ?? known?.vr ?? 'UN';
    let displayVal = '';

    if (el.length <= 256) {
      if (vr === 'US') {
        displayVal = String(dataSet.uint16(key) ?? '');
      } else if (vr === 'SS') {
        displayVal = String(dataSet.int16(key) ?? '');
      } else if (vr === 'UL') {
        displayVal = String(dataSet.uint32(key) ?? '');
      } else if (vr === 'SL') {
        displayVal = String(dataSet.int32(key) ?? '');
      } else if (vr !== 'OB' && vr !== 'OW' && vr !== 'SQ' && vr !== 'UN') {
        displayVal = str(key);
      }
    }

    if (displayVal || known) {
      tags.push({
        tag: formatTagId(key),
        vr,
        name: known?.name ?? `Atributo DICOM ${formatTagId(key)}`,
        value: displayVal || `(${el.length} bytes)`,
      });
    }
  }

  const pixelElement = dataSet.elements.x7fe00010;
  const metadata: ExtractedDicomMetadata = {
    isValidDicom: true,
    hasDicmPreamble: hasPreamble,
    transferSyntaxUid,
    modality: normalizeModality(modalityRaw || 'OT'),
    patientName: str('x00100010').replace(/\^+/g, ' ').trim() || 'PACIENTE SIN NOMBRE',
    patientId: str('x00100020') || 'SIN-ID',
    patientBirthDate: str('x00100030') ? formatDicomDate(str('x00100030')) : '',
    patientSex: str('x00100040') || 'O',
    studyDate: formatDicomDate(str('x00080020')),
    studyDescription: str('x00081030') || 'Estudio de Imagen Médica DICOM',
    seriesDescription: str('x0008103e') || 'Serie Diagnóstica Principal',
    bodyPartExamined: str('x00180015') || 'GENERAL',
    institutionName: str('x00080080') || '',
    manufacturer: str('x00080070') || '',
    studyInstanceUid: str('x0020000d') || '',
    seriesInstanceUid: str('x0020000e') || '',
    sopInstanceUid,
    instanceNumber: intString('x00200013') ?? 1,
    rows,
    columns,
    bitsAllocated,
    bitsStored,
    pixelRepresentation,
    samplesPerPixel,
    photometricInterpretation,
    windowCenter,
    windowWidth,
    rescaleSlope,
    rescaleIntercept,
    pixelSpacing: str('x00280030') || '1.0\\1.0',
    sliceThickness: str('x00180050') || '',
    numberOfFrames,
    tags,
  };

  return {
    metadata,
    byteArray,
    pixelDataOffset: pixelElement ? pixelElement.dataOffset : null,
    pixelDataLength: pixelElement ? pixelElement.length : null,
    isEncapsulatedPixelData: Boolean(pixelElement?.encapsulatedPixelData),
  };
}

export interface RenderWindowOptions {
  windowCenter?: number;
  windowWidth?: number;
  invert?: boolean;
  frameIndex?: number;
}

export interface RenderedDicomSlice {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  appliedWindowCenter: number;
  appliedWindowWidth: number;
  minModalityValue: number;
  maxModalityValue: number;
}

/**
 * Reads the calibrated modality value (e.g., Hounsfield Units in CT) at coordinates (x, y).
 */
export function getModalityPixelValue(
  volume: ParsedDicomVolume,
  x: number,
  y: number,
  frameIndex = 0
): number | null {
  const { metadata, byteArray, pixelDataOffset, isEncapsulatedPixelData } = volume;
  if (
    pixelDataOffset === null ||
    isEncapsulatedPixelData ||
    metadata.rows <= 0 ||
    metadata.columns <= 0 ||
    metadata.samplesPerPixel !== 1
  ) {
    return null;
  }
  if (x < 0 || y < 0 || x >= metadata.columns || y >= metadata.rows) {
    return null;
  }

  const pixelsPerFrame = metadata.rows * metadata.columns;
  const safeFrame = Math.min(Math.max(0, frameIndex), metadata.numberOfFrames - 1);
  const pixelIndex = safeFrame * pixelsPerFrame + y * metadata.columns + x;
  const dv = new DataView(byteArray.buffer, byteArray.byteOffset, byteArray.byteLength);

  let raw = 0;
  if (metadata.bitsAllocated <= 8) {
    const bytePos = pixelDataOffset + pixelIndex;
    if (bytePos >= byteArray.byteLength) return null;
    raw = metadata.pixelRepresentation === 1 ? dv.getInt8(bytePos) : dv.getUint8(bytePos);
  } else {
    const bytePos = pixelDataOffset + pixelIndex * 2;
    if (bytePos + 1 >= byteArray.byteLength) return null;
    raw =
      metadata.pixelRepresentation === 1
        ? dv.getInt16(bytePos, true)
        : dv.getUint16(bytePos, true);
  }

  return raw * metadata.rescaleSlope + metadata.rescaleIntercept;
}

/**
 * Renders an uncompressed 8/12/16-bit Monochrome or RGB DICOM frame into an RGBA buffer
 * applying real radiological Window Center / Window Width LUT mapping.
 */
export function renderDicomFrameToRgba(
  volume: ParsedDicomVolume,
  options: RenderWindowOptions = {}
): RenderedDicomSlice {
  const { metadata, byteArray, pixelDataOffset, isEncapsulatedPixelData } = volume;
  const width = metadata.columns;
  const height = metadata.rows;

  if (
    width <= 0 ||
    height <= 0 ||
    pixelDataOffset === null ||
    isEncapsulatedPixelData
  ) {
    throw new Error(
      'Este archivo requiere decodificación externa o contiene flujo comprimido encapsulado.'
    );
  }

  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);
  const safeFrame = Math.min(
    Math.max(0, options.frameIndex ?? 0),
    Math.max(0, metadata.numberOfFrames - 1)
  );

  // Handle 24-bit RGB DICOM images (e.g., Ultrasound / Doppler captures)
  if (metadata.samplesPerPixel === 3 && metadata.bitsAllocated === 8) {
    const frameOffset = pixelDataOffset + safeFrame * totalPixels * 3;
    for (let i = 0; i < totalPixels; i++) {
      const src = frameOffset + i * 3;
      const dst = i * 4;
      let r = byteArray[src] ?? 0;
      let g = byteArray[src + 1] ?? 0;
      let b = byteArray[src + 2] ?? 0;
      if (options.invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }
      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
      rgba[dst + 3] = 255;
    }
    return {
      width,
      height,
      rgba,
      appliedWindowCenter: 128,
      appliedWindowWidth: 256,
      minModalityValue: 0,
      maxModalityValue: 255,
    };
  }

  // Monochrome 8-bit / 12-bit / 16-bit medical grayscale pipeline
  const dv = new DataView(byteArray.buffer, byteArray.byteOffset, byteArray.byteLength);
  const modalityValues = new Float32Array(totalPixels);
  const bytesPerPixel = metadata.bitsAllocated <= 8 ? 1 : 2;
  const frameByteOffset = pixelDataOffset + safeFrame * totalPixels * bytesPerPixel;

  let minVal = Infinity;
  let maxVal = -Infinity;
  const slope = metadata.rescaleSlope;
  const intercept = metadata.rescaleIntercept;
  const isSigned = metadata.pixelRepresentation === 1;

  for (let i = 0; i < totalPixels; i++) {
    const pos = frameByteOffset + i * bytesPerPixel;
    if (pos + bytesPerPixel > byteArray.byteLength) break;

    let raw: number;
    if (bytesPerPixel === 1) {
      raw = isSigned ? dv.getInt8(pos) : dv.getUint8(pos);
    } else {
      raw = isSigned ? dv.getInt16(pos, true) : dv.getUint16(pos, true);
    }

    const val = raw * slope + intercept;
    modalityValues[i] = val;
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
  }

  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    minVal = 0;
    maxVal = 1;
  }

  const defaultCenter =
    metadata.windowCenter !== null ? metadata.windowCenter : (minVal + maxVal) / 2;
  const defaultWidth =
    metadata.windowWidth !== null && metadata.windowWidth > 0
      ? metadata.windowWidth
      : Math.max(1, maxVal - minVal);

  const wc = options.windowCenter ?? defaultCenter;
  const ww = Math.max(1, options.windowWidth ?? defaultWidth);
  const lower = wc - ww / 2;
  const upper = wc + ww / 2;

  const isMonochrome1 = metadata.photometricInterpretation.toUpperCase() === 'MONOCHROME1';
  const shouldInvert = isMonochrome1 ? !options.invert : Boolean(options.invert);

  for (let i = 0; i < totalPixels; i++) {
    const val = modalityValues[i];
    let intensity: number;
    if (val <= lower) {
      intensity = 0;
    } else if (val >= upper) {
      intensity = 255;
    } else {
      intensity = ((val - lower) / ww) * 255;
    }

    const gray = shouldInvert ? 255 - intensity : intensity;
    const dst = i * 4;
    rgba[dst] = gray;
    rgba[dst + 1] = gray;
    rgba[dst + 2] = gray;
    rgba[dst + 3] = 255;
  }

  return {
    width,
    height,
    rgba,
    appliedWindowCenter: Math.round(wc),
    appliedWindowWidth: Math.round(ww),
    minModalityValue: Math.round(minVal),
    maxModalityValue: Math.round(maxVal),
  };
}
