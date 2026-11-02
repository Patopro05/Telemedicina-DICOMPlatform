/**
 * Centralized Branding & Visual Identity Configuration for ImaRis
 *
 * Palette:
 * - Olive Primary (#517327): Overall cover of all areas, tabs, nav headers, accents
 * - Olive Accent (#617E3C): Secondary headers, active highlights, badges
 * - Action Blue (#3B5CA8): Primary action buttons, accepting, allow, positive CTAs
 * - Action Blue Hover (#5A75BC): Hover state for action buttons
 * - Alert Red (#9C3B47): Critical alerts, STAT emergency badges, trouble warnings
 */

export interface BrandConfig {
  appName: string;
  appHighlight: string;
  tagline: string;
  subtitle: string;
  institutionLabel: string;
  contactEmail: string;
  version: string;
  logoHeartPath: string;
  logoFullPath: string;
  palette: {
    olivePrimary: string;
    oliveSecondary: string;
    actionBlue: string;
    actionBlueHover: string;
    alertRed: string;
  };
}

export const BRAND: BrandConfig = {
  appName: 'ImaRis',
  appHighlight: 'DICOM',
  tagline: 'Plataforma Web de Teleradiología y Diagnóstico Remoto',
  subtitle: 'Carga, Consulta Especializada y Emisión de Diagnósticos Remotos de Imagen Médica (ISO 12052 / NEMA PS3)',
  institutionLabel: 'Materia: Telemedicina · Proyecto Clínico de Diagnóstico Remoto',
  contactEmail: 'contacto@imaris.mx',
  version: '1.2.0 (Producción Cloudflare)',
  logoHeartPath: '/imaris_heart.svg',
  logoFullPath: '/imaris_logo.svg',
  palette: {
    olivePrimary: '#517327',
    oliveSecondary: '#617E3C',
    actionBlue: '#3B5CA8',
    actionBlueHover: '#5A75BC',
    alertRed: '#9C3B47',
  },
};
