# 금융기관 A 로그인 테스트 자동화

> 실무 스크래핑 모듈(Login-Module.js) 소스 로직 분석을 통해
> 로그인 플로우의 결함을 사전에 탐지하는 Playwright 자동화 테스트입니다.

---

## 📌 프로젝트 배경 및 목적

금융기관 A 법인 인터넷뱅킹 스크래핑 모듈 개발 완료 후,
로그인 플로우의 **정상 동작 및 예외 처리**를 검증하기 위한 자동화 테스트를 설계·구현하였습니다.

로그인은 전계좌조회 / 잔액조회 / 거래내역조회 / 자금이체 등
**모든 금융 업무의 선행 조건**으로, 인증서 상태에 따른 에러 처리가 정확히 동작해야 합니다.

### QA 목표

- **소스 로직 기반 TC 도출**: Login() 함수 분기 분석 → 누락 없는 시나리오 설계
- **결함 조기 발견**: 배포 전 인증서 에러 / 예외 케이스 자동 검증으로 회귀 방지
- **재현 가능한 테스트 환경**: Mock 모드로 외부 의존 없이 언제든 실행 가능

---

## 🧪 테스트 설계 전략

### 리스크 기반 시나리오 도출

소스코드(Login-Module.js Login 함수) 분기 로직을 분석하여
실제 발생 빈도와 영향도를 기준으로 우선순위를 정의하였습니다.

| 우선순위 | 시나리오 | 근거 |
|---|---|---|
| **P1** | 로그인 성공 — 법인명 반환 | 모든 업무의 전제 조건 |
| **P1** | 만료 / 폐기 인증서 차단 | 가장 빈도 높은 실패 케이스 |
| **P2** | 개인뱅킹 / 사용 불가 인증서 | 오입력 가능성 있는 케이스 |
| **P2** | 아이디 로그인 차단 | 지원하지 않는 로그인 방식 |
| **P3** | 중복 로그인 / 프리미엄 고객 차단 | 특수 환경 케이스 |
| **P3** | 경계값 / 재시도 로직 | 소스 로직 탐색적 검증 |

### Mock / Real 이중 모드

| 모드 | 조건 | 동작 |
|---|---|---|
| **Mock 모드** | `TEST_PATH` 값 있음 | `html/` 폴더의 fixture HTML을 `page.route()`로 서빙 — 실서버 접속 없음 |
| **Real 모드** | `TEST_PATH` 비어 있음 | 실제 대상 서버에 HTTP 요청 |

### 핵심 기술 이슈 해결

`page.request.post/get()` 은 `page.route()` 인터셉터를 우회하는 Playwright 특성이 있어
**`page.evaluate()` 내부에서 `fetch()`를 호출**하는 방식으로 Mock 모드를 구현하였습니다.

---

## 📋 테스트 케이스 명세

### ✅ 성공 케이스 (`login_success.test.ts`) — 4건

| TC ID | 시나리오 | 테스트 유형 | 검증 내용 |
|---|---|---|---|
| TC-LOGIN-001 | 로그인 첫 페이지 title 확인 | 기능 테스트 | 전체 HTML 내 `기업인터넷뱅킹` 텍스트 존재 |
| TC-LOGIN-002 | 로그인 성공 — 법인명 반환 | 기능 테스트 | 응답 HTML 내 법인명(`금융기관A(주)`) 텍스트 확인 |
| TC-LOGIN-010 | LOGINMETHOD 경계값 분기 검증 | 경계값 테스트 | `'0'` / `'1'` / `'2'` / `''` 입력별 동작 확인 |
| TC-LOGIN-011 | reTryCount 최대 2회 초과 안 함 | 탐색적 테스트 | 재시도 횟수 3회 초과 방지 검증 |

### ❌ 실패 케이스 (`login_fail.test.ts`) — 9건

