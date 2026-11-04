import { isRecord, isPositiveInteger } from '@/lib/api-response';
import { t } from '@/i18n';
import {
  AuthenticationRequiredError,
  authenticatedDelete,
  authenticatedGet,
  authenticatedPost,
} from '@/lib/authenticated-api';
import {
  normalizeRollpeCode,
  validReceivingDate,
  type RollpeAction,
  type RollpeHeart,
  type RollpeInfo,
  type RollpeUser,
} from '@/features/rollpe-info/model';

export type RollpeEntryInfo = { title: string; isPublic: boolean; invitationCode?: string };

export class RollpeAccessError extends Error {
  constructor(
    public readonly reason: 'join' | 'password' | 'unavailable' | 'full',
    message: string,
    public readonly entry?: RollpeEntryInfo,
  ) {
    super(message);
    this.name = 'RollpeAccessError';
  }
}

export class RollpeActionError extends Error {
  constructor(
    public readonly reason: 'missing' | 'reload',
    message: string,
  ) {
    super(message);
    this.name = 'RollpeActionError';
  }
}
function user(value: unknown): value is RollpeUser {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    typeof value.name === 'string' &&
    typeof value.identifyCode === 'string'
  );
}
function heart(value: unknown): value is RollpeHeart {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    Boolean(normalizeRollpeCode(value.code)) &&
    Number.isInteger(value.index) &&
    (value.index as number) >= 0 &&
    (value.index as number) < 12 &&
    user(value.author) &&
    typeof value.content === 'string' &&
    typeof value.color === 'string' &&
    /^#?[0-9a-f]{6}$/i.test(value.color) &&
    (value.revisionCount === undefined ||
      (Number.isSafeInteger(value.revisionCount) && (value.revisionCount as number) >= 0))
  );
}

export async function fetchRollpeInfo(code: string, signal?: AbortSignal): Promise<RollpeInfo> {
  const normalized = normalizeRollpeCode(code);
  if (!normalized) throw new RollpeAccessError('unavailable', t('info.invalidCode'));
  const { response, payload } = await authenticatedGet(
    `/api/paper?${new URLSearchParams({ pcode: normalized })}`,
    signal,
  );
  const data = payload?.data;
  if (response.status === 409 && isRecord(data) && data.reason === 'full')
    throw new RollpeAccessError('full', t('info.full'));
  if (response.status === 471) {
    if (
      !isRecord(data) ||
      normalizeRollpeCode(data.code) !== normalized ||
      typeof data.viewStat !== 'boolean' ||
      typeof data.title !== 'string' ||
      (data.viewStat && !data.title.trim()) ||
      typeof data.canEnter !== 'boolean' ||
      (data.invitationCode !== undefined &&
        (!normalizeRollpeCode(data.invitationCode) || !data.title.trim()))
    ) {
      throw new Error(t('info.entryLoadFailed'));
    }
    if (!data.canEnter) throw new RollpeAccessError('unavailable', t('info.unavailable'));
    throw new RollpeAccessError('join', t('info.joinRequired'), {
      title: data.viewStat || data.invitationCode ? data.title : '',
      isPublic: data.viewStat,
      ...(data.invitationCode ? { invitationCode: normalizeRollpeCode(data.invitationCode)! } : {}),
    });
  }
  if ([400, 403, 404, 410, 483].includes(response.status))
    throw new RollpeAccessError('unavailable', t('info.unavailable'));
  if (
    !response.ok ||
    !isRecord(data) ||
    !isPositiveInteger(data.id) ||
    normalizeRollpeCode(data.code) !== normalized ||
    typeof data.title !== 'string' ||
    !user(data.host) ||
    !isRecord(data.receive) ||
    !(data.receive.receiver === null || user(data.receive.receiver)) ||
    !validReceivingDate(data.receive.receivingDate) ||
    !Number.isInteger(data.receive.receivingStat) ||
    typeof data.viewStat !== 'boolean' ||
    !isRecord(data.hearts) ||
    !Number.isInteger(data.hearts.count)
  )
    throw new Error(t('info.loadFailed'));
  if (
    data.size !== 'A4' ||
    !['가로', '세로'].includes(data.ratio as string) ||
    !['화이트', '추모', '축하'].includes(data.theme as string) ||
    data.maxHeartLength !== 12
  ) {
    throw new Error(t('info.unsupported'));
  }
  const hearts = data.hearts.data ?? (data.hearts.count === 0 ? [] : null);
  if (
    !Array.isArray(hearts) ||
    !hearts.every(heart) ||
    data.hearts.count !== hearts.length ||
    hearts.length > 12 ||
    new Set(hearts.map((value) => value.index)).size !== hearts.length ||
    new Set(hearts.map((value) => value.id)).size !== hearts.length
  )
    throw new Error(t('info.loadFailed'));
  return {
    id: data.id,
    code: normalized,
    title: data.title,
    host: data.host,
    receive: {
      receiver: data.receive.receiver,
      receivingDate: data.receive.receivingDate,
      receivingStat: data.receive.receivingStat as number,
    },
    viewStat: data.viewStat,
    ratio: data.ratio as string,
    theme: data.theme as string,
    size: data.size,
    maxHeartLength: data.maxHeartLength,
    hearts: {
      count: hearts.length,
      data: hearts.map((value) => ({
        ...value,
        color: `#${value.color.replace(/^#/, '')}`,
      })),
    },
  };
}

