import { IsIn } from 'class-validator';
import { REPORT_PERIODS, type ReportPeriod } from '../report-period';

export class GetInstitutionReportsQueryDto {
  @IsIn(REPORT_PERIODS)
  period!: ReportPeriod;
}
