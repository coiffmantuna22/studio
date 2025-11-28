'use client';

import { useState } from 'react';
import type { Teacher, AbsenceDay, SchoolClass, AffectedLesson } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import TeacherCard from './teacher-card';
import CreateTeacherDialog from './create-teacher-dialog';
import MarkAbsentDialog from './mark-absent-dialog';
import RecommendationDialog from './recommendation-dialog';
import { Card } from '../ui/card';
import { useToast } from '@/hooks/use-toast';
import { getDay } from 'date-fns';

interface TeacherListProps {
  initialTeachers: Teacher[];
  allClasses: SchoolClass[];
  onTeachersUpdate: (teachers: Teacher[]) => void;
  onTimetablesUpdate: (updatedSchedules: { classId: string; schedule: any }[]) => void;
}

export default function TeacherList({ 
  initialTeachers, 
  allClasses, 
  onTeachersUpdate,
  onTimetablesUpdate
}: TeacherListProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<Teacher | null>(null);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [recommendation, setRecommendation] = useState<{
    results: AffectedLesson[];
    absentTeacher: Teacher;
  } | null>(null);

  const getSubstituteTeacherId = (name: string | null): string | null => {
    if (!name) return null;
    const teacher = initialTeachers.find(t => t.name === name);
    return teacher ? teacher.id : null;
  }

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
    onTeachersUpdate([teacherWithId, ...initialTeachers]);
  };

  const handleEditTeacher = (updatedTeacher: Omit<Teacher, 'avatar'>) => {
    const fallback = updatedTeacher.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

    onTeachersUpdate(
      initialTeachers.map((t) =>
        t.id === updatedTeacher.id
          ? { ...t, ...updatedTeacher, avatar: { fallback } }
          : t
      )
    );
    setTeacherToEdit(null);
  };

  const handleShowRecommendation = (
    results: AffectedLesson[],
    absentTeacher: Teacher
  ) => {
    setRecommendation({ results, absentTeacher });
     const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
     
     // This logic is moved here from the dialog
     const updatedSchedules: { classId: string; schedule: any }[] = [];
     const tempSchedules: Record<string, any> = {};

     allClasses.forEach(c => {
       tempSchedules[c.id] = JSON.parse(JSON.stringify(c.schedule));
     });

     results.forEach(res => {
        const substituteId = getSubstituteTeacherId(res.recommendation);
        if (substituteId) {
            const dayOfWeek = dayMap[getDay(res.date)];
            if(tempSchedules[res.classId]) {
              if(!tempSchedules[res.classId][dayOfWeek]) tempSchedules[res.classId][dayOfWeek] = {};
              tempSchedules[res.classId][dayOfWeek][res.time] = {
                  subject: res.lesson.subject,
                  teacherId: substituteId,
              };
            }
        }
     });

     for (const classId in tempSchedules) {
        updatedSchedules.push({ classId, schedule: tempSchedules[classId] });
     }
     
     // The dialog will call this function upon confirmation
     const handleUpdateConfirm = () => {
        onTimetablesUpdate(updatedSchedules);
        toast({
            title: "מערכת השעות עודכנה",
            description: "השיבוצים עודכנו בהצלחה עם המורים המחליפים.",
        });
     }
     
     // We need to pass this confirm handler to the dialog
     // Let's modify the dialog props to accept it
     // For now, let's assume the dialog will call a function passed to it.
     // The recommendation dialog needs to be enhanced to call this.
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

  const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const handleFinalUpdate = () => {
      if (!recommendation) return;

      const tempSchedules: Record<string, any> = {};
      allClasses.forEach(c => {
          tempSchedules[c.id] = JSON.parse(JSON.stringify(c.schedule));
      });

      recommendation.results.forEach(res => {
          const substituteId = getSubstituteTeacherId(res.recommendation);
          if (substituteId) {
              const dayOfWeek = dayMap[getDay(res.date)];
              if (tempSchedules[res.classId]) {
                  if (!tempSchedules[res.classId][dayOfWeek]) tempSchedules[res.classId][dayOfWeek] = {};
                  tempSchedules[res.classId][dayOfWeek][res.time] = {
                      subject: res.lesson.subject,
                      teacherId: substituteId,
                  };
              }
          }
      });

      const updatedSchedules = Object.keys(tempSchedules).map(classId => ({
          classId,
          schedule: tempSchedules[classId]
      }));

      onTimetablesUpdate(updatedSchedules);
      setRecommendation(null);
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
        {initialTeachers.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {initialTeachers.map((teacher) => (
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
        allTeachers={initialTeachers}
        allClasses={allClasses}
        onShowRecommendation={handleShowRecommendation}
      />

      <RecommendationDialog
        isOpen={!!recommendation}
        onOpenChange={(open) => !open && setRecommendation(null)}
        recommendationResult={recommendation}
        allTeachers={initialTeachers}
        onTimetablesUpdate={handleFinalUpdate}
      />
    </Card>
  );
}
