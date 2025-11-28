'use client';

import { useState } from 'react';
import type { Teacher, AbsenceDay } from '@/lib/types';
import type { RecommendSubstituteTeachersOutput } from '@/ai/flows/recommend-substitute-teachers';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import TeacherCard from './teacher-card';
import CreateTeacherDialog from './create-teacher-dialog';
import MarkAbsentDialog from './mark-absent-dialog';
import RecommendationDialog from './recommendation-dialog';
import { Card } from '../ui/card';

interface TeacherListProps {
  initialTeachers: Teacher[];
}

export default function TeacherList({ initialTeachers }: TeacherListProps) {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<Teacher | null>(null);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [recommendation, setRecommendation] = useState<{
    result: RecommendSubstituteTeachersOutput;
    absentTeacher: Teacher;
    absenceDays: AbsenceDay[];
  } | null>(null);

  const handleAddTeacher = (newTeacher: Omit<Teacher, 'id' | 'avatar'>) => {
    const fallback = newTeacher.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

    const teacherWithId: Teacher = {
      ...newTeacher,
      id: String(Date.now()),
      avatar: { fallback },
    };
    setTeachers((prev) => [teacherWithId, ...prev]);
  };

  const handleEditTeacher = (updatedTeacher: Omit<Teacher, 'avatar'>) => {
    const fallback = updatedTeacher.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

    setTeachers((prev) =>
      prev.map((t) =>
        t.id === updatedTeacher.id
          ? { ...t, ...updatedTeacher, avatar: { fallback } }
          : t
      )
    );
    setTeacherToEdit(null);
  };

  const handleShowRecommendation = (
    result: RecommendSubstituteTeachersOutput,
    absentTeacher: Teacher,
    absenceDays: AbsenceDay[]
  ) => {
    setRecommendation({ result, absentTeacher, absenceDays });
  };

  const openCreateDialog = () => {
    setTeacherToEdit(null);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (teacher: Teacher) => {
    setTeacherToEdit(teacher);
    setCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setTeacherToEdit(null);
  };


  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between p-6">
        <h2 className="text-xl font-semibold text-foreground">פרופילי מורים</h2>
        <Button onClick={openCreateDialog}>
          <Plus className="ml-2 h-4 w-4" />
          יצירת פרופיל
        </Button>
      </div>

      <div className="p-6 pt-0">
        {teachers.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teachers.map((teacher) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                onMarkAbsent={() => setTeacherToMarkAbsent(teacher)}
                onEdit={() => openEditDialog(teacher)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center p-12">
              <h3 className="text-lg font-semibold text-foreground">לא נמצאו מורים</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                התחל על ידי יצירת פרופיל מורה חדש.
              </p>
          </div>
        )}
      </div>

      <CreateTeacherDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={closeCreateDialog}
        onAddTeacher={handleAddTeacher}
        onEditTeacher={handleEditTeacher}
        teacherToEdit={teacherToEdit}
      />

      <MarkAbsentDialog
        isOpen={!!teacherToMarkAbsent}
        onOpenChange={(open) => !open && setTeacherToMarkAbsent(null)}
        teacher={teacherToMarkAbsent}
        allTeachers={teachers}
        onShowRecommendation={handleShowRecommendation}
      />

      <RecommendationDialog
        isOpen={!!recommendation}
        onOpenChange={(open) => !open && setRecommendation(null)}
        recommendationResult={recommendation}
      />
    </Card>
  );
}
