import type { ReportPeriod } from './useInstitutionReports';

export function reportPeriodLabel(period: ReportPeriod): string {
  switch (period) {
    case 'today':
      return 'Hoy';
    case 'last7Days':
      return 'Últimos 7 días';
    case 'last30Days':
      return 'Últimos 30 días';
    case 'thisMonth':
      return 'Este mes';
    case 'lastMonth':
      return 'Mes pasado';
  }
}
