import { RollpeListItem } from '@/components/rollpe/RollpeListItem';
import { dDay } from '@/features/home/api';
import type { SearchRollpe } from '@/features/search/api';
import { useTranslation } from '@/i18n';

export function SearchRollpeItem({
  rollpe,
  onPress,
}: {
  rollpe: SearchRollpe;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const date = new Date(rollpe.createdAt);
  const createdAt = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  return (
    <RollpeListItem
      title={rollpe.title}
      theme={rollpe.theme}
      deadline={dDay(rollpe.receivingDate)}
      description={t('search.hostAndDate', { name: rollpe.host.name, date: createdAt })}
      onPress={onPress}
    />
  );
}
