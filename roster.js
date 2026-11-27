// 참가자 이름 입력 처리용 순수 함수 모음 (DOM·three.js 의존 없음, node 로 단위 확인 가능)
// 기본 참가자 6명. 기본 공 개수는 6: 구 기본(13명 x 3개 = 39개)과 총 공 개수가 비슷한 36개가 된다.
export const DEFAULT_PEOPLE = ['김사장', '이박사', '박여사', '최회장', '황간첩', '국카스텐'];
// 이전 버전의 기본값(13명, 각 3개). 이 값 그대로 저장돼 있으면 새 기본으로 대체한다 (사용자가 편집한 데이터는 건드리지 않는다).
export const LEGACY_PEOPLE = ['benjamin.butn', 'angus.bak', 'bayne.jeong', 'beans.go', 'frisk.gwak', 'hasey.chong2', 'isla.moon', 'jacob.nam', 'jaeky.rs', 'kane.woz', 'kenny.kim2', 'otto.yoon', 'rudy.yoon'];
export const LEGACY_BALLS = 3;
export const MAX_NAME_LEN = 20, DEFAULT_BALLS = 6, PAGE_SIZE = 14, MIN_PLAYERS = 2;   // 인원 상한은 두지 않는다

/** 이름 한 줄 정리: 제어문자 제거, 공백 정리, 길이 제한. */
export const cleanName = s => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);

/**
 * 이름 목록의 중복을 "이름 (2)" 처럼 구분 가능하게 바꾼다. 앞에 있는 이름은 그대로 두므로
 * 이미 구분된 목록 뒤에 새 이름을 붙여 다시 돌려도 기존 이름은 바뀌지 않는다. O(n).
 */
export function dedupeNames(names) {
  const used = new Set(), seen = new Map(), out = [];
  for (const b of names) {
    let n = b, k = seen.get(b) || 1;
    while (used.has(n)) { k++; const suf = ` (${k})`; n = b.slice(0, MAX_NAME_LEN - suf.length) + suf; }
    seen.set(b, k); used.add(n); out.push(n);
  }
  return out;
}

/** 텍스트(한 줄에 한 명) 또는 배열을 정리해 빈 줄을 버린 이름 배열로 만든다. 중복 구분은 dedupeNames 로 따로 한다. */
export const parseNames = raw => (Array.isArray(raw) ? raw : String(raw ?? '').split(/\r?\n/)).map(cleanName).filter(Boolean);

/** 페이지 계산. page 는 0부터이며 범위를 벗어나면 보정한다. */
export function paginate(total, page, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size)), p = Math.min(Math.max(0, page | 0), pages - 1);
  return { pages, page: p, start: p * size, end: Math.min(total, (p + 1) * size) };
}

/** 입력 순서대로 색(HSL 색상각, 0~1)을 배정한다. 황금비 간격이라 인원이 많아도 순환하며 구분된다. */
export const hueFor = i => (i * 0.618034 + 0.02) % 1;

/**
 * 저장된 이름/공 개수로 초기 상태를 만든다. 저장 데이터가 아예 없을 때만(배열이 아닐 때) 기본값을 쓰고,
 * 빈 목록([])도 그대로 복원한다. 구 기본 13명(각 3개)과 완전히 같으면 새 기본으로 대체한다.
 */
export function restoreState(savedNames, savedCounts, maxBalls = 500) {
  const fresh = () => ({ names: DEFAULT_PEOPLE.slice(), counts: DEFAULT_PEOPLE.map(() => DEFAULT_BALLS) });
  if (!Array.isArray(savedNames)) return fresh();
  const names = dedupeNames(parseNames(savedNames));
  const okCounts = Array.isArray(savedCounts) && savedCounts.length === names.length;
  const counts = okCounts ? savedCounts.map(n => Math.min(maxBalls, Math.max(0, Math.round(+n) || 0))) : names.map(() => DEFAULT_BALLS);
  const legacy = names.length === LEGACY_PEOPLE.length && names.every((n, i) => n === LEGACY_PEOPLE[i]) && (!okCounts || counts.every(n => n === LEGACY_BALLS));
  return legacy ? fresh() : { names, counts };
}