export async function enterRollpe(
  code: string,
  password?: string,
  signal?: AbortSignal,
): Promise<void> {
  const normalized = normalizeRollpeCode(code);
  if (!normalized) throw new RollpeAccessError('unavailable', t('info.invalidCode'));
  const { response, payload } = await authenticatedPost(
    '/api/paper/enter',
    {
      pcode: normalized.replace(/-/g, ''),
      ...(password ? { password } : {}),
    },
    signal,
  );
  // Another request may already have joined. Reload from the authoritative GET.
  if (response.ok || response.status === 473) return;
  if (response.status === 409 && isRecord(payload?.data) && payload.data.reason === 'full')
    throw new RollpeAccessError('full', t('info.full'));
  if ([400, 472].includes(response.status))
    throw new RollpeAccessError(
      'password',
      response.status === 472 ? t('info.wrongPassword') : t('create.passwordRequired'),
    );
  if ([403, 404, 410, 483].includes(response.status))
    throw new RollpeAccessError('unavailable', t('info.unavailable'));
  throw new Error(typeof payload?.message === 'string' ? payload.message : t('info.joinFailed'));
}

async function mutateRollpe(
  code: string,
  action: RollpeAction,
  signal?: AbortSignal,
): Promise<void> {
  const normalized = normalizeRollpeCode(code);
  if (!normalized) throw new RollpeActionError('missing', t('info.invalidCode'));
  const uncertain = t(action === 'delete' ? 'info.deleteUncertain' : 'info.sendUncertain');
  let result: Awaited<ReturnType<typeof authenticatedDelete>>;
  try {
    result =
      action === 'delete'
        ? await authenticatedDelete('/api/paper/user', { pcode: normalized }, signal)
        : await authenticatedPost('/api/paper/send', { pcode: normalized }, signal);
  } catch (cause) {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    throw new RollpeActionError('reload', uncertain);
  }
  if (action === 'delete' && result.response.status === 204) return;
  if (
    action === 'send' &&
    result.response.status === 200 &&
    isRecord(result.payload?.data) &&
    normalizeRollpeCode(result.payload.data.code) === normalized &&
    result.payload.data.receivingStat === 1
  )
    return;
  if (result.response.status === 404)
    throw new RollpeActionError('missing', t('info.deleteMissing'));
  if ([403, 470, 471].includes(result.response.status))
    throw new RollpeActionError(
      'reload',
      t(action === 'delete' ? 'info.deleteForbidden' : 'info.sendForbidden'),
    );
  if (result.response.status === 483)
    throw new RollpeActionError(
      'reload',
      t(action === 'delete' ? 'info.deleteClosed' : 'info.sendClosed'),
    );
  if (action === 'send' && result.response.status === 400)
    throw new RollpeActionError('reload', t('info.sendRecipientRequired'));
  // A failed response may arrive after the write committed. Reload before another attempt.
  throw new RollpeActionError('reload', uncertain);
}

export function deleteRollpe(code: string, signal?: AbortSignal): Promise<void> {
  return mutateRollpe(code, 'delete', signal);
}

export function sendRollpe(code: string, signal?: AbortSignal): Promise<void> {
  return mutateRollpe(code, 'send', signal);
}
