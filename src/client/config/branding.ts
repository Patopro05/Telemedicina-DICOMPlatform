/**
 * Centralized Branding & Visual Identity Configuration
 *
 * When your team decides on final names, logos, fonts, or institutional labels,
 * update this single file to change branding across the entire web application.
 */

export interface BrandConfig {
  /** The main name of the platform (e.g. "TeleMed DICOM" or future team chosen name) */
  appName: string;
  /** Primary accent highlight word (e.g. "DICOM") */
  appHighlight: string;
  /** Short descriptive tagline */
  tagline: string;
  /** Subtitle shown under main headings */
  subtitle: string;
  /** Course / Institution descriptor for footers and formal headers */
  institutionLabel: string;
  /** Support contact or university email */
  contactEmail: string;
  /** Version indicator */
  version: string;
}

export const BRAND: BrandConfig = {
  appName: 'TeleMed',
  appHighlight: 'DICOM',
  tagline: 'Diagnóstico Médico a Distancia',
  subtitle: 'Plataforma Web de Teleradiología y Consulta Especializada de Imagen Médica',
  institutionLabel: 'Materia: Telemedicina · Proyecto de Diagnóstico Remoto (ISO 12052 / NEMA PS3)',
  contactEmail: 'contacto@telemed.mx',
  version: '1.0.0 (Producción Cloudflare)',
};
