export type DealType = 'monthly' | 'jeonse' | 'semi';
export type Status = 'reviewing' | 'candidate' | 'rejected' | 'contracted';
export type AnswerValue = string | string[] | number | null | undefined;

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy: number;
  savedAt: number;
}

export interface Property {
  id: string;
  dealType: DealType;
  nickname: string;
  agencyName?: string;
  agencyPhone?: string;
  address?: string;
  location?: GeoPoint;
  visitedAt?: string;
  moveInDate?: string;
  answers: Record<string, AnswerValue>;
  memo: string;
  rating?: number;
  status: Status;
  favorite: boolean;
  coverPhotoId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Photo {
  id: string;
  propertyId: string;
  blob: Blob;
  thumb: Blob;
  caption?: string;
  createdAt: number;
}

export interface Settings {
  id: 'app';
  baseRate: number; // 한국은행 기준금리 (%)
  lastBackupAt?: number;
}

export const DEAL_LABEL: Record<DealType, string> = {
  monthly: '월세',
  jeonse: '전세',
  semi: '반전세',
};

export const STATUS_LABEL: Record<Status, string> = {
  reviewing: '검토중',
  candidate: '후보',
  rejected: '탈락',
  contracted: '계약',
};
