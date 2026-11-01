import type { UserProfile } from '../shared/types';

export interface Env {
  DB: D1Database;
  DICOM_BUCKET?: R2Bucket;
  ASSETS: Fetcher;
}

export interface Variables {
  user: UserProfile | null;
}
