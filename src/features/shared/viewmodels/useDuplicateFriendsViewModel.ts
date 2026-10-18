import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useRepositories } from '@/data/RepositoryProvider'
import { findDuplicateFriendGroups } from '@/domain/sync/integrity'
import { errorKey } from './errors'
import { useFriends } from './useFriends'

/** Spec 9.6: after a sync, two devices may each have created the same friend. */
export function useDuplicateFriendsViewModel() {
  const { t } = useTranslation()
  const repos = useRepositories()
  const friends = useFriends()
  return {
    state: { visible: findDuplicateFriendGroups(friends.all).length > 0 },
    actions: {
      async merge() {
        try {
          await repos.friends.mergeDuplicates()
          toast.success(t('banners.friendsMerged'))
        } catch (e) {
          toast.error(t(errorKey(e)))
        }
      },
    },
  }
}
