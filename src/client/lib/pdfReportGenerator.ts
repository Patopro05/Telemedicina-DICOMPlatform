import jsPDF from 'jspdf';
import type { StudyDetail } from '../../shared/types';
import { getModalityLabel, getSeverityMeta } from './api';

export function generateDiagnosticPdfReport(study: StudyDetail): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const report = study.report;
  if (!report) {
    throw new Error('El estudio aún no cuenta con un dictamen médico emitido.');
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Header Banner (Olive #517327)
  doc.setFillColor(81, 115, 39); // #517327
  doc.rect(margin, cursorY, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ImaRis', margin + 6, cursorY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('PLATAFORMA DE TELERADIOLOGÍA Y DIAGNÓSTICO REMOTO', margin + 6, cursorY + 14);
  doc.text('NORMA ISO 12052 / NEMA PS3 (DICOM)', margin + 6, cursorY + 18.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FOLIO: ' + study.accessionNumber, pageWidth - margin - 6, cursorY + 10, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'EMISIÓN: ' + new Date(report.signedAt).toLocaleDateString('es-MX'),
    pageWidth - margin - 6,
    cursorY + 16,
    { align: 'right' }
  );

  cursorY += 28;

  // Patient & Clinical Context Block
  doc.setFillColor(245, 247, 242); // very soft olive/gray
  doc.setDrawColor(205, 219, 188);
  doc.roundedRect(margin, cursorY, contentWidth, 34, 2, 2, 'FD');

  doc.setTextColor(81, 115, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DATOS DEL PACIENTE Y ESTUDIO DE IMAGEN MÉDICA', margin + 5, cursorY + 6);

  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);

  // Col 1
  doc.setFont('helvetica', 'bold');
  doc.text('Paciente:', margin + 5, cursorY + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(study.patientName, margin + 25, cursorY + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Expediente / ID:', margin + 5, cursorY + 19);
  doc.setFont('helvetica', 'normal');
  doc.text(study.patientIdentifier, margin + 32, cursorY + 19);

  doc.setFont('helvetica', 'bold');
  doc.text('Origen:', margin + 5, cursorY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(study.originInstitution || study.uploaderName, margin + 20, cursorY + 25);

  // Col 2
  const col2X = margin + contentWidth / 2 + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Modalidad:', col2X, cursorY + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(`${study.modality} (${getModalityLabel(study.modality)})`, col2X + 22, cursorY + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Región Anatómica:', col2X, cursorY + 19);
  doc.setFont('helvetica', 'normal');
  doc.text(study.bodyPart, col2X + 33, cursorY + 19);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha Estudio:', col2X, cursorY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(study.studyDate, col2X + 27, cursorY + 25);

  cursorY += 40;

  // Severity Level Badge Box
  const severityMeta = getSeverityMeta(report.severityLevel);
  if (report.severityLevel === 'critical') {
    doc.setFillColor(156, 59, 71); // #9C3B47 alert red
    doc.setTextColor(255, 255, 255);
  } else if (report.severityLevel === 'followup') {
    doc.setFillColor(217, 119, 6);
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setFillColor(81, 115, 39); // #517327 olive
    doc.setTextColor(255, 255, 255);
  }

  doc.roundedRect(margin, cursorY, contentWidth, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`CLASIFICACIÓN CLÍNICA: ${severityMeta.label.toUpperCase()}`, margin + 5, cursorY + 5.5);

  cursorY += 14;

  // Helper function to render text sections with wrapping
  const renderSection = (title: string, content: string, isBoxed = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(81, 115, 39);
    doc.text(title.toUpperCase(), margin, cursorY);
    cursorY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);

    const lines = doc.splitTextToSize(content || 'No especificado.', contentWidth - (isBoxed ? 8 : 0));
    const sectionHeight = lines.length * 4.4;

    if (isBoxed) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(59, 92, 168); // #3B5CA8
      doc.roundedRect(margin, cursorY - 1, contentWidth, sectionHeight + 5, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.text(lines, margin + 4, cursorY + 3.5);
      cursorY += sectionHeight + 10;
    } else {
      doc.text(lines, margin, cursorY);
      cursorY += sectionHeight + 6;
    }
  };

  renderSection('Técnica de Imagen y Protocolo de Lectura', report.technique);
  renderSection('Hallazgos Radiológicos', report.findings);
  renderSection('Impresión Diagnóstica (Conclusión Médica)', report.impression, true);
  renderSection('Recomendaciones y Conducta Sugerida', report.recommendations);

  // Signature Block at Bottom
  const bottomY = Math.max(cursorY + 6, 240);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, bottomY, pageWidth - margin, bottomY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(report.specialistName, margin, bottomY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${report.specialistSpecialty || 'Médico Radiólogo'} · Cédula Profesional: ${
      report.specialistLicense || 'Acreditada'
    }`,
    margin,
    bottomY + 12
  );
  doc.text(
    `Firmado electrónicamente en plataforma ImaRis: ${new Date(report.signedAt).toLocaleString('es-MX')}`,
    margin,
    bottomY + 17
  );

  doc.setFontSize(7.5);
  doc.setTextColor(81, 115, 39);
  doc.text('ImaRis Telemedicina · Validación Criptográfica SHA-256', pageWidth - margin, bottomY + 12, {
    align: 'right',
  });

  // Trigger browser download
  const safeAcc = study.accessionNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Dictamen_ImaRis_${safeAcc}.pdf`);
}
