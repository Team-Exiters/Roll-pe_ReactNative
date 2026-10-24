export type RollpeChoice = {
  id: number; name: string; type: 'RATIO' | 'THEME' | 'SIZE';
  query: { max?: number }; is_vip: boolean;
};
export type Recipient = { id: number; name: string; identifyCode: string };
export type CreateRollpeValues = {
  title: string; ratio: RollpeChoice | null; theme: RollpeChoice | null; size: RollpeChoice | null;
  isPrivate: boolean; password: string; receivingDate: string; recipient: Recipient | null;
};

export function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function receivingDateLimits(now = new Date()) {
  return {
    minimum: dateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)),
    maximum: dateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)),
  };
}

export function isReceivingDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (dateString(new Date(year, month - 1, day)) !== value) return false;
  const limits = receivingDateLimits(now);
  return value >= limits.minimum && value <= limits.maximum;
}

export function creationError(values: CreateRollpeValues, now = new Date()): string | null {
  if (!values.title.length) return '제목을 입력하세요.';
  if (values.title.length > 20) return '제목은 20자까지 입력할 수 있습니다.';
  if (!values.ratio || values.ratio.type !== 'RATIO' || !Number.isSafeInteger(values.ratio.id) || values.ratio.id <= 0) return '비율을 선택하세요.';
  if (!values.theme || values.theme.type !== 'THEME' || !Number.isSafeInteger(values.theme.id) || values.theme.id <= 0) return '테마를 선택하세요.';
  if (!values.size || values.size.type !== 'SIZE' || !Number.isSafeInteger(values.size.id) || values.size.id <= 0) return '크기를 선택하세요.';
  if (values.isPrivate && !values.password.length) return '비밀번호를 입력하세요.';
  if (values.isPrivate && values.password.length > 50) return '비밀번호는 50자까지 입력할 수 있습니다.';
  if (!isReceivingDate(values.receivingDate, now)) return '전달일은 내일부터 30일 이내로 설정해주세요.';
  if (!values.recipient || !Number.isSafeInteger(values.recipient.id) || values.recipient.id <= 0) return '전달할 사람을 선택해주세요.';
  return null;
}
