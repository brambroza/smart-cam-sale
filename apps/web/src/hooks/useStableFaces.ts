import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecognitionMessage, RecognitionResult, FaceBox } from '@smart-cam/shared-types';

const AGE_ALPHA = 0.25; // smoothing factor for age (lower = smoother)
const CONF_ALPHA = 0.35;
const STALE_MS = 3000;
const PRUNE_INTERVAL_MS = 500;

export interface StableFace {
  identityKey: string;
  result: RecognitionResult;
  lastSeenAt: number;
  updatedAt: number;
}

function identityFor(r: RecognitionResult): string {
  if (r.isMember && r.member) return `m:${r.member.memberId}`;
  return `g:${r.ageBucket}:${r.gender}`;
}

function bboxDist(a: FaceBox, b: FaceBox) {
  const dx = a.x + a.width / 2 - (b.x + b.width / 2);
  const dy = a.y + a.height / 2 - (b.y + b.height / 2);
  return Math.hypot(dx, dy);
}

function ema(prev: number, next: number, alpha: number) {
  return prev + alpha * (next - prev);
}

export function useStableFaces(last: RecognitionMessage | null) {
  const facesRef = useRef<Map<string, StableFace>>(new Map());
  const [snapshot, setSnapshot] = useState<StableFace[]>([]);

  useEffect(() => {
    if (!last) return;
    const now = Date.now();
    const map = facesRef.current;
    const seenKeys = new Set<string>();

    for (const r of last.results) {
      // Try match by identity first; if guest tuple ambiguous, refine by bbox proximity
      let key = identityFor(r);
      // Guests with same bucket/gender collide — disambiguate by bbox distance
      if (key.startsWith('g:')) {
        let bestKey: string | null = null;
        let bestDist = 120;
        for (const [k, f] of map) {
          if (!k.startsWith('g:')) continue;
          if (seenKeys.has(k)) continue;
          if (k.split(':').slice(0, 3).join(':') !== key) continue;
          const d = bboxDist(f.result.bbox, r.bbox);
          if (d < bestDist) {
            bestDist = d;
            bestKey = k;
          }
        }
        if (bestKey) key = bestKey;
        else key = `${key}:${r.bbox.x.toFixed(0)}-${r.bbox.y.toFixed(0)}`;
      }
      seenKeys.add(key);

      const prev = map.get(key);
      const smoothed: RecognitionResult = prev
        ? {
            ...r,
            estimatedAge: Math.round(ema(prev.result.estimatedAge, r.estimatedAge, AGE_ALPHA)),
            matchConfidence:
              r.matchConfidence !== undefined && prev.result.matchConfidence !== undefined
                ? ema(prev.result.matchConfidence, r.matchConfidence, CONF_ALPHA)
                : r.matchConfidence,
          }
        : r;

      map.set(key, {
        identityKey: key,
        result: smoothed,
        lastSeenAt: now,
        updatedAt: now,
      });
    }

    // Publish snapshot
    setSnapshot(
      Array.from(map.values()).sort((a, b) => {
        // members before guests, then by match confidence desc
        const am = a.result.isMember ? 1 : 0;
        const bm = b.result.isMember ? 1 : 0;
        if (am !== bm) return bm - am;
        return (b.result.matchConfidence ?? 0) - (a.result.matchConfidence ?? 0);
      }),
    );
  }, [last]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const map = facesRef.current;
      let changed = false;
      for (const [k, f] of map) {
        if (now - f.lastSeenAt > STALE_MS) {
          map.delete(k);
          changed = true;
        }
      }
      if (changed) {
        setSnapshot(
          Array.from(map.values()).sort((a, b) => {
            const am = a.result.isMember ? 1 : 0;
            const bm = b.result.isMember ? 1 : 0;
            if (am !== bm) return bm - am;
            return (b.result.matchConfidence ?? 0) - (a.result.matchConfidence ?? 0);
          }),
        );
      }
    }, PRUNE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => snapshot, [snapshot]);
}
