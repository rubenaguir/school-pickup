import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Student, StudentGuardian, type User } from '@casillego/shared/entities';
import { CreateStudentDto } from './dto/create-student.dto';
import type { ListMyStudentsResponse, StudentResponse } from './dto/responses';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentGuardian)
    private readonly studentGuardiansRepository: Repository<StudentGuardian>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateStudentDto): Promise<StudentResponse> {
    const student = await this.dataSource.transaction(async (manager) => {
      const studentsRepo = manager.getRepository(Student);
      const guardiansRepo = manager.getRepository(StudentGuardian);

      const student = await studentsRepo.save(
        studentsRepo.create({
          fullName: dto.fullName,
          birthDate: dto.birthDate ?? null,
          photoUrl: dto.photoUrl ?? null,
          createdBy: { id: userId } as User,
        }),
      );

      await guardiansRepo.save(
        guardiansRepo.create({
          student: { id: student.id } as Student,
          guardian: { id: userId } as User,
          relationship: dto.relationship,
          isPrimary: true,
          status: 'active',
        }),
      );

      return student;
    });

    return {
      id: student.id,
      fullName: student.fullName,
      birthDate: student.birthDate,
      photoUrl: student.photoUrl,
      createdByUserId: userId,
    };
  }

  async listMine(userId: string): Promise<ListMyStudentsResponse> {
    const links = await this.studentGuardiansRepository.find({
      where: { guardian: { id: userId }, status: 'active' },
      relations: { student: true },
      order: { createdAt: 'ASC' },
    });

    return {
      students: links.map((link) => ({
        id: link.student.id,
        fullName: link.student.fullName,
        birthDate: link.student.birthDate,
        photoUrl: link.student.photoUrl,
        guardianRelationship: link.relationship,
        guardianStatus: link.status,
        isPrimaryGuardian: link.isPrimary,
      })),
    };
  }
}
