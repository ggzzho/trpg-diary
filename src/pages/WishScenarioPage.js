// src/pages/WishScenarioPage.js
import { wishScenariosApi } from '../lib/supabase'
import { BaseScenarioPage } from './ScenarioPage'

export function WishScenarioPage() {
  return <BaseScenarioPage config={{
    table: 'wish_scenarios',
    tagsTable: 'wish_scenario_status_tags',
    api: wishScenariosApi,
    defaultTags: ['미구매', '구매 예정', '품절'],
    profileSortKey: 'wish_scenario_sort_order',
    title: '위시 시나리오',
    subtitle: '갖고 싶은 TRPG 시나리오집 목록이예요',
    icon: 'favorite',
    emptyTitle: '위시 시나리오가 없어요',
    alertLabel: '위시 시나리오',
    tagModalTitle: '🏷️ 상태 태그 관리',
    tagPlaceholder: '미구매, 구매 예정, 구매 완료...',
  }}/>
}
