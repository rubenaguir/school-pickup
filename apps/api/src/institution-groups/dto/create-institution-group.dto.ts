import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInstitutionGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
