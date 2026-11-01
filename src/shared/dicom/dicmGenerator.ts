/**
 * Standards-compliant NEMA PS3.10 / ISO 12052 Explicit VR Little Endian DICOM synthesizer.
 * Produces real binary .dcm studies (CT in signed 16-bit Hounsfield Units, MR T2 multi-slice,
 * and DX Digital Chest Radiography) that open natively in both our web workstation and
 * external clinical viewers (3D Slicer, RadiAnt, Horos, OsiriX, MicroDicom).
 */

export type SamplePhantomType = 'ct_chest' | 'mr_brain' | 'dx_chest';

export interface GeneratedSampleDicom {
  filename: string;
  bytes: Uint8Array;
  modality: 'CT' | 'MR' | 'DX';
  description: string;
}

const LONG_LENGTH_VRS = new Set([
  'OB',
  'OD',
  'OF',
  'OL',
  'OV',
  'OW',
  'SQ',
  'SV',
  'UC',
  'UN',
  'UR',
  'UT',
  'UV',
]);

function encodeElement(
  group: number,
  element: number,
  vr: string,
  rawValue: Uint8Array,
  padByte = 0x20
): Uint8Array {
  const needsPad = rawValue.byteLength % 2 !== 0;
  const paddedLength = rawValue.byteLength + (needsPad ? 1 : 0);
  const isLongVr = LONG_LENGTH_VRS.has(vr);
  const headerLength = isLongVr ? 12 : 8;

  const buffer = new Uint8Array(headerLength + paddedLength);
  const view = new DataView(buffer.buffer);

  view.setUint16(0, group, true);
  view.setUint16(2, element, true);
  buffer[4] = vr.charCodeAt(0);
  buffer[5] = vr.charCodeAt(1);

  if (isLongVr) {
    view.setUint16(6, 0x0000, true);
    view.setUint32(8, paddedLength, true);
  } else {
    view.setUint16(6, paddedLength, true);
  }

  buffer.set(rawValue, headerLength);
  if (needsPad) {
    buffer[headerLength + rawValue.byteLength] = padByte;
  }
  return buffer;
}

function encodeStringElement(group: number, element: number, vr: string, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  const padByte = vr === 'UI' ? 0x00 : 0x20;
  return encodeElement(group, element, vr, bytes, padByte);
}

function encodeUint16Element(group: number, element: number, vr: string, value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return encodeElement(group, element, vr, bytes, 0x00);
}

function encodeUint32Element(group: number, element: number, vr: string, value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return encodeElement(group, element, vr, bytes, 0x00);
}

