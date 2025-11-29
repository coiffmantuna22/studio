
'use client';

import { useState } from 'react';
import type { Teacher, SchoolClass, TimeSlot, ClassSchedule, TeacherAvailabilityStatus } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import TeacherCard from './teacher-card';
import CreateTeacherDialog from './create-teacher-dialog';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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

interface TeacherListProps {
  teachers: Teacher[];
  allClasses: SchoolClass[];
  timeSlots: TimeSlot[];
  onAddTeacher: (teacher: Omit<Teacher, 'id' | 'userId' | 'avatar' | 'schedule'>) => void;
  onEditTeacher: (teacher: Omit<Teacher, 'userId' | 'avatar' | 'schedule'>) => void;
  onDeleteTeacher: (teacherId: string) => void;
  onMarkAbsent: (teacher: Teacher) => void;
  onUpdateTeacherSchedule: (teacherId: string, schedule: ClassSchedule) => void;
  teacherAvailabilityNow: Map<string, TeacherAvailabilityStatus>;
}

export default function TeacherList({ 
  teachers, 
  allClasses,
  timeSlots,
  onAddTeacher,
  onEditTeacher,
  onDeleteTeacher,
  onMarkAbsent,
  onUpdateTeacherSchedule,
  teacherAvailabilityNow,
}: TeacherListProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [teacherToViewSchedule, setTeacherToViewSchedule] = useState<Teacher | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredTeachers = (teachers || []).filter(teacher =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="mt-6 border-none shadow-none">
      <CardHeader>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div className='flex-1'>
                <CardTitle className="text-xl font-bold">פרופילי מורים</CardTitle>
                <CardDescription>ניהול מורים מחליפים וסימון היעדרויות.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button onClick={openCreateDialog} className='shrink-0'>
                    <Plus className="me-2 h-4 w-4" />
                    יצירת פרופיל
                </Button>
                <div className="relative flex-grow">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="חיפוש מורה..."
                        className="w-full pr-9"
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
              פעולה זו תמחק את הפרופיל של ${teacherToDelete?.name} לצמיתות ותסיר אותו/ה מכל מערכות השעות. לא ניתן לבטל את הפעולה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={handleDeleteTeacher}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        {(teachers || []).length > 0 ? (
            filteredTeachers.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredTeachers.map((teacher) => (
                    <TeacherCard
                        key={teacher.id}
                        teacher={teacher}
                        onMarkAbsent={() => onMarkAbsent(teacher)}
                        onEdit={() => openEditDialog(teacher)}
                        onDelete={() => setTeacherToDelete(teacher)}
                        onViewSchedule={() => setTeacherToViewSchedule(teacher)}
                        availabilityStatus={teacherAvailabilityNow.get(teacher.id) || 'unknown'}
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
