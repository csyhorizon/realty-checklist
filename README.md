# 🏠 집보기 체크리스트

부동산 임장 시 현장에서 빠르게 체크하고, 매물 간 조건·점수·비용을 한눈에 비교해 최종 선택을 돕는 모바일 중심 웹앱입니다.

👉 **접속 주소:** https://부동산.csyhorizon.dev (모바일 브라우저에서 접속 후 **홈 화면에 추가**하면 앱처럼 오프라인에서도 사용할 수 있습니다.)

## 주요 특징
- **거래유형별 맞춤 체크:** 월세 / 전세 / 반전세 선택에 따라 항목·특약·점수 가중치 자동 적용
- **현위치 저장 & 네이버지도 연동:** GPS 현위치 저장 시 주소 자동 입력 및 네이버지도 앱/웹 바로 열기
- **현장 사진 기록:** 촬영·앨범 첨부, 압축 저장, 갤러리 및 메모 지원
- **자동 점수 & 위험 경고:** 전세가율·부채비율·환산월세 계산, 위반건축물 등 치명 위험 경고
- **매물 비교표:** 2~4개 매물 가로 스와이프 비교 및 차이 항목 필터
- **로컬 저장 & 백업:** 서버 없이 브라우저(IndexedDB)에 저장되며 JSON 내보내기/가져오기 지원

## 개발 및 배포
```bash
npm install
npm run dev      # 로컬 개발 서버
npm run build    # 프로덕션 빌드 (dist/)
```
- **중개사무소 검색(카카오맵 JS SDK):** 빌드 환경변수 `VITE_KAKAO_JS_KEY`에 카카오 JavaScript 키를 설정하세요.
  - 로컬: `.env.local` 파일에 `VITE_KAKAO_JS_KEY=발급받은_키`
  - Cloudflare: Workers & Pages → Settings → Build → Build variables and secrets에 `VITE_KAKAO_JS_KEY` 추가
- Cloudflare Workers 정적 에셋 배포 (`wrangler.jsonc`)
