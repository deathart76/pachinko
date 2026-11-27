// 회귀 테스트(playwright). 사용법: 저장소 루트에서 `python3 -m http.server 8765` 실행 후 `node tests/regression.cjs`
// PLAYWRIGHT 환경변수로 playwright 모듈 경로를 줄 수 있다. 실패하면 종료 코드 1.
const { execSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8765/', OLD = 'c3be22a', BROKEN = 'fc11a63';   // OLD: restoreState 가 없던 roster.js 시점, BROKEN: 캐시 버그가 난 index.html 시점
const git = (rev, f) => execSync(`git show ${rev}:${f}`, { encoding: 'utf8', cwd: __dirname + '/..' });
const NOGL = `const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(/webgl/.test(t))return null;return g.call(this,t,...a)};`;
const SIX = ['김사장', '이박사', '박여사', '최회장', '황간첩', '국카스텐'];
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async ({ init, route, wait = 'START' } = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1000, height: 800 } }), pg = await ctx.newPage(); pg.errs = [];
    pg.on('pageerror', e => pg.errs.push(e.message)); if (init) await pg.addInitScript(init); if (route) await route(pg);
    await pg.goto(BASE + 'index.html'); await pg.waitForTimeout(wait === 'START' ? 0 : 3000);
    if (wait === 'START') await pg.waitForFunction(() => document.getElementById('btnGo').textContent === 'START', null, { timeout: 60000 });
    return pg;
  };
  const names = pg => pg.$$eval('#rows .nm', e => e.map(i => i.value));
  const cnt = pg => pg.textContent('#pCount');

  let pg = await open(); ok(JSON.stringify(await names(pg)) === JSON.stringify(SIX), '최초 접속 6명(순서 포함)');
  await pg.click('#addOne'); ok(await cnt(pg) === '7', '참가자 추가 버튼으로 7명');
  await pg.evaluate(() => document.querySelector('details.bulk').open = true); await pg.fill('#bulk', 'a\nb\n\nc'); await pg.click('#bulkAdd'); ok(await cnt(pg) === '10', '일괄 추가로 10명');
  await pg.click('#namesReset'); ok(JSON.stringify(await names(pg)) === JSON.stringify(SIX), "'기본 목록으로' 6명 복원");
  for (let i = 0; i < 6; i++) await pg.click('#rows .row:first-child .del');
  ok(await cnt(pg) === '0' && await pg.isDisabled('#btnGo'), '전부 삭제 후 빈 목록 + 시작 버튼 비활성');
  ok(await pg.isVisible('#rows .empty .icon-btn.big >> nth=1'), '빈 목록 화면에 큰 버튼 표시');
  await pg.click('#rows .empty .icon-btn.big >> nth=1'); ok(JSON.stringify(await names(pg)) === JSON.stringify(SIX), '빈 목록 화면의 기본 목록 버튼으로 6명 복원');
  for (let i = 0; i < 6; i++) await pg.click('#rows .row:first-child .del');
  await pg.reload(); await pg.waitForFunction(() => document.getElementById('btnGo').textContent !== 'LOADING…', null, { timeout: 60000 });
  ok(await cnt(pg) === '0', '새로고침 후에도 빈 목록 유지'); await pg.click('#namesReset'); ok(await cnt(pg) === '6', '저장값 names=[] 상태에서 기본 목록 버튼 동작');
  await pg.context().close();

  for (const [label, seed] of [['배열 아님', `localStorage.setItem('pachinko.names','{"a":1}')`], ['요소가 문자열 아님', `localStorage.setItem('pachinko.names','[1,null]')`], ['JSON 깨짐', `localStorage.setItem('pachinko.names','{{{')`]]) {
    pg = await open({ init: seed }); ok(await cnt(pg) === '6', `깨진 저장값(${label}) -> 기본 6명`); await pg.context().close();
  }
  pg = await open({ init: `if(!localStorage.getItem('x')){localStorage.setItem('x','1');localStorage.setItem('pachinko.names','[]');localStorage.setItem('pachinko.counts','[]')}`, wait: 'fixed' });
  ok(await cnt(pg) === '0', '저장값 names=[] -> 빈 목록'); await pg.click('#namesReset'); ok(await cnt(pg) === '6', 'names=[] 저장 상태에서 기본 목록 버튼 동작'); await pg.context().close();

  // 캐시 재현: 새 index.html 이 옛 roster.js(restoreState 없음)를 캐시에서 받는 상황. 버전 쿼리가 다르면 캐시된 옛 URL 을 쓰지 않아 정상이어야 한다.
  const oldRoster = git(OLD, 'roster.js');
  const serveOld = (match) => async pg => pg.route(match, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: oldRoster }));
  pg = await open({ route: serveOld(u => u.pathname.endsWith('/roster.js') && !u.search) });
  ok(await cnt(pg) === '6', '캐시된 옛 roster.js(쿼리 없는 URL)가 있어도 새 index 는 ?v= 로 새 파일을 받아 정상'); await pg.context().close();
  pg = await open({ route: serveOld(u => u.pathname.endsWith('/roster.js')), wait: 'fixed' });   // 쿼리 URL 까지 옛 파일이 오는 최악의 경우
  ok(await pg.isVisible('#loadFail') && /강력 새로고침/.test(await pg.textContent('#loadFail')), '모듈 로딩 실패 시 한국어 안내 표시'); await pg.context().close();
  // 수정 전 재현: fc11a63 의 index.html(쿼리 없음) + 옛 roster.js -> SyntaxError 로 UI 가 죽는다
  pg = await open({ wait: 'fixed', route: async p => { await p.route(u => u.pathname.endsWith('/index.html'), r => r.fulfill({ status: 200, contentType: 'text/html', body: git(BROKEN, 'index.html') })); await serveOld(u => u.pathname.endsWith('/roster.js'))(p); } });
  ok(pg.errs.some(e => /does not provide an export named 'restoreState'/.test(e)) && await pg.$$eval('#rows .row', e => e.length) === 0, '[재현] 수정 전 index + 옛 roster: SyntaxError 로 목록이 비어 있음'); await pg.context().close();

  // WebGL 비활성: 설정 UI 는 동작하고 한국어 안내가 표시된다
  pg = await open({ init: NOGL, wait: 'fixed' });
  ok(await cnt(pg) === '6' && await pg.$$eval('#rows .row', e => e.length) === 6, 'WebGL 비활성에서도 참가자 목록 렌더');
  await pg.click('#addOne'); ok(await cnt(pg) === '7', 'WebGL 비활성에서도 추가 버튼 동작'); await pg.click('#namesReset'); ok(await cnt(pg) === '6', 'WebGL 비활성에서도 기본 목록 버튼 동작');
  ok(await pg.isVisible('#loadFail'), 'WebGL 비활성 시 한국어 오류 안내 표시'); await pg.context().close();
  await b.close(); console.log(fails ? `실패 ${fails}건` : '전부 통과'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('예외', e.message.slice(0, 300)); process.exit(1); });