function concatArrays(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

interface DicomBuildInput {
  sopClassUid: string;
  sopInstanceUid: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  modality: 'CT' | 'MR' | 'DX';
  accessionNumber: string;
  studyDate: string;
  studyTime: string;
  institutionName: string;
  manufacturer: string;
  studyDescription: string;
  seriesDescription: string;
  patientName: string;
  patientId: string;
  patientBirthDate: string;
  patientSex: string;
  bodyPart: string;
  sliceThickness: string;
  seriesNumber: number;
  instanceNumber: number;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  highBit: number;
  pixelRepresentation: 0 | 1;
  pixelSpacing: string;
  windowCenter: number;
  windowWidth: number;
  rescaleIntercept?: number;
  rescaleSlope?: number;
  pixelBytes: Uint8Array;
}

function assemblePart10Dicom(cfg: DicomBuildInput): Uint8Array {
  const preamble = new Uint8Array(132);
  preamble[128] = 0x44; // D
  preamble[129] = 0x49; // I
  preamble[130] = 0x43; // C
  preamble[131] = 0x4d; // M

  const metaBody = concatArrays([
    encodeElement(0x0002, 0x0001, 'OB', new Uint8Array([0x00, 0x01]), 0x00),
    encodeStringElement(0x0002, 0x0002, 'UI', cfg.sopClassUid),
    encodeStringElement(0x0002, 0x0003, 'UI', cfg.sopInstanceUid),
    encodeStringElement(0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1'), // Explicit VR Little Endian
    encodeStringElement(0x0002, 0x0012, 'UI', '1.2.826.0.1.3680043.10.2026.1'),
    encodeStringElement(0x0002, 0x0013, 'SH', 'TELEMED_DICOM_1'),
  ]);

  const metaLengthElem = encodeUint32Element(0x0002, 0x0000, 'UL', metaBody.byteLength);

  // Dataset elements strictly ordered by ascending (Group, Element)
  const datasetParts: Uint8Array[] = [
    encodeStringElement(0x0008, 0x0008, 'CS', 'ORIGINAL\\PRIMARY\\AXIAL'),
    encodeStringElement(0x0008, 0x0016, 'UI', cfg.sopClassUid),
    encodeStringElement(0x0008, 0x0018, 'UI', cfg.sopInstanceUid),
    encodeStringElement(0x0008, 0x0020, 'DA', cfg.studyDate),
    encodeStringElement(0x0008, 0x0030, 'TM', cfg.studyTime),
    encodeStringElement(0x0008, 0x0050, 'SH', cfg.accessionNumber),
    encodeStringElement(0x0008, 0x0060, 'CS', cfg.modality),
    encodeStringElement(0x0008, 0x0070, 'LO', cfg.manufacturer),
    encodeStringElement(0x0008, 0x0080, 'LO', cfg.institutionName),
    encodeStringElement(0x0008, 0x1030, 'LO', cfg.studyDescription),
    encodeStringElement(0x0008, 0x103e, 'LO', cfg.seriesDescription),

    encodeStringElement(0x0010, 0x0010, 'PN', cfg.patientName),
    encodeStringElement(0x0010, 0x0020, 'LO', cfg.patientId),
    encodeStringElement(0x0010, 0x0030, 'DA', cfg.patientBirthDate),
    encodeStringElement(0x0010, 0x0040, 'CS', cfg.patientSex),

    encodeStringElement(0x0018, 0x0015, 'CS', cfg.bodyPart),
    encodeStringElement(0x0018, 0x0050, 'DS', cfg.sliceThickness),

    encodeStringElement(0x0020, 0x000d, 'UI', cfg.studyInstanceUid),
    encodeStringElement(0x0020, 0x000e, 'UI', cfg.seriesInstanceUid),
    encodeStringElement(0x0020, 0x0011, 'IS', String(cfg.seriesNumber)),
    encodeStringElement(0x0020, 0x0013, 'IS', String(cfg.instanceNumber)),

    encodeUint16Element(0x0028, 0x0002, 'US', 1), // SamplesPerPixel
    encodeStringElement(0x0028, 0x0004, 'CS', 'MONOCHROME2'),
    encodeUint16Element(0x0028, 0x0010, 'US', cfg.rows),
    encodeUint16Element(0x0028, 0x0011, 'US', cfg.columns),
    encodeStringElement(0x0028, 0x0030, 'DS', cfg.pixelSpacing),
    encodeUint16Element(0x0028, 0x0100, 'US', cfg.bitsAllocated),
    encodeUint16Element(0x0028, 0x0101, 'US', cfg.bitsStored),
    encodeUint16Element(0x0028, 0x0102, 'US', cfg.highBit),
    encodeUint16Element(0x0028, 0x0103, 'US', cfg.pixelRepresentation),
    encodeStringElement(0x0028, 0x1050, 'DS', String(cfg.windowCenter)),
    encodeStringElement(0x0028, 0x1051, 'DS', String(cfg.windowWidth)),
  ];

  if (cfg.rescaleIntercept !== undefined && cfg.rescaleSlope !== undefined) {
    datasetParts.push(
      encodeStringElement(0x0028, 0x1052, 'DS', String(cfg.rescaleIntercept)),
      encodeStringElement(0x0028, 0x1053, 'DS', String(cfg.rescaleSlope))
    );
  }

  datasetParts.push(encodeElement(0x7fe0, 0x0010, 'OW', cfg.pixelBytes, 0x00));

  return concatArrays([preamble, metaLengthElem, metaBody, ...datasetParts]);
}

function insideEllipse(
  nx: number,
  ny: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): number {
  const dx = (nx - cx) / rx;
  const dy = (ny - cy) / ry;
  return dx * dx + dy * dy;
}

/**
 * Generates an axial Thoracic CT slice in calibrated signed 16-bit Hounsfield Units (-1000 to +900 HU).
 * Changing Window/Level between Lung (-600/1500), Soft Tissue (50/350), and Bone (300/1500)
 * reveals pulmonary vessels/nodule, mediastinal chambers, and cortical bone respectively.
 */
export function generateChestCtDicom(sliceIndex = 1): GeneratedSampleDicom {
  const size = 256;
  const pixelBytes = new Uint8Array(size * size * 2);
  const dv = new DataView(pixelBytes.buffer);
  const zShift = (sliceIndex - 1) * 0.04;

  for (let y = 0; y < size; y++) {
    const ny = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;

      // Extracorporeal air (-1000 HU) + CT scanner table inferiorly
      let hu = -1000;
      if (ny > 0.72 && ny < 0.78 && Math.abs(nx) < 0.75) {
        hu = -180; // Carbon fiber CT table
      }

      // Thoracic wall (subcutaneous fat -95 HU + muscle +45 HU)
      const bodyDist = insideEllipse(nx, ny, 0, 0.02, 0.82, 0.64);
      if (bodyDist <= 1.0) {
        hu = bodyDist > 0.84 ? -85 : 42;

        // Right & Left aerated lung fields (-780 HU)
        const rightLung = insideEllipse(nx, ny, -0.34, -0.02, 0.31, 0.42 - zShift * 0.2);
        const leftLung = insideEllipse(nx, ny, 0.35, -0.01, 0.29, 0.40 - zShift * 0.2);

        if (rightLung < 1.0 || leftLung < 1.0) {
          const radial = Math.min(rightLung, leftLung);
          hu = -810 + radial * 55;

          // Branching bronchovascular markings inside lungs
          const vesselWave =
            Math.sin((nx + 0.34) * 28) * Math.cos((ny + 0.05) * 26) +
            Math.sin(nx * 45 + ny * 35) * 0.4;
          if (vesselWave > 1.08 && radial < 0.85) {
            hu = -120 + (vesselWave - 1.08) * 350;
          }

          // Well-circumscribed 14 mm pulmonary nodule in Right Lower Lobe (+58 HU)
          const nodule = insideEllipse(nx, ny, -0.42, 0.14 + zShift * 0.3, 0.065, 0.065);
          if (nodule <= 1.0) {
            hu = 62 - nodule * 28;
          }
        }

        // Heart and descending thoracic aorta (+52 HU)
        const heart = insideEllipse(nx, ny, 0.08, -0.08, 0.22, 0.24);
        if (heart <= 1.0) {
          hu = 54 - heart * 8;
        }
        const aorta = insideEllipse(nx, ny, 0.09, 0.24, 0.065, 0.065);
        if (aorta <= 1.0) {
          hu = 68;
        }

        // Trachea / mainstem bronchi lumen (-980 HU air)
        const rBronchus = insideEllipse(nx, ny, -0.07, 0.08, 0.035, 0.035);
        const lBronchus = insideEllipse(nx, ny, 0.07, 0.09, 0.035, 0.035);
        if (rBronchus <= 1.0 || lBronchus <= 1.0) {
          hu = -975;
        }

        // Thoracic vertebra (+380 cancellous, +820 cortical, +25 spinal canal)
        const vertebra = insideEllipse(nx, ny, 0, 0.42, 0.13, 0.11);
        if (vertebra <= 1.0) {
          hu = vertebra > 0.72 ? 810 : 365;
        }
        const canal = insideEllipse(nx, ny, 0, 0.48, 0.05, 0.045);
        if (canal <= 1.0) {
          hu = 28;
        }
        const spinous = insideEllipse(nx, ny, 0, 0.58, 0.032, 0.07);
        if (spinous <= 1.0) {
          hu = 740;
        }

        // Sternum anteriorly
        const sternum = insideEllipse(nx, ny, 0, -0.54, 0.09, 0.032);
        if (sternum <= 1.0) {
          hu = 620;
        }

        // Rib cage cortical arcs along thoracic perimeter
        if (bodyDist > 0.74 && bodyDist < 0.85) {
          const angle = Math.atan2(ny - 0.02, nx);
          const ribSector = Math.cos(angle * 10);
          if (ribSector > 0.65 && Math.abs(ny) < 0.52) {
            hu = 690 + ribSector * 140;
          }
        }
      }

      // Deterministic subtle quantum CT noise (+/- 9 HU)
      const pseudoNoise = (((x * 73856093) ^ (y * 19349663) ^ (sliceIndex * 83492791)) & 0x1f) - 16;
      const finalHu = Math.max(-1024, Math.min(1400, Math.round(hu + pseudoNoise * 0.55)));
      dv.setInt16((y * size + x) * 2, finalHu, true);
    }
  }

  const bytes = assemblePart10Dicom({
    sopClassUid: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage
    sopInstanceUid: `1.2.826.0.1.3680043.10.2026.100.${sliceIndex}`,
    studyInstanceUid: '1.2.826.0.1.3680043.10.2026.100',
    seriesInstanceUid: '1.2.826.0.1.3680043.10.2026.100.1',
    modality: 'CT',
    accessionNumber: 'ACC-2026-CT01',
    studyDate: '20261028',
    studyTime: '093500',
    institutionName: 'HOSPITAL REGIONAL DE TELEMEDICINA MONTERREY',
    manufacturer: 'SIEMENS HEALTHINEERS SOMATOM',
    studyDescription: 'TAC DE TORAX ALTA RESOLUCION SIN CONTRASTE',
    seriesDescription: 'AXIAL PULMON Y MEDIASTINO 16-BIT HU',
    patientName: 'GARZA^MARTINEZ^ROBERTO',
    patientId: 'EXP-NL-88412',
    patientBirthDate: '19710415',
    patientSex: 'M',
    bodyPart: 'CHEST',
    sliceThickness: '2.5',
    seriesNumber: 1,
    instanceNumber: sliceIndex,
    rows: size,
    columns: size,
    bitsAllocated: 16,
    bitsStored: 16,
    highBit: 15,
    pixelRepresentation: 1, // Signed Hounsfield integers
    pixelSpacing: '1.25\\1.25',
    windowCenter: -550,
    windowWidth: 1500,
    rescaleIntercept: 0,
    rescaleSlope: 1,
    pixelBytes,
  });

  return {
    filename: `TAC_Torax_Corte_${String(sliceIndex).padStart(2, '0')}.dcm`,
    bytes,
    modality: 'CT',
    description: 'Tomografía Axial Computarizada de Tórax (16-bit Unidades Hounsfield)',
  };
}

/**
 * Generates an axial Brain T2-weighted MRI slice (unsigned 16-bit) supporting multi-slice series.
 */
export function generateBrainMrDicom(sliceIndex = 1): GeneratedSampleDicom {
  const size = 256;
  const pixelBytes = new Uint8Array(size * size * 2);
  const dv = new DataView(pixelBytes.buffer);
  const zOffset = (sliceIndex - 2) * 0.08;

  for (let y = 0; y < size; y++) {
    const ny = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      let signal = 18; // Background low MRI noise

      const skullOuter = insideEllipse(nx, ny, 0, 0, 0.72, 0.84);
      if (skullOuter <= 1.0) {
        if (skullOuter > 0.90) {
          signal = 540; // Scalp / diploic fat signal
        } else if (skullOuter > 0.83) {
          signal = 95; // Cortical inner/outer skull table (hypointense on T2)
        } else if (skullOuter > 0.78) {
          signal = 1480; // Subarachnoid CSF rim (hyperintense on T2)
        } else {
          // Cerebral hemispheres (gray matter cortex + white matter centrum)
          const gyri = Math.sin(nx * 22) * Math.cos(ny * 22);
          signal = skullOuter > 0.62 || gyri > 0.65 ? 920 : 670;

          // Interhemispheric longitudinal fissure
          if (Math.abs(nx) < 0.018 && Math.abs(ny) < 0.74) {
            signal = 1420;
          }

          // Bilateral lateral ventricles (bright CSF on T2, shape varies per slice)
          const vWidth = Math.max(0.05, 0.11 - Math.abs(zOffset) * 0.25);
          const leftVent = insideEllipse(nx, ny, 0.11, -0.03, vWidth, 0.26);
          const rightVent = insideEllipse(nx, ny, -0.11, -0.03, vWidth, 0.26);
          if (leftVent <= 1.0 || rightVent <= 1.0) {
            // Trim lateral outer edge to create crescent shape
            const innerCut = insideEllipse(nx, ny, 0, -0.03, 0.05, 0.16);
            if (innerCut > 0.55) {
              signal = 1690;
            }
          }

          // Thalami / Basal Ganglia
          const lThal = insideEllipse(nx, ny, -0.14, 0.08, 0.08, 0.11);
          const rThal = insideEllipse(nx, ny, 0.14, 0.08, 0.08, 0.11);
          if (lThal <= 1.0 || rThal <= 1.0) {
            signal = 810;
          }

          // Focal hyperintense T2 demyelinating/ischemic focus in left corona radiata
          const lesionRadius = sliceIndex === 2 ? 0.075 : 0.048;
          const lesion = insideEllipse(
            nx,
            ny,
            0.28,
            0.12 - zOffset * 0.2,
            lesionRadius,
            lesionRadius
          );
          if (lesion <= 1.0) {
            signal = 1580 - lesion * 260;
          }
        }
      }

      const noise = ((x * 2654435761 + y * 40503 + sliceIndex * 12345) & 0x1f) - 16;
      const clamped = Math.max(0, Math.min(4095, Math.round(signal + noise * 1.4)));
      dv.setUint16((y * size + x) * 2, clamped, true);
    }
  }

  const bytes = assemblePart10Dicom({
    sopClassUid: '1.2.840.10008.5.1.4.1.1.4', // MR Image Storage
    sopInstanceUid: `1.2.826.0.1.3680043.10.2026.200.${sliceIndex}`,
    studyInstanceUid: '1.2.826.0.1.3680043.10.2026.200',
    seriesInstanceUid: '1.2.826.0.1.3680043.10.2026.200.1',
    modality: 'MR',
    accessionNumber: 'ACC-2026-MR02',
    studyDate: '20261030',
    studyTime: '141500',
    institutionName: 'CLINICA DIAGNOSTICA UNIVERSITARIA',
    manufacturer: 'GE HEALTHCARE SIGNA 3.0T',
    studyDescription: 'RESONANCIA MAGNETICA DE ENCEFALO SIMPLE',
    seriesDescription: 'AXIAL T2 PROPELLER MULTICORTE',
    patientName: 'VILLARREAL^SANCHEZ^ELENA',
    patientId: 'EXP-NL-91204',
    patientBirthDate: '19860922',
    patientSex: 'F',
    bodyPart: 'BRAIN',
    sliceThickness: '4.0',
    seriesNumber: 2,
    instanceNumber: sliceIndex,
    rows: size,
    columns: size,
    bitsAllocated: 16,
    bitsStored: 12,
    highBit: 11,
    pixelRepresentation: 0,
    pixelSpacing: '0.94\\0.94',
    windowCenter: 880,
    windowWidth: 1650,
    pixelBytes,
  });

  return {
    filename: `RM_Cerebro_T2_Corte_${String(sliceIndex).padStart(2, '0')}.dcm`,
    bytes,
    modality: 'MR',
    description: `Resonancia Magnética Cerebral T2 - Corte ${sliceIndex}`,
  };
}

