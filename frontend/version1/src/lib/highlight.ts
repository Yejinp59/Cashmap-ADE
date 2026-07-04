// 공시 본문 하이라이트 유틸
// AI-A가 넘겨준 highlights[{sentence, score, category}]를 본문 안에서 찾아
// 일반 텍스트 / 하이라이트 구간으로 쪼갠다. (offset이 아니라 sentence 매칭 방식)

export interface Highlight {
  sentence: string;
  score: number;
  category?: string | null;
}

export interface Segment {
  text: string;
  highlight?: Highlight; // 있으면 <mark> 대상
}

// 신호 강도 → tailwind 배경 클래스 (강할수록 진하게)
export function highlightClass(score: number): string {
  if (score >= 0.85) return "bg-success/40 dark:bg-success/30";
  if (score >= 0.65) return "bg-success/25 dark:bg-success/20";
  return "bg-warning/25 dark:bg-warning/20";
}

// 본문을 세그먼트 배열로 변환. 매칭 안 되는 하이라이트는 무시(본문 변형 대비).
export function buildHighlightSegments(
  content: string,
  highlights: Highlight[] | null | undefined,
): Segment[] {
  if (!content) return [];
  if (!highlights || highlights.length === 0) return [{ text: content }];

  // 각 하이라이트 문장의 본문 내 위치를 찾는다.
  type Range = { start: number; end: number; hl: Highlight };
  const ranges: Range[] = [];
  for (const hl of highlights) {
    const needle = (hl.sentence || "").trim();
    if (!needle) continue;
    const idx = content.indexOf(needle);
    if (idx === -1) continue; // 본문에서 못 찾으면 스킵
    ranges.push({ start: idx, end: idx + needle.length, hl });
  }

  if (ranges.length === 0) return [{ text: content }];

  // 시작 위치 정렬 + 겹치는 구간 제거(먼저 온 것 우선)
  ranges.sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start >= lastEnd) {
      merged.push(r);
      lastEnd = r.end;
    }
  }

  // 세그먼트 조립
  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) {
      segments.push({ text: content.slice(cursor, r.start) });
    }
    segments.push({ text: content.slice(r.start, r.end), highlight: r.hl });
    cursor = r.end;
  }
  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor) });
  }
  return segments;
}
