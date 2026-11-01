import * as dicomParserNs from 'dicom-parser';

const dicomParser: typeof dicomParserNs =
  (dicomParserNs as unknown as { default?: typeof dicomParserNs }).default ?? dicomParserNs;

/**
 * Sensitive PHI tags per DICOM PS3.15 Basic Application Level Confidentiality Profile.
 * Values are overwritten strictly in-place using exact fixed byte length and ASCII space
 * padding (0x20) so no binary offsets or (7FE0,0010) PixelData pointers are altered.
 */
const PHI_REPLACEMENTS: Record<string, (pseudonymId: string) => string> = {
  x00100010: () => 'PACIENTE^ANONIMIZADO', // PatientName
  x00100020: (id) => id, // PatientID
  x00100030: () => '19000101', // PatientBirthDate
  x00101000: () => '', // OtherPatientIDs
  x00101010: () => '', // PatientAge
  x00101040: () => '', // PatientAddress
  x00102154: () => '', // PatientTelephoneNumbers
  x00080080: () => 'INSTITUCION RESERVADA', // InstitutionName
  x00080081: () => '', // InstitutionAddress
  x00080090: () => 'MEDICO^RESERVADO', // ReferringPhysicianName
  x00081048: () => '', // PhysiciansOfRecord
  x00081050: () => '', // PerformingPhysicianName
  x00081070: () => '', // OperatorsName
};

export function anonymizeDicomBuffer(
  originalBytes: Uint8Array,
  pseudonymPatientId = 'ANON-TELEMED'
): Uint8Array {
  const copy = new Uint8Array(originalBytes.byteLength);
  copy.set(originalBytes);

  const dataSet = dicomParser.parseDicom(copy);
  const encoder = new TextEncoder();

  for (const [tagKey, getReplacement] of Object.entries(PHI_REPLACEMENTS)) {
    const element = dataSet.elements[tagKey];
    if (!element || element.length <= 0) continue;

    const replacementText = getReplacement(pseudonymPatientId);
    const replacementBytes = encoder.encode(replacementText);

    // Fill the entire value slot with DICOM ASCII space padding (0x20)
    copy.fill(0x20, element.dataOffset, element.dataOffset + element.length);

    // Write up to element.length bytes so the element length remains 100% unchanged
    const writeLen = Math.min(element.length, replacementBytes.byteLength);
    for (let i = 0; i < writeLen; i++) {
      copy[element.dataOffset + i] = replacementBytes[i];
    }
  }

  return copy;
}