| TC ID | 시나리오 | 테스트 유형 | 에러코드 |
|---|---|---|---|
| TC-LOGIN-003 | 아이디 로그인 시도 차단 | 네거티브 | `ERR_MLCOM_MSG50042` |
| TC-LOGIN-FAIL-001 | 만료 인증서 텍스트 확인 | 네거티브 | `ERR_MLCOM_MSG50250` |
| TC-LOGIN-FAIL-002 | RESULT / ECODE / ERRMSG 통합 검증 | 네거티브 | `ERR_MLCOM_MSG50250` |
| TC-LOGIN-FAIL-003 | 개인뱅킹 인증서로 기업뱅킹 로그인 | 네거티브 | `ERR_MBMSG_MSG11062` |
| TC-LOGIN-FAIL-004 | 사용 불가 인증서 (전자세금계산서용) | 네거티브 | `ERR_MLCOM_MSG50303` |
| TC-LOGIN-FAIL-005 | ERROR_CODE + ECBKEBK10015 | 네거티브 | `ERR_MBMSG_MSG11062` |
| TC-LOGIN-FAIL-006 | ERROR_CODE 기타 에러 | 네거티브 | `ERR_MLCOM_MSG50003` |
| TC-LOGIN-FAIL-007 | 중복 로그인 감지 | 네거티브 | `ERR_MLCOM_MSG50114` |
| TC-LOGIN-FAIL-008 | 프리미엄 고객 차단 | 네거티브 | `ERR_MBMSG_MSG11096` |

---

## 📊 테스트 결과 요약

| 구분 | 전체 | PASS | FAIL |
|---|---|---|---|
| 성공 케이스 (`login_success.test.ts`) | 4 | **4** | 0 |
| 실패 케이스 (`login_fail.test.ts`) | 9 | **9** | 0 |
| **합계** | **13** | **13** | **0** |

---

## 🛠 기술 스택

| 항목 | 내용 |
|---|---|
| 테스트 프레임워크 | **Playwright** (TypeScript) |
| 언어 | TypeScript / Node.js |
| 브라우저 | Chromium (headless) |
| 응답 캡처 | Fiddler (실서버 HTTP 응답 → fixture HTML 저장) |
| Mock 방식 | `page.route()` + `route.fulfill()` |

---

## 📂 디렉토리 구조

```
project/
├── html/
│   ├── firstPage.html          # 로그인 첫 페이지 fixture
│   ├── success.html            # 로그인 성공 응답 fixture
│   └── fail.html               # 로그인 실패 응답 fixture (만료/폐기)
├── login_success.test.ts       # 성공 케이스 (기능 / 경계값 / 탐색적)
├── login_fail.test.ts          # 실패 케이스 (네거티브 / 예외 처리)
├── playwright.config.ts
└── README.md
```

---

## 🔧 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/hjwcoding/financeTestcase.git
cd financeTestcase
```

### 2. 패키지 설치

```bash
npm install
npx playwright install chromium
```

### 3. 실행

```bash
# 전체 실행
npx playwright test

# 성공 케이스만 실행
npx playwright test login_success.test.ts

# 실패 케이스만 실행
npx playwright test login_fail.test.ts

# HTML 리포트 확인
npx playwright show-report
```

---

## 🔍 소스 로직 기반 TC 도출 근거

Login-Module.js `Login()` 함수의 분기 구조를 분석하여 테스트 시나리오를 도출하였습니다.

```
Login()
├── STEP0. CUS_KIND 검증         → TC-LOGIN-FAIL-008
├── STEP1. 첫 페이지 접근         → TC-LOGIN-001
├── STEP2. 로그인 방법 검증       → TC-LOGIN-003 / TC-LOGIN-010
├── STEP4. 로그인 응답 에러 분기   → TC-LOGIN-FAIL-001 ~ 006
├── STEP6. entpNm 검증 및 재시도  → TC-LOGIN-002 / TC-LOGIN-011
└── catch. 전역 예외 처리         → TC-LOGIN-FAIL-007
```

---

## 📈 향후 확장 계획

| 우선순위 | 항목 | 내용 |
|---|---|---|
| P1 | 세션 검증 TC 추가 | 세션 만료 / 예금주 불일치 케이스 |
| P1 | 잔액조회 / 거래내역 TC | MODULE 2, 3 fixture 추가 및 TC 설계 |
| P2 | GitHub Actions CI 연동 | PR 머지 시 자동 실행 + 결과 알림 |
| P3 | Playwright HTML Reporter 자동화 | 슬랙 Webhook 연동 |
