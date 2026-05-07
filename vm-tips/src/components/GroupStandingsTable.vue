<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SimulatedTeam } from '../types'
import { teams } from '../data/teams'
import TeamFlag from './TeamFlag.vue'

defineProps<{
  standings: SimulatedTeam[]
  group: string
}>()

const { t, locale } = useI18n()

function teamName(code: string): string {
  const team = teams.find(t => t.code === code)
  if (!team) return code
  return locale.value === 'sv' ? team.name : team.nameEn
}

const columns = computed(() => [
  { name: 'pos', label: '#', field: 'position', align: 'center' as const, style: 'width:30px' },
  { name: 'team', label: t('standings.team'), field: 'code', align: 'left' as const },
  { name: 'p', label: t('standings.played'), field: 'played', align: 'center' as const },
  { name: 'w', label: t('standings.won'), field: 'won', align: 'center' as const },
  { name: 'd', label: t('standings.drawn'), field: 'drawn', align: 'center' as const },
  { name: 'l', label: t('standings.lost'), field: 'lost', align: 'center' as const },
  { name: 'gf', label: t('standings.goalsFor'), field: 'goalsFor', align: 'center' as const },
  { name: 'ga', label: t('standings.goalsAgainst'), field: 'goalsAgainst', align: 'center' as const },
  { name: 'gd', label: t('standings.goalDiff'), field: 'goalDiff', align: 'center' as const },
  { name: 'pts', label: t('standings.points'), field: 'points', align: 'center' as const },
])

function rowClass(row: SimulatedTeam) {
  if (row.position <= 2) return 'bg-green-1'
  if (row.position === 3) return 'bg-orange-1'
  return ''
}
</script>

<template>
  <q-table
    :rows="standings"
    :columns="columns"
    row-key="code"
    flat
    dense
    hide-bottom
    :rows-per-page-options="[0]"
    class="standings-table q-mt-sm"
  >
    <template #header-cell-team="props">
      <q-th :props="props" class="sticky-team">
        {{ props.col.label }}
      </q-th>
    </template>
    <template #body="props">
      <q-tr :props="props" :class="rowClass(props.row)">
        <q-td key="pos" :props="props">{{ props.row.position }}</q-td>
        <q-td key="team" :props="props" class="sticky-team">
          <div class="row items-center no-wrap">
            <TeamFlag :code="props.row.code" size="16px" />
            <span class="q-ml-xs text-caption">{{ teamName(props.row.code) }}</span>
          </div>
        </q-td>
        <q-td key="p" :props="props">{{ props.row.played }}</q-td>
        <q-td key="w" :props="props">{{ props.row.won }}</q-td>
        <q-td key="d" :props="props">{{ props.row.drawn }}</q-td>
        <q-td key="l" :props="props">{{ props.row.lost }}</q-td>
        <q-td key="gf" :props="props">{{ props.row.goalsFor }}</q-td>
        <q-td key="ga" :props="props">{{ props.row.goalsAgainst }}</q-td>
        <q-td key="gd" :props="props">{{ props.row.goalDiff }}</q-td>
        <q-td key="pts" :props="props" class="text-weight-bold">{{ props.row.points }}</q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<style scoped>
.standings-table {
  font-size: 0.8rem;
}

@media (max-width: 599px) {
  .sticky-team {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--surface-color);
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.08);
  }

  .bg-green-1 .sticky-team {
    background: #e8f5e9;
  }

  .bg-orange-1 .sticky-team {
    background: #fff3e0;
  }
}
</style>
