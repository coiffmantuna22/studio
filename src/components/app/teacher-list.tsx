'use client';

import { useState } from 'react';
import type { Teacher, SchoolClass, AffectedLesson } from '@/lib/types';
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

interface TeacherListProps {
  initialTeachers: Teacher[];
  allClasses: SchoolClass[];
  onAddTeacher: (teacher: Omit<Teacher, 'id'|'avatar'>) => void;
  onEditTeacher: (teacher: Omit<Teacher, 'avatar'>) => void;
  onDeleteTeacher: (teacherId: string) => void;
  onClassesUpdate: (classes: SchoolClass[]) => void;
}

export default function TeacherList({ 
  initialTeachers, 
  allClasses, 
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  onClassesUpdate
}: TeacherListProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<Teacher | null>(null);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [recommendation, setRecommendation] = useState<{
    results: AffectedLesson[];
    absentTeacher: Teacher;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const getSubstituteTeacherId = (name: string | null): string | null => {
    if (!name) return null;
    const teacher = initialTeachers.find(t => t.name === name);
    return teacher ? teacher.id : null;
  }

 const handleCreateTeacher = (newTeacherData: Omit<Teacher, 'id' | 'avatar'>) => {
    onAddTeacher(newTeacherData);
     toast({
      title: "פרופיל מורה נוצר",
      description: `הפרופיל של ${newTeacherData.name} נוסף למערכת.`,
    });
  };

  const handleUpdateTeacher = (updatedTeacherData: Omit<Teacher, 'avatar'>) => {
    onEditTeacher(updatedTeacherData);
    setTeacherToEdit(null);
     toast({
      title: "פרופיל עודכן",
      description: `הפרופיל של ${updatedTeacherData.name} עודכן.`,
    });
  };

  const handleDeleteTeacher = () => {
    if (!teacherToDelete) return;
    
    const updatedClasses = JSON.parse(JSON.stringify(allClasses));
    updatedClasses.forEach((schoolClass: SchoolClass) => {
      Object.keys(schoolClass.schedule).forEach(day => {
        if(schoolClass.schedule[day]) {
            Object.keys(schoolClass.schedule[day]).forEach(time => {
                const lesson = schoolClass.schedule[day][time];
                if (lesson && lesson.teacherId === teacherToDelete.id) {
                    delete schoolClass.schedule[day][time]; 
                }
            });
        }
      });
    });
    onClassesUpdate(updatedClasses);
    onDeleteTeacher(teacherToDelete.id);

    toast({
      title: "המורה נמחק",
      description: `הפרופיל של ${teacherToDelete.name} וכל השיבוצים שלו הוסרו מהמערכת.`,
    });

    setTeacherToDelete(null);
  };


  const handleShowRecommendation = (
    results: AffectedLesson[],
    absentTeacher: Teacher
  ) => {
    setRecommendation({ results, absentTeacher });
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

 const handleFinalUpdateTimetables = () => {
    if (!recommendation) return;

    const updatedClasses = JSON.parse(JSON.stringify(allClasses));
    let lessonsUpdatedCount = 0;

    recommendation.results.forEach(res => {
      const substituteId = getSubstituteTeacherId(res.recommendation);
      if (substituteId) {
        const classToUpdate = updatedClasses.find((c: SchoolClass) => c.id === res.classId);
        if (classToUpdate) {
          const dayOfWeek = dayMap[getDay(res.date)];
          if (classToUpdate.schedule[dayOfWeek]?.[res.time]) {
             lessonsUpdatedCount++;
            classToUpdate.schedule[dayOfWeek][res.time] = {
              subject: res.lesson.subject,
              teacherId: substituteId,
            };
          }
        }
      }
    });
    
    if (lessonsUpdatedCount > 0) {
      onClassesUpdate(updatedClasses);
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

  const filteredTeachers = initialTeachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <Card className="mt-6 border-border/80 rounded-2xl">
      <CardHeader>
        <div className='flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-4'>
            <div className='flex-1'>
                <CardTitle className="text-xl">פרופילי מורים</CardTitle>
                <CardDescription>ניהול מורים מחליפים וסימון היעדרויות.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row-reverse gap-2 w-full sm:w-auto">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="חיפוש מורה..."
                        className="pl-9 w-full"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button onClick={openCreateDialog} className='shrink-0'>
                    <Plus className="ml-2 h-4 w-4" />
                    יצירת פרופיל
                </Button>
            </div>
        </div>
      </CardHeader>

      <CardContent>
        {initialTeachers.length > 0 ? (
            filteredTeachers.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredTeachers.map((teacher) => (
                    <TeacherCard
                        key={teacher.id}
                        teacher={teacher}
                        onMarkAbsent={() => setTeacherToMarkAbsent(teacher)}
                        onEdit={() => openEditDialog(teacher)}
                        onDelete={() => setTeacherToDelete(teacher)}
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
      </CardContent>

      <CreateTeacherDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={closeCreateDialog}
        onAddTeacher={handleCreateTeacher}
        onEditTeacher={handleUpdateTeacher}
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
        onTimetablesUpdate={handleFinalUpdateTimetables}
      />

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
            <AlertDialogAction onClick={handleDeleteTeacher}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
