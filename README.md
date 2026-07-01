# 미래해양 간식 신청

GitHub Pages에서 동작하는 간단한 반응형 신청 화면과 Google Sheets/Apps Script 백엔드입니다. 신청자는 간식과 참고 메모만 입력하며, 최근 신청 내역은 신청자 정보 없이 공개됩니다.

## 구성

- `index.html`, `styles.css`, `app.js`: PC·모바일 신청 화면과 최근 신청 내역
- `config.js`: 배포된 Apps Script 웹 앱 주소 설정
- `apps-script/Code.gs`: Sheets 저장, 관리자 이메일 알림, 완료 처리
- `apps-script/appsscript.json`: Apps Script 프로젝트 설정

## 1. Google Sheets와 Apps Script 설정

1. 새로 만든 Google 계정으로 [Google Sheets](https://sheets.google.com/)에서 빈 스프레드시트를 만듭니다.
2. 파일 이름을 `미래해양 간식 신청 관리`로 지정합니다.
3. 상단 메뉴에서 `확장 프로그램 → Apps Script`를 엽니다.
4. 기본 `Code.gs` 내용을 모두 지우고 `apps-script/Code.gs` 내용을 붙여넣습니다.
5. 왼쪽 `프로젝트 설정`에서 `appsscript.json 매니페스트 파일 표시`를 켭니다.
6. `appsscript.json`에 이 저장소의 `apps-script/appsscript.json` 내용을 붙여넣고 저장합니다.
7. Google Sheets를 새로고침합니다.
8. `간식 신청 관리 → 처음 설정하기`를 누르고 아래 내용을 입력합니다.
   - 알림받을 관리자 이메일
   - 신청 확인에 사용할 관리자명
   - GitHub Pages 출처 주소: `https://깃허브아이디.github.io`
9. 권한 승인 화면이 나타나면 방금 만든 관리 계정으로 승인합니다.

> 스프레드시트 공유 권한은 관리자 계정에만 둡니다. 그래야 관리자만 완료 처리할 수 있습니다.

## 2. Apps Script 웹 앱 배포

1. Apps Script 우측 상단 `배포 → 새 배포`를 누릅니다.
2. 유형은 `웹 앱`을 선택합니다.
3. 실행 계정은 `나`, 액세스 권한은 `모든 사용자`로 설정합니다.
4. 배포 후 `/exec`로 끝나는 웹 앱 URL을 복사합니다.
5. `config.js`의 `WEB_APP_URL`에 복사한 주소를 입력합니다.

```js
window.APP_CONFIG = {
  WEB_APP_URL: "https://script.google.com/macros/s/배포ID/exec",
  ORGANIZATION_NAME: "미래해양",
};
```

Apps Script 코드를 수정한 경우 `배포 → 배포 관리 → 수정 → 새 버전`으로 다시 배포해야 반영됩니다.

## 3. GitHub Pages 배포

1. GitHub에서 새 저장소를 만들고 이 폴더의 파일을 업로드합니다.
2. 저장소 `Settings → Pages`로 이동합니다.
3. `Deploy from a branch`, `main`, `/ (root)`를 선택하고 저장합니다.
4. 표시된 Pages 주소에 접속해 신청을 테스트합니다.

## 관리자 완료 처리

1. 관리 스프레드시트에서 완료할 신청의 행을 선택합니다.
2. `간식 신청 관리 → 선택한 신청 완료 처리`를 누릅니다.
3. `상태`가 `완료`, `완료 시간`이 현재 시각으로 변경됩니다.

완료 처리 후 웹사이트에서 `새로고침`을 누르면 최근 신청 내역의 상태도 `완료`로 표시됩니다.

## 보안 메모

- 신청 데이터가 들어 있는 Google Sheets를 공개하거나 구성원에게 편집 권한으로 공유하지 마세요.
- 관리자명은 Apps Script의 비공개 Script Properties에 저장되며 GitHub에는 올라가지 않습니다.
- 웹사이트에는 신청자 정보가 없으며 간식명, 신청 시각, 처리 상태만 표시됩니다.
- 강한 사용자별 인증이 필요한 경우에는 Google Workspace 또는 Supabase Auth 같은 별도 인증이 필요합니다.