/**
 * Generates a 12-bit Posteroanterior Digital Chest Radiograph (DX).
 */
export function generateChestXrayDicom(): GeneratedSampleDicom {
  const size = 256;
  const pixelBytes = new Uint8Array(size * size * 2);
  const dv = new DataView(pixelBytes.buffer);

  for (let y = 0; y < size; y++) {
    const ny = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;

      let intensity = 220; // Unattenuated detector background (dark on MONOCHROME2)

      // Neck & torso silhouette
      const neck = Math.abs(nx) < 0.22 && ny < -0.58;
      const torso = insideEllipse(nx, ny, 0, 0.12, 0.78, 0.88) <= 1.0 && ny >= -0.66;
      if (neck || torso) {
        intensity = 2250; // Soft tissue thoracic envelope

        // Radiolucent aerated right and left lung fields (darker than mediastinum)
        const rLung = insideEllipse(nx, ny, -0.31, -0.06, 0.28, 0.48);
        const lLung = insideEllipse(nx, ny, 0.31, -0.06, 0.27, 0.46);
        const rDome = insideEllipse(nx, ny, -0.31, 0.42, 0.32, 0.16);
        const lDome = insideEllipse(nx, ny, 0.31, 0.45, 0.32, 0.16);

        if ((rLung <= 1.0 && rDome > 1.0) || (lLung <= 1.0 && lDome > 1.0)) {
          intensity = 760 + Math.min(rLung, lLung) * 320;

          // Posterior horizontal rib arcs superimposed over lung fields
          const ribWave = Math.sin((ny + Math.abs(nx) * 0.28) * 34);
          if (ribWave > 0.62) {
            intensity += (ribWave - 0.62) * 820;
          }

          // Hilar vascular markings
          const rHilum = insideEllipse(nx, ny, -0.14, -0.08, 0.09, 0.14);
          const lHilum = insideEllipse(nx, ny, 0.14, -0.10, 0.09, 0.14);
          if (rHilum <= 1.0 || lHilum <= 1.0) {
            intensity += 420;
          }
        }

        // Mediastinum, spine, and cardiac silhouette (radiopaque / bright)
        if (Math.abs(nx) < 0.09 && ny > -0.65 && ny < 0.65) {
          intensity = Math.max(intensity, 2680);
        }
        const heartSilhouette = insideEllipse(nx, ny, 0.10, 0.14, 0.24, 0.22);
        if (heartSilhouette <= 1.0) {
          intensity = Math.max(intensity, 2950 - heartSilhouette * 320);
        }

        // Clavicles superiorly
        const lClav = Math.abs(ny - (-0.48 + nx * 0.18)) < 0.025 && nx > 0.06 && nx < 0.56;
        const rClav = Math.abs(ny - (-0.48 - nx * 0.18)) < 0.025 && nx < -0.06 && nx > -0.56;
        if (lClav || rClav) {
          intensity += 760;
        }

        // Subdiaphragmatic abdominal density
        if (ny > 0.38 && (rDome <= 1.0 || lDome <= 1.0 || Math.abs(nx) < 0.2)) {
          intensity = Math.max(intensity, 3180);
        }
      }

      const clamped = Math.max(0, Math.min(4095, Math.round(intensity)));
      dv.setUint16((y * size + x) * 2, clamped, true);
    }
  }

  const bytes = assemblePart10Dicom({
    sopClassUid: '1.2.840.10008.5.1.4.1.1.1.1', // Digital X-Ray Image Storage
    sopInstanceUid: '1.2.826.0.1.3680043.10.2026.300.1',
    studyInstanceUid: '1.2.826.0.1.3680043.10.2026.300',
    seriesInstanceUid: '1.2.826.0.1.3680043.10.2026.300.1',
    modality: 'DX',
    accessionNumber: 'ACC-2026-DX03',
    studyDate: '20261025',
    studyTime: '112000',
    institutionName: 'UNIDAD DE IMAGENOLOGIA SAN PEDRO',
    manufacturer: 'FUJIFILM FDR D-EVO II',
    studyDescription: 'RADIOGRAFIA TELE DE TORAX PA',
    seriesDescription: 'PROYECCION POSTEROANTERIOR 12-BIT',
    patientName: 'MENDOZA^TREVINO^CARLOS',
    patientId: 'EXP-NL-77319',
    patientBirthDate: '19921104',
    patientSex: 'M',
    bodyPart: 'CHEST',
    sliceThickness: '0.0',
    seriesNumber: 1,
    instanceNumber: 1,
    rows: size,
    columns: size,
    bitsAllocated: 16,
    bitsStored: 12,
    highBit: 11,
    pixelRepresentation: 0,
    pixelSpacing: '0.15\\0.15',
    windowCenter: 1850,
    windowWidth: 2800,
    pixelBytes,
  });

  return {
    filename: 'RX_Torax_PA_Digital.dcm',
    bytes,
    modality: 'DX',
    description: 'Radiografía Digital Posteroanterior de Tórax (12-bit)',
  };
}

export function generateSampleDicomByType(type: SamplePhantomType): GeneratedSampleDicom {
  switch (type) {
    case 'ct_chest':
      return generateChestCtDicom(1);
    case 'mr_brain':
      return generateBrainMrDicom(2);
    case 'dx_chest':
      return generateChestXrayDicom();
  }
}
