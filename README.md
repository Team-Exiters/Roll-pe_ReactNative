# Roll-pe

기존 iOS 앱을 Expo / React Native로 이식하는 프로젝트입니다.

## 실행

```bash
npm install
npx expo start
```

프로젝트 구조와 개발 설정은 [AGENTS.md](./AGENTS.md)를 참고합니다.

## 비밀번호 재설정

메일의 HTTPS 링크는 설치된 앱의 재설정 화면 또는 기존 API 서버의 브라우저 폼으로 연결됩니다. 별도 RN 웹 배포는 필요하지 않습니다. iOS Universal Links·Android App Links 설정을 반영하려면 새 네이티브 빌드가 필요합니다. 서버의 공개 연결 메타데이터 배포와 Android 실제 서명 SHA-256 등록은 [백엔드 배포 안내](../roll-pe-api/README.md#검증된-앱-링크-배포)를 참고합니다. Expo Go가 아닌 설치 앱에서 메일 링크를 확인합니다.
