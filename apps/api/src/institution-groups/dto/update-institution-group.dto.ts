import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateInstitutionGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
