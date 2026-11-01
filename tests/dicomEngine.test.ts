import { describe, expect, it } from 'vitest';
import { anonymizeDicomBuffer } from '../src/shared/dicom/dicmAnonymizer';
import {
  generateBrainMrDicom,
  generateChestCtDicom,
  generateChestXrayDicom,
} from '../src/shared/dicom/dicmGenerator';
import {
  getModalityPixelValue,
  hasDicmMagicBytes,
  parseDicomBytes,
  renderDicomFrameToRgba,
} from '../src/shared/dicom/dicmParser';
import { buildZipArchive, crc32 } from '../src/shared/dicom/zipBuilder';

describe('DICOM Part 10 Engine (Parser, Renderer, Anonymizer, ZIP)', () => {
  it('synthesizes and parses a signed 16-bit Hounsfield Chest CT DICOM file', () => {
    const sample = generateChestCtDicom(1);
    expect(hasDicmMagicBytes(sample.bytes)).toBe(true);

    const parsed = parseDicomBytes(sample.bytes);
    expect(parsed.metadata.isValidDicom).toBe(true);
    expect(parsed.metadata.modality).toBe('CT');
    expect(parsed.metadata.rows).toBe(256);
    expect(parsed.metadata.columns).toBe(256);
    expect(parsed.metadata.bitsAllocated).toBe(16);
    expect(parsed.metadata.pixelRepresentation).toBe(1);
    expect(parsed.metadata.patientName).toContain('GARZA');

    // Extracorporeal corner pixel (0, 0) should measure ~ -1000 HU (air)
    const cornerHu = getModalityPixelValue(parsed, 2, 2, 0);
    expect(cornerHu).not.toBeNull();
    expect(cornerHu!).toBeLessThan(-950);

    // Lung window vs Bone window produce distinct rendered pixel distributions
    const lungRender = renderDicomFrameToRgba(parsed, {
      windowCenter: -600,
      windowWidth: 1500,
    });
    const boneRender = renderDicomFrameToRgba(parsed, {
      windowCenter: 300,
      windowWidth: 1500,
    });
    expect(lungRender.rgba.byteLength).toBe(256 * 256 * 4);
    expect(boneRender.rgba.byteLength).toBe(256 * 256 * 4);

    let diffCount = 0;
    for (let i = 0; i < lungRender.rgba.length; i += 4) {
      if (lungRender.rgba[i] !== boneRender.rgba[i]) diffCount++;
    }
    expect(diffCount).toBeGreaterThan(5000);
  });

  it('synthesizes and parses Brain MR and Digital Chest X-Ray modalities', () => {
    const mr = generateBrainMrDicom(2);
    const dx = generateChestXrayDicom();

    const parsedMr = parseDicomBytes(mr.bytes);
    const parsedDx = parseDicomBytes(dx.bytes);

    expect(parsedMr.metadata.modality).toBe('MR');
    expect(parsedMr.metadata.instanceNumber).toBe(2);
    expect(parsedDx.metadata.modality).toBe('DX');
    expect(parsedDx.metadata.bitsStored).toBe(12);
  });

  it('anonymizes PHI tags in-place (PS3.15) while keeping diagnostic pixels 100% identical', () => {
    const original = generateChestCtDicom(1);
    const parsedBefore = parseDicomBytes(original.bytes);

    const anonymizedBytes = anonymizeDicomBuffer(original.bytes, 'ANON-999');
    expect(anonymizedBytes.byteLength).toBe(original.bytes.byteLength);

    const parsedAfter = parseDicomBytes(anonymizedBytes);
    expect(parsedAfter.metadata.patientName).toContain('ANONIMIZADO');
    expect(parsedAfter.metadata.patientName).not.toContain('GARZA');
    expect(parsedAfter.metadata.patientId).toBe('ANON-999');
    expect(parsedAfter.metadata.institutionName).toBe('INSTITUCION RESERVADA');

    // Diagnostic pixel payload must match byte-for-byte
    const pxOffset = parsedBefore.pixelDataOffset!;
    const pxLen = parsedBefore.pixelDataLength!;
    const sliceBefore = original.bytes.subarray(pxOffset, pxOffset + pxLen);
    const sliceAfter = anonymizedBytes.subarray(pxOffset, pxOffset + pxLen);
    expect(crc32(sliceAfter)).toBe(crc32(sliceBefore));
  });

  it('rejects non-DICOM text or corrupted files cleanly', () => {
    const invalid = new TextEncoder().encode('This is a plain text file, not a DICOM medical image.');
    expect(hasDicmMagicBytes(invalid)).toBe(false);
    expect(() => parseDicomBytes(invalid)).toThrow();
  });

  it('packages multiple DICOM slices into a valid uncompressed PKZIP archive', () => {
    const s1 = generateBrainMrDicom(1);
    const s2 = generateBrainMrDicom(2);
    const zip = buildZipArchive([
      { filename: s1.filename, data: s1.bytes },
      { filename: s2.filename, data: s2.bytes },
    ]);

    // Verify PK\x03\x04 local file header signature at start
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    expect(zip.byteLength).toBeGreaterThan(s1.bytes.byteLength + s2.bytes.byteLength);
  });
});
