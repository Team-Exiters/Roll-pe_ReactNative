const assert = require('node:assert/strict');
const test = require('node:test');
const { i18n, t, preferredLanguage, choiceLabel } = require('./helpers/i18n.cjs');

test('bundled Korean copy is ready synchronously and unsupported device languages fall back to Korean', async () => {
  assert.equal(i18n.isInitialized, true);
  assert.equal(t('common.confirm'), '확인');
  for (const locales of [[], [{ languageTag: 'en-US' }], [{ languageTag: 'ar' }, { languageTag: 'ja-JP' }],
    [{ languageTag: 'en-US' }, { languageTag: 'KO-kr' }]]) {
    assert.equal(preferredLanguage(locales), 'ko');
  }
  await i18n.changeLanguage('en-US');
  assert.equal(i18n.resolvedLanguage, 'ko');
  assert.equal(t('common.signIn'), '로그인');
  await i18n.changeLanguage('ko');
});

test('names, counts and dates preserve the original Korean sentences and user text without double escaping', () => {
  assert.equal(t('home.greeting', { name: 'A&B <사용자>' }), 'A&B <사용자>님은');
  assert.equal(t('home.hostCount', { count: 3 }), '3개의 롤페를 만드셨어요.');
  assert.equal(t('home.heartCount', { count: '—' }), '—번의 마음을 작성하셨어요.');
  assert.equal(t('create.dateLabel', { year: 2026, month: 10, day: 24 }), '2026년 10월 24일 오전 10시');
  assert.equal(t('create.previewSample', { count: 12 }), '가나다라마바사\n- 테스트12');
  assert.equal(t('validation.password'), '비밀번호는 8자 이상이며 영문, 숫자, 특수문자(!@#$%^*+=-)를 포함해야 합니다.');
  assert.equal(t('recovery.cleanupFailed', { message: '변경되었습니다.' }),
    '변경되었습니다.\n기기에 저장된 로그인 정보를 삭제하지 못했습니다. 다시 로그인해주세요.');
});

test('choice labels are displayed through translations while unknown server choices remain intact', () => {
  for (const name of ['가로', '세로', '화이트', '추모', '축하', 'A4', '서버의 새 테마', 'constructor', 'toString']) {
    assert.equal(choiceLabel(name), name);
  }
});
