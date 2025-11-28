'use client';

import { useState } from 'react';
import type { Teacher } from '@/lib/types';
import type { RecommendSubstituteTeachersOutput } from '@/ai/flows/recommend-substitute-teachers';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import TeacherCard from './teacher-card';
import CreateTeacherDialog from './create-teacher-dialog';
import MarkAbsentDialog from './mark-absent-dialog';
import RecommendationDialog from './recommendation-dialog';

interface TeacherListProps {
  initialTeachers: Teacher[];
}

export default function TeacherList({ initialTeachers }: TeacherListProps) {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<Teacher | null>(null);
  const [recommendation, setRecommendation] = useState<{
    result: RecommendSubstituteTeachersOutput;
    absentTeacher: Teacher;
    details: { from: Date; to: Date; startTime: string; endTime: string };
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

  const handleShowRecommendation = (
    result: RecommendSubstituteTeachersOutput,
    absentTeacher: Teacher,
    details: { from: Date; to: Date; startTime: string; endTime: string }
  ) => {
    setRecommendation({ result, absentTeacher, details });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">פרופילי מורים</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="ml-2 h-4 w-4" />
          יצירת פרופיל
        </Button>
      </div>

      {teachers.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              teacher={teacher}
              onMarkAbsent={() => setTeacherToMarkAbsent(teacher)}
            />
          ))}
        </div>
      ) : (
         <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center p-12 mt-6">
            <h3 className="text-lg font-semibold text-foreground">לא נמצאו מורים</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              התחל על ידי יצירת פרופיל מורה חדש.
            </p>
         </div>
      )}

      <CreateTeacherDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onAddTeacher={handleAddTeacher}
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
    </>
  );
}
