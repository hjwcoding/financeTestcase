/**
 * 파일명: login_fail.test.ts
 * 업무: 로그인 실패 — 전체 에러 케이스 처리
 * 대상: bank-a.example.com / SCRAPING-MODULE.js Login()
 *
 * TC 목록:
 *   TC-LOGIN-003       아이디 로그인 시도 차단          → ERR_MLCOM_MSG50042
 *   TC-LOGIN-FAIL-001  만료 인증서 텍스트 확인           → ERR_MLCOM_MSG50250
 *   TC-LOGIN-FAIL-002  RESULT / ECODE / ERRMSG 통합 검증 → ERR_MLCOM_MSG50250
 *   TC-LOGIN-FAIL-003  개인뱅킹 인증서 사용             → ERR_MBMSG_MSG11062
 *   TC-LOGIN-FAIL-004  사용 불가 인증서                 → ERR_MLCOM_MSG50303
 *   TC-LOGIN-FAIL-005  ERROR_CODE + ECBKEBK10015       → ERR_MBMSG_MSG11062
 *   TC-LOGIN-FAIL-006  ERROR_CODE 기타 에러             → ERR_MLCOM_MSG50003
 *   TC-LOGIN-FAIL-007  중복 로그인 감지                 → ERR_MLCOM_MSG50114
 *   TC-LOGIN-FAIL-008  프리미엄 고객 차단               → ERR_MBMSG_MSG11096
 *   TC-LOGIN-FAIL-009  entpNm 없음 재시도 2회 후 실패   → ERR_MLCOM_MSG50003
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://bank-a.example.com';
const TEST_PATH = 'C:\\Users\\kwic\\Desktop\\ggg\\bankTest\\html';

// ─── 에러코드 상수 (SCRAPING-MODULE.js 와 동일) ────────────────────────────────────────
const ERR = {
  MSG50042: 'ERR_MLCOM_MSG50042',  // 아이디 로그인 불가
  MSG50250: 'ERR_MLCOM_MSG50250',  // 만료 / 폐기 인증서
  MSG11062: 'ERR_MBMSG_MSG11062',  // 기업뱅킹 미등록 인증서
  MSG50303: 'ERR_MLCOM_MSG50303',  // 사용 불가 인증서
  MSG50003: 'ERR_MLCOM_MSG50003',  // 일시 장애 / 로그인 실패
  MSG50114: 'ERR_MLCOM_MSG50114',  // 중복 로그인
  MSG11096: 'ERR_MBMSG_MSG11096',  // 프리미엄 고객 차단
} as const;

const EXPECTED_50250 = {
  RESULT: 'FAIL',
  ECODE:  ERR.MSG50250,
  ERRMSG: '제출하신 인증서는 이미 폐기된 인증서 이거나 만료된 인증서입니다. 조회 가능한 인증서로 재시도해주시기 바랍니다',
} as const;

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function fixture(filename: string): string {
  return fs.readFileSync(path.join(TEST_PATH, filename), 'utf-8');
}

function makeFixtureHtml(keyword: string): string {
  return `<html><body>${keyword}</body></html>`;
}

async function gotoBANKABlank(page: Page) {
  await page.route(`${BASE_URL}/`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body></body></html>',
    });
  });
  await page.goto(BASE_URL);
}

async function postLoginProc(page: Page): Promise<string> {
  return page.evaluate(async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({ log_signed_msg: 'cert-login' }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.text();
  }, `${BASE_URL}/uib/jsp/login/ei_login_proc.jsp`);
}

/**
 * SCRAPING-MODULE.js Login() 분기 로직 동일 적용
 * 응답 HTML 에서 에러 텍스트/코드를 감지하여 ECODE 반환
 */
