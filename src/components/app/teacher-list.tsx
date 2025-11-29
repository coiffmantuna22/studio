
'use client';

import { useState, useMemo } from 'react';
import type { Teacher, SchoolClass, AffectedLesson, TimeSlot, AbsenceDay, ClassSchedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import TeacherCard from './teacher-card';
import CreateTeacherDialog from './create-teacher-dialog';
import MarkAbsentDialog from './mark-absent-dialog';
import RecommendationDialog from './recommendation-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getDay } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import TeacherScheduleDialog from './teacher-schedule-dialog';
import { isTeacherAvailable } from '@/lib/substitute-finder';
import { parse } from 'date-fns';

interface TeacherListProps {
  teachers: Teacher[];
  allClasses: SchoolClass[];
  timeSlots: TimeSlot[];
  onAddTeacher: (teacher: Omit<Teacher, 'id' | 'userId' | 'avatar' | 'schedule'>) => void;
  onEditTeacher: (teacher: Omit<Teacher, 'userId' | 'avatar' | 'schedule'>) => void;
  onDeleteTeacher: (teacherId: string) => void;
  onMarkAbsent: (teacherId: string, absenceDays: AbsenceDay[]) => void;
  onUpdateTeacherSchedule: (teacherId: string, schedule: ClassSchedule) => void;
}

export default function TeacherList({ 
  teachers, 
  allClasses,
  timeSlots,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  onMarkAbsent,
  onUpdateTeacherSchedule
}: TeacherListProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<Teacher | null>(null);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [teacherToViewSchedule, setTeacherToViewSchedule] = useState<Teacher | null>(null);
  const [recommendation, setRecommendation] = useState<{
    results: AffectedLesson[];
    absentTeacher: Teacher;
    newClassSchedules: SchoolClass[];
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getSubstituteTeacherId = (name: string | null): string | null => {
    if (!name) return null;
    const teacher = teachers.find(t => t.name === name);
    return teacher ? teacher.id : null;
  }

 const handleCreateTeacher = (newTeacherData: Omit<Teacher, 'id' | 'userId' | 'avatar' | 'schedule'>) => {
    onAddTeacher(newTeacherData);
     toast({
      title: "פרופיל מורה נוצר",
      description: `הפרופיל של ${newTeacherData.name} נוסף למערכת.`,
    });
  };

  const handleUpdateTeacher = (updatedTeacherData: Omit<Teacher, 'avatar' | 'userId' | 'schedule'>) => {
    onEditTeacher(updatedTeacherData);
    setTeacherToEdit(null);
     toast({
      title: "פרופיל עודכן",
      description: `הפרופיל של ${updatedTeacherData.name} עודכן.`,
    });
  };

  const handleDeleteTeacher = () => {
    if (!teacherToDelete) return;
    
    onDeleteTeacher(teacherToDelete.id);

    toast({
      variant: 'destructive',
      title: "המורה נמחק",
      description: `הפרופיל של ${teacherToDelete.name} וכל השיבוצים שלו הוסרו מהמערכת.`,
    });

    setTeacherToDelete(null);
  };


  const handleShowRecommendation = (
    results: AffectedLesson[],
    absentTeacher: Teacher,
    absenceDays: AbsenceDay[]
  ) => {
    const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const updatedClasses = JSON.parse(JSON.stringify(allClasses)) as SchoolClass[];
    let lessonsUpdatedCount = 0;

    results.forEach(res => {
      const substituteId = getSubstituteTeacherId(res.recommendation);
      if (substituteId) {
        const classToUpdate = updatedClasses.find((c: SchoolClass) => c.id === res.classId);
        if (classToUpdate) {
          const dayOfWeek = dayMap[getDay(res.date)];
          if (classToUpdate.schedule[dayOfWeek]?.[res.time]) {
             lessonsUpdatedCount++;
            classToUpdate.schedule[dayOfWeek][res.time]!.teacherId = substituteId;
          }
        }
      }
    });

    onMarkAbsent(absentTeacher.id, absenceDays);
    setRecommendation({ results, absentTeacher, newClassSchedules: updatedClasses });
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

 const handleFinalUpdateTimetables = async () => {
    if (!recommendation) return;

    let lessonsUpdatedCount = 0;
    
    const teacherScheduleUpdates = new Map<string, ClassSchedule>();

    recommendation.results.forEach(res => {
        const subId = getSubstituteTeacherId(res.recommendation);
        if(!subId) return;

        lessonsUpdatedCount++;

        const day = dayMap[getDay(res.date)];
        const time = res.time;

        const subSchedule = teacherScheduleUpdates.get(subId) || (teachers.find(t=>t.id === subId)?.schedule ? JSON.parse(JSON.stringify(teachers.find(t=>t.id === subId)!.schedule)) : {});
        subSchedule[day] = subSchedule[day] || {};
        subSchedule[day][time] = {subject: res.lesson.subject, teacherId: subId, classId: res.classId};
        teacherScheduleUpdates.set(subId, subSchedule);

        const absentTeacherId = recommendation.absentTeacher.id;
        const absentTeacherSchedule = teacherScheduleUpdates.get(absentTeacherId) || (recommendation.absentTeacher.schedule ? JSON.parse(JSON.stringify(recommendation.absentTeacher.schedule)) : {});
        if (absentTeacherSchedule[day]?.[time]) {
            absentTeacherSchedule[day][time] = null;
        }
        teacherScheduleUpdates.set(absentTeacherId, absentTeacherSchedule);
    });

    for(const [teacherId, schedule] of teacherScheduleUpdates.entries()) {
        await onUpdateTeacherSchedule(teacherId, schedule);
    }
    
    if (lessonsUpdatedCount > 0) {
      toast({
        title: "מערכת השעות עודכנה",
        description: `${lessonsUpdatedCount} שיעורים עודכנו עם מחליפים.`,
      });
    } else {
        toast({
        variant: "destructive",
        title: "פעולה בוטלה",
        description: "לא נבחרו המלצות ולכן לא בוצע עדכון.",
      });
    }

    setRecommendation(null);
  };

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const teacherAvailabilityNow = useMemo(() => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentSlot = timeSlots.find(slot => currentTime >= slot.start && currentTime < slot.end);

    const availabilityMap = new Map<string, boolean>();

    if (currentSlot && currentSlot.type === 'lesson') {
        teachers.forEach(teacher => {
            const isAvailable = isTeacherAvailable(teacher, now, currentSlot.start, timeSlots);
            availabilityMap.set(teacher.id, isAvailable);
        });
    } else {
         teachers.forEach(teacher => availabilityMap.set(teacher.id, false));
    }
    return availabilityMap;

  }, [teachers, timeSlots]);


  return (
    <Card className="mt-6 border-border/80 rounded-2xl">
      <CardHeader>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div className='flex-1'>
                <CardTitle className="text-xl">פרופילי מורים</CardTitle>
                <CardDescription>ניהול מורים מחליפים וסימון היעדרויות.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button onClick={openCreateDialog} className='shrink-0'>
                    <Plus className="ml-2 h-4 w-4" />
                    יצירת פרופיל
                </Button>
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="חיפוש מורה..."
                        className="w-full pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </div>
      </CardHeader>

      <CardContent>
       <AlertDialog open={!!teacherToDelete} onOpenChange={(open) => !open && setTeacherToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את הפרופיל של {teacherToDelete?.name} לצמיתות ותסיר אותו/ה מכל מערכות השעות. לא ניתן לבטל את הפעולה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteTeacher}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        {teachers.length > 0 ? (
            filteredTeachers.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredTeachers.map((teacher) => (
                    <TeacherCard
                        key={teacher.id}
                        teacher={teacher}
                        onMarkAbsent={() => setTeacherToMarkAbsent(teacher)}
                        onEdit={() => openEditDialog(teacher)}
                        onDelete={() => setTeacherToDelete(teacher)}
                        onViewSchedule={() => setTeacherToViewSchedule(teacher)}
                        isAvailableNow={teacherAvailabilityNow.get(teacher.id) || false}
                    />
                    ))}
                </div>
            ) : (
                 <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
                    <h3 className="text-lg font-semibold text-foreground">לא נמצאו מורים תואמים</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        נסה מונח חיפוש אחר.
                    </p>
                </div>
            )
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
              <h3 className="text-lg font-semibold text-foreground">לא נמצאו מורים</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                התחל על ידי יצירת פרופיל מורה חדש.
              </p>
          </div>
        )}
      </AlertDialog>
      </CardContent>

      <CreateTeacherDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={closeCreateDialog}
        onAddTeacher={handleCreateTeacher}
        onEditTeacher={handleUpdateTeacher}
        teacherToEdit={teacherToEdit}
        timeSlots={timeSlots}
      />

      <MarkAbsentDialog
        isOpen={!!teacherToMarkAbsent}
        onOpenChange={(open) => !open && setTeacherToMarkAbsent(null)}
        teacher={teacherToMarkAbsent}
        allTeachers={teachers}
        allClasses={allClasses}
        timeSlots={timeSlots}
        onShowRecommendation={handleShowRecommendation}
      />

      <RecommendationDialog
        isOpen={!!recommendation}
        onOpenChange={(open) => !open && setRecommendation(null)}
        recommendationResult={recommendation}
        onTimetablesUpdate={handleFinalUpdateTimetables}
      />

       <TeacherScheduleDialog
        isOpen={!!teacherToViewSchedule}
        onOpenChange={(open) => !open && setTeacherToViewSchedule(null)}
        teacher={teacherToViewSchedule}
        allClasses={allClasses}
        timeSlots={timeSlots}
        onUpdateSchedule={onUpdateTeacherSchedule}
        allTeachers={teachers}
      />
    </Card>
  );
}
