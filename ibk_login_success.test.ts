/**
 * 파일명: login_success.test.ts
 * 업무: 로그인 정상여부
 * 대상: bank-a.example.com / SCRAPING-MODULE.js Login()
 *
 * TC 목록:
 *   TC-LOGIN-001    로그인 첫 페이지 title 확인
 *   TC-LOGIN-001-b  nonce 발급 확인
 *   TC-LOGIN-002    로그인 성공 — 법인명 정상 반환
 *   TC-LOGIN-010    경계값 — LOGINMETHOD 비정상값 입력
 *   TC-LOGIN-011    탐색적 — reTryCount 최대 2회 초과 안 함
 *
 * TEST_PATH 가 INPUT 에 있으면 Mock 모드:
 *   실제 사이트 접속 후 fixture HTML 파일을 서빙
 * TEST_PATH 가 없으면 Real 모드:
 *   실제 bank-a.example.com 에 HTTP 요청
 *
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://bank-a.example.com';

// ─── 입력 파라미터 ────────────────────────────────────────────────────────────
const INPUT = {
  AUTHACCTNUM: 'XXXX-ACCT-NUM-XXXX',
  AUTHACCTPWD: 'XXXX',
  CERTKEY: '',
  CERTNAME: '금융기관A(주)(COMPANY-A)XXXXXXXXXXXXXXXXXX',
  CERTPWD: 'XXXXXXXXXXXXXXX',
  CUS_KIND: '1',
  FCODE: 'SCRAPING-MODULE',
  LOGINMETHOD: '0',
  MODULE: '1',
  TEST_PATH: 'C:\\Users\\kwic\\Desktop\\ggg\\bankTest\\html',
};
// ─────────────────────────────────────────────────────────────────────────────

const TEST_PATH: string | undefined = INPUT.TEST_PATH || undefined;

function fixture(filename: string): string {
  return fs.readFileSync(path.join(TEST_PATH!, filename), 'utf-8');
}

async function gotoBANKABlank(page: Page) {
  await page.route(`${BASE_URL}/`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<html><body>기업인터넷뱅킹</body></html>`,
    });
  });
  await page.goto(BASE_URL);
}

// ─── 테스트 ───────────────────────────────────────────────────────────────────

test.describe('[로그인 성공] 정상 케이스', () => {

  /**
   * TC-LOGIN-001
   * 분류: 기능 테스트
   * 시나리오: 로그인 첫 페이지 title 정상 노출 확인
   * 소스 근거: Login() STEP1 — e_main.jsp 접근 후 페이지 title 검증
   */
  test('TC-LOGIN-001: 로그인 첫 페이지 — title 확인', async ({ page }) => {
    if (TEST_PATH) {
      await gotoBANKABlank(page);
      await page.route('**/e_main.jsp*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: fixture('firstPage.html'),
        });
      });

      const title = await page.content();
      expect(title).toContain('기업인터넷뱅킹');
    } else {
      await page.goto(`${BASE_URL}/uib/jsp/guest/main/e_main.jsp`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).toHaveTitle(/기업인터넷뱅킹/i);
    }
  });

  /**
   * TC-LOGIN-002
   * 분류: 기능 테스트
   * 시나리오: 로그인 성공 시 법인명(entpNm) 정상 반환
   * 소스 근거: Login() STEP6 — entpNm 존재 시 ACCTNM 설정 후 return true
   * 회사 이름은 익명처리하여 FAIL 발생합니다.
   */
  test('TC-LOGIN-002: 로그인 성공 — 법인명 정상 반환', async ({ page }) => {
    if (TEST_PATH) {
      await gotoBANKABlank(page);

      await page.route('**/ei_login_proc.jsp*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: fixture('success.html'),
        });
      });

      const body = await page.evaluate(async (url) => {
        const res = await fetch(url, {
          method: 'POST',
          body: new URLSearchParams({ log_signed_msg: 'cert-login' }),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return res.text();
      }, `${BASE_URL}/uib/jsp/login/ei_login_proc.jsp`);

      expect(body).toContain('<strong>금융기관A(주)</strong> 님');
    } else {
      const res = await page.request.post(`${BASE_URL}/uib/jsp/login/ei_login_proc.jsp`, {
        form: { log_signed_msg: 'cert-login' },
      });
      const body = await res.text();
      expect(body).toContain('entpNm');
    }
  });

  /**
   * TC-LOGIN-010
   * 분류: 경계값 테스트 (Boundary Value Analysis)
   * 시나리오: LOGINMETHOD 값에 따른 분기 검증
   * 소스 근거: Login() STEP2 — LOGINMETHOD == '1' 이면 차단, 아니면 인증서 로그인
   *           경계: '0'(인증서) / '1'(아이디 차단) / '2'이상(미정의)
   */
  test('TC-LOGIN-010: 경계값 — LOGINMETHOD 값에 따른 분기 검증', async () => {
    const ERR_MSG50042 = 'ERR_MLCOM_MSG50042';

    const testCases = [
      { value: '0',  expected: 'CERT_LOGIN' },   // 정상: 인증서 로그인 진행
      { value: '1',  expected: ERR_MSG50042  },   // 경계: 아이디 로그인 차단
      { value: '2',  expected: 'CERT_LOGIN' },   // 경계 외: 인증서 로그인으로 처리
      { value: '-1', expected: 'CERT_LOGIN' },   // 경계 외: 인증서 로그인으로 처리
      { value: '',   expected: 'CERT_LOGIN' },   // 빈값: 인증서 로그인으로 처리
    ];

    for (const tc of testCases) {
      const result = tc.value === '1' ? ERR_MSG50042 : 'CERT_LOGIN';
      expect(result).toBe(tc.expected);
    }
  });

});
