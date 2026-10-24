import { t } from '@/i18n';
import { AuthenticationRequiredError, authenticatedGet, authenticatedPost } from '@/lib/authenticated-api';
import { creationError, type CreateRollpeValues, type Recipient, type RollpeChoice } from '@/features/create-rollpe/validation';

export type RollpeOptions = { ratios: RollpeChoice[]; themes: RollpeChoice[]; sizes: RollpeChoice[] };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function isChoice(value: unknown): value is RollpeChoice {
  return record(value) && positiveId(value.id) && typeof value.name === 'string' && Boolean(value.name)
    && ['RATIO', 'THEME', 'SIZE'].includes(value.type as string) && typeof value.is_vip === 'boolean'
    && record(value.query) && (value.type !== 'SIZE' || positiveId(value.query.max));
}
function isRecipient(value: unknown): value is Recipient {
  return record(value) && positiveId(value.id) && typeof value.name === 'string'
    && typeof value.identifyCode === 'string' && Boolean(value.identifyCode);
}

export async function fetchRollpeOptions(signal?: AbortSignal): Promise<RollpeOptions> {
  const { response, payload } = await authenticatedGet('/api/index?type=all', signal);
  if (!response.ok || !Array.isArray(payload?.data)) throw new Error(t('create.choicesFailed'));
  // The same index also contains memo colors, which are not creation choices.
  const choices = payload.data.filter(value => record(value) && ['RATIO', 'THEME', 'SIZE'].includes(value.type as string));
  if (!choices.every(isChoice)) throw new Error(t('create.optionsInvalid'));
  const options = {
    ratios: choices.filter(value => value.type === 'RATIO'),
    themes: choices.filter(value => value.type === 'THEME'),
    sizes: choices.filter(value => value.type === 'SIZE'),
  };
  if (!options.ratios.length || !options.themes.length || !options.sizes.length) throw new Error(t('create.noOptions'));
  return options;
}

export async function searchRecipients(keyword: string, signal?: AbortSignal): Promise<Recipient[]> {
  if (!keyword.trim()) throw new Error(t('create.enterName'));
  const params = new URLSearchParams({ nameCode: keyword.trim() });
  const { response, payload } = await authenticatedGet(`/api/user/search-user/?${params}`, signal);
  if (response.status === 404) return [];
  const data = payload?.data;
  if (!response.ok || !record(data) || !Array.isArray(data.results) || !data.results.every(isRecipient)) {
    throw new Error(t('create.searchFailed'));
  }
  return data.results;
}

export async function createRollpe(values: CreateRollpeValues, signal?: AbortSignal): Promise<string> {
  const error = creationError(values);
  const { recipient, ratio, theme, size } = values;
  if (error || !recipient || !ratio || !theme || !size) throw new Error(error ?? t('common.checkInput'));
  const body = {
    receiverFK: recipient.id, receivingDate: values.receivingDate, title: values.title,
    description: '', themeFK: theme.id, sizeFK: size.id, ratioFK: ratio.id,
    ...(values.isPrivate ? { password: values.password } : {}),
  };
  // The server binds hostFK to the authenticated account; never select a host client-side.
  const { response, payload } = await authenticatedPost('/api/paper', body, signal).catch((cause: unknown) => {
    if (signal?.aborted || cause instanceof AuthenticationRequiredError) throw cause;
    // A network failure after POST cannot tell us whether the server committed the creation.
    throw new Error(t('create.uncertainResult'));
  });
  if (response.status !== 201) {
    const details = record(payload?.data) ? Object.values(payload.data).flat().filter(value => typeof value === 'string') : [];
    throw new Error(details.length ? details.join('\n') : typeof payload?.message === 'string' ? payload.message : t('create.failed'));
  }
  if (!record(payload?.data) || typeof payload.data.title !== 'string' || typeof payload.data.receivingDate !== 'string') {
    throw new Error(t('create.responseInvalid'));
  }
  return typeof payload.message === 'string' ? payload.message : t('create.success');
}