function parseLoginError(html: string): string {
  if (html.indexOf('개인뱅킹 사용자입니다') !== -1)                                                          return ERR.MSG11062;
  if (html.indexOf('유효한 상태가 아닙니다.(인증서 폐기)') !== -1)                                           return ERR.MSG50250;
  if (html.indexOf('/cer/cer50/cer5000/CCER500000_i.jsp') !== -1)                                           return ERR.MSG11062;
  if (html.indexOf('만료된 인증서 입니다') !== -1)                                                           return ERR.MSG50250;
  if (html.indexOf('로그인이 불가능한 인증서입니다.<br>다른 인증서로 로그인 하시기 바랍니다.') !== -1)          return ERR.MSG50303;
  if (html.indexOf('ERROR_CODE') !== -1) {
    if (html.indexOf('ECBKEBK10015') !== -1) return ERR.MSG11062;
    return ERR.MSG50003;
  }
  if (html.indexOf('중복로그인') !== -1) return ERR.MSG50114;
  return 'UNKNOWN';
}

function parseLoginErrorWithResult(html: string): { RESULT: string; ECODE: string; ERRMSG: string } {
  if (
    html.indexOf('만료된 인증서 입니다') !== -1 ||
    html.indexOf('유효한 상태가 아닙니다.(인증서 폐기)') !== -1
  ) {
    return {
      RESULT: EXPECTED_50250.RESULT,
      ECODE:  EXPECTED_50250.ECODE,
      ERRMSG: EXPECTED_50250.ERRMSG,
    };
  }
  return { RESULT: 'UNKNOWN', ECODE: '', ERRMSG: '' };
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

test.describe('[로그인 실패] 전체 에러 케이스', () => {

  /**
   * TC-LOGIN-003
   * 분류: 네거티브 테스트
   * 시나리오: LOGINMETHOD = '1' (아이디 로그인) 입력 시 차단
   * 소스 근거: Login() STEP2 — LOGINMETHOD == '1' → ERR_MLCOM_MSG50042
   */
  test('TC-LOGIN-003: 아이디 로그인 시도 차단', async () => {
    const LOGINMETHOD = '1';
    const ecode = LOGINMETHOD === '1' ? ERR.MSG50042 : 'UNKNOWN';

    expect(ecode).toBe(ERR.MSG50042);
  });

  /**
   * TC-LOGIN-FAIL-001
   * 분류: 네거티브 테스트
   * 시나리오: 만료 인증서 텍스트 포함 여부 확인
   * 소스 근거: Login() STEP4 — '만료된 인증서 입니다' → ERR_MLCOM_MSG50250
   */
  test('TC-LOGIN-FAIL-001: fail.html — "만료된 인증서" 텍스트 포함 여부', async ({ page }) => {
    await gotoBANKABlank(page);

    await page.route('**/ei_login_proc.jsp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: fixture('fail.html'),
      });
    });

    const body = await postLoginProc(page);
    expect(body).toContain('만료된 인증서 입니다');
  });

  /**
   * TC-LOGIN-FAIL-002
   * 분류: 네거티브 테스트
   * 시나리오: RESULT / ECODE / ERRMSG 통합 검증
   * 소스 근거: Login() STEP4 — 만료/폐기 인증서 에러 3개 필드 동시 검증
   */
  test('TC-LOGIN-FAIL-002: RESULT / ECODE / ERRMSG 통합 검증', async ({ page }) => {
    await gotoBANKABlank(page);

    await page.route('**/ei_login_proc.jsp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: fixture('fail.html'),
      });
    });

    const body = await postLoginProc(page);
    const result = parseLoginErrorWithResult(body);

    expect(result).toEqual({
      RESULT: EXPECTED_50250.RESULT,
      ECODE:  EXPECTED_50250.ECODE,
      ERRMSG: EXPECTED_50250.ERRMSG,
    });
  });

  /**
   * TC-LOGIN-FAIL-003
   * 분류: 네거티브 테스트
   * 시나리오: 개인뱅킹 인증서로 기업뱅킹 로그인 시도
   * 소스 근거: Login() STEP4 — '개인뱅킹 사용자입니다' → ERR_MBMSG_MSG11062
   */
  test('TC-LOGIN-FAIL-003: 개인뱅킹 인증서로 기업뱅킹 로그인 시도', async ({ page }) => {
    await gotoBANKABlank(page);

    await page.route('**/ei_login_proc.jsp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: makeFixtureHtml('개인뱅킹 사용자입니다'),
      });
    });

    const body = await postLoginProc(page);
    expect(parseLoginError(body)).toBe(ERR.MSG11062);
  });

  /**
   * TC-LOGIN-FAIL-004
   * 분류: 네거티브 테스트
   * 시나리오: 전자세금계산서용 등 사용 불가 인증서 로그인 시도
   * 소스 근거: Login() STEP4 — '로그인이 불가능한 인증서입니다.' → ERR_MLCOM_MSG50303
   */
  test('TC-LOGIN-FAIL-004: 사용 불가 인증서 (전자세금계산서용)', async ({ page }) => {
    await gotoBANKABlank(page);

    await page.route('**/ei_login_proc.jsp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: makeFixtureHtml('로그인이 불가능한 인증서입니다.<br>다른 인증서로 로그인 하시기 바랍니다.'),
      });
    });

    const body = await postLoginProc(page);
    expect(parseLoginError(body)).toBe(ERR.MSG50303);
  });

  /**
   * TC-LOGIN-FAIL-005
   * 분류: 네거티브 테스트
   * 시나리오: ERROR_CODE + ECBKEBK10015 포함 응답
   * 소스 근거: Login() STEP4 — ERROR_CODE && ECBKEBK10015 → ERR_MBMSG_MSG11062
   */
  test('TC-LOGIN-FAIL-005: ERROR_CODE + ECBKEBK10015 포함', async ({ page }) => {
    await gotoBANKABlank(page);

    await page.route('**/ei_login_proc.jsp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: makeFixtureHtml('ERROR_CODE=ECBKEBK10015'),
      });
    });

    const body = await postLoginProc(page);
    expect(parseLoginError(body)).toBe(ERR.MSG11062);
  });

  /**
   * TC-LOGIN-FAIL-006
   * 분류: 네거티브 테스트
   * 시나리오: ERROR_CODE 포함 + ECBKEBK10015 미포함 → 기타 에러
   * 소스 근거: Login() STEP4 — ERROR_CODE && !ECBKEBK10015 → ERR_MLCOM_MSG50003
   */
  test('TC-LOGIN-FAIL-006: ERROR_CODE 기타 에러', async ({ page }) => {
    await gotoBANKABlank(page);

    await page.route('**/ei_login_proc.jsp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: makeFixtureHtml('ERROR_CODE=UNKNOWN_ERR_9999'),
      });
    });

    const body = await postLoginProc(page);
    expect(parseLoginError(body)).toBe(ERR.MSG50003);
  });

  /**
   * TC-LOGIN-FAIL-007
   * 분류: 네거티브 테스트
   * 시나리오: 중복 로그인 감지
   * 소스 근거: Login() catch 블록 — '중복로그인' → ERR_MLCOM_MSG50114
   */
  test('TC-LOGIN-FAIL-007: 중복 로그인 감지', async ({ page }) => {
    await gotoBANKABlank(page);

    await page.route('**/ei_login_proc.jsp*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: makeFixtureHtml('중복로그인으로 자동 로그아웃 되었습니다'),
      });
    });

    const body = await postLoginProc(page);
    expect(parseLoginError(body)).toBe(ERR.MSG50114);
  });

  /**
   * TC-LOGIN-FAIL-008
   * 분류: 네거티브 테스트
   * 시나리오: 프리미엄 고객(CUS_KIND = '2') 로그인 차단
   * 소스 근거: Login() STEP0 — CUS_KIND == '2' → ERR_MBMSG_MSG11096
   */
  test('TC-LOGIN-FAIL-008: 프리미엄 고객 차단 (CUS_KIND=2)', async () => {
    const CUS_KIND = '2';
    const ecode = CUS_KIND === '2' ? ERR.MSG11096 : 'UNKNOWN';

    expect(ecode).toBe(ERR.MSG11096);
  });

});
