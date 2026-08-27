export type Gender = 'male' | 'female' | 'unknown';

export type MembershipTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecognizedFace {
  faceId: string;
  bbox: FaceBox;
  age: number;
  gender: Gender;
  detectionScore: number;
  matchScore?: number;
}

export interface PurchaseSummary {
  productId: string;
  productName: string;
  imageUrl?: string;
  lastBoughtAt: string;
  totalTimes: number;
  category: string;
}

export interface RecommendedProduct {
  productId: string;
  name: string;
  imageUrl?: string;
  price: number;
  reason: string;
  score: number;
  category: string;
}

export interface MemberProfile {
  memberId: string;
  fullName: string;
  displayName: string;
  tier: MembershipTier;
  points: number;
  memberSince: string;
  avatarUrl?: string;
  totalSpend: number;
  visitCount: number;
}

export interface RecognitionResult {
  faceId: string;
  bbox: FaceBox;
  estimatedAge: number;
  ageBucket: string;
  gender: Gender;
  isMember: boolean;
  matchConfidence?: number;
  member?: MemberProfile;
  recentPurchases: PurchaseSummary[];
  recommendations: RecommendedProduct[];
  suggestedScript: string;
  capturedAt: string;
}

export interface FrameMessage {
  imageBase64: string;
  ts: number;
  frameId: string;
}

export interface RecognitionMessage {
  frameId: string;
  results: RecognitionResult[];
  processedAt: string;
  processingMs: number;
}
