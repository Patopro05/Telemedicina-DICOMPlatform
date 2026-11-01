# TeleMed DICOM - Remote Teleradiology Web Platform

Production web platform for remote medical imaging diagnosis in **DICOM (ISO 12052 / NEMA PS3)** format, built for the **Telemedicina** course.

## Clinical Roles and Capabilities

- **Patients / Users (`patient`)**:
  - Dedicated DICOM upload tab (`/panel/cargar`) with client-side binary preamble validation, metadata extraction, SHA-256 integrity hashing, and optional PS3.15 tag anonymization.
  - Real-time study status tracking and printable signed remote diagnostic reports (`/panel/estudios`).
- **Clinics and Hospitals (`clinic`)**:
  - Institutional registration with sanitary / CLUES code.
  - Multi-slice CT, MRI, and Digital Radiography upload with clinical priority (`Routine`, `Urgent`, `STAT`) and optional patient account linking via email.
- **Specialist Physicians (`specialist`)**:
  - Dedicated teleradiology worklist and lossless DICOM download tab (`/panel/descarga`) supporting single `.dcm` slice download and complete series `.zip` archive download with SHA-256 verification manifests.
  - Built-in 16-bit HTML5 Canvas DICOM Workstation with calibrated Hounsfield Unit (`HU`) cursor probe, radiological Window/Level presets (*Lung*, *Soft Tissue*, *Bone*, *Brain*), multi-slice scrubbing, zoom/pan/rotation/polarity inversion, and NEMA PS3.6 Tag Inspector.
  - Structured remote diagnostic report emission and electronic signing.

## Pre-Seeded Academic Evaluation Accounts

Password for all demo accounts: `Telemed2026!`

| Role | Email | Default View |
| :--- | :--- | :--- |
| **Patient** | `paciente@telemed.mx` | `/panel/estudios` & `/panel/cargar` |
| **Hospital / Clinic** | `clinica@telemed.mx` | `/panel/estudios` & `/panel/cargar` |
| **Specialist Physician** | `especialista@telemed.mx` | `/panel/descarga` |

## Unified Cloudflare Production Stack

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide Icons
- **Edge Backend**: Hono on Cloudflare Workers (Static Assets + Edge API)
- **Relational Database**: Cloudflare D1 (SQLite at the Edge, auto-initialized and seeded on first boot)
- **Binary DICOM Storage**: Cloudflare R2 (`DICOM_BUCKET`) with automatic zero-configuration fallback to chunked D1 binary blobs (`file_chunks`)

## Local Development and Verification

```bash
npm install
npm test
npm run preview
```

## Deploying to Cloudflare Production

1. Authenticate Wrangler with your Cloudflare account:
   ```bash
   npx wrangler login
   ```
2. Create your Cloudflare D1 database and paste the returned `database_id` into `wrangler.toml`:
   ```bash
   npx wrangler d1 create telemedicina-dicom-db
   ```
3. *(Optional)* If you enable Cloudflare R2 for multi-hundred-MB DICOM archives, create the bucket and uncomment `[[r2_buckets]]` in `wrangler.toml`:
   ```bash
   npx wrangler r2 bucket create telemedicina-dicom-files
   ```
4. Build and deploy live to `*.workers.dev`:
   ```bash
   npm run deploy
   ```
