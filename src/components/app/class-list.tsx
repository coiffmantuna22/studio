'use client';

import { useState } from 'react';
import type { SchoolClass, Teacher, ClassSchedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit, Eye } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import CreateClassDialog from './create-class-dialog';
import ClassTimetableDialog from './class-timetable-dialog';

interface ClassListProps {
  initialClasses: SchoolClass[];
  allTeachers: Teacher[];
  onClassesUpdate: (classes: SchoolClass[]) => void;
}

export default function ClassList({ initialClasses, allTeachers, onClassesUpdate }: ClassListProps) {
  const [isCreateClassOpen, setCreateClassOpen] = useState(false);
  const [classToView, setClassToView] = useState<SchoolClass | null>(null);
  const [classToEditSchedule, setClassToEditSchedule] = useState<SchoolClass | null>(null);

  const handleAddClass = (className: string) => {
    const newClass: SchoolClass = {
      id: `c${Date.now()}`,
      name: className,
      schedule: {}, // Initially empty schedule
    };
    onClassesUpdate([...initialClasses, newClass]);
  };

  const handleDeleteClass = (classId: string) => {
    onClassesUpdate(initialClasses.filter(c => c.id !== classId));
  };
  
  const handleUpdateSchedule = (classId: string, newSchedule: ClassSchedule) => {
    onClassesUpdate(initialClasses.map(c => c.id === classId ? { ...c, schedule: newSchedule } : c));
    setClassToEditSchedule(null);
  };


  return (
    <Card className="mt-6 border-border/80 border rounded-2xl">
      <CardHeader className="flex-row items-center justify-between">
        <div>
            <CardTitle className="text-xl">כיתות לימוד</CardTitle>
            <CardDescription>ניהול מערכת השעות הכיתתית.</CardDescription>
        </div>
        <Button onClick={() => setCreateClassOpen(true)}>
          <Plus className="ml-2 h-4 w-4" />
          הוסף כיתה
        </Button>
      </CardHeader>

      <CardContent>
        {initialClasses.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {initialClasses.map((schoolClass) => (
              <Card key={schoolClass.id} className="transition-all hover:shadow-md">
                <CardHeader>
                  <CardTitle>{schoolClass.name}</CardTitle>
                  <CardDescription>
                    לחץ לצפייה או עריכת מערכת השעות.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setClassToView(schoolClass)}>
                    <Eye className="ml-1 h-4 w-4" />
                    צפה
                  </Button>
                   <Button variant="secondary" size="sm" onClick={() => setClassToEditSchedule(schoolClass)}>
                    <Edit className="ml-1 h-4 w-4" />
                    ערוך
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="ml-1 h-4 w-4" />
                        מחק
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                        <AlertDialogDescription>
                          פעולה זו תמחק את הכיתה לצמיתות. לא ניתן לבטל את הפעולה.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteClass(schoolClass.id)}>
                          מחק
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
            <h3 className="text-lg font-semibold text-foreground">לא נמצאו כיתות</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              התחל על ידי יצירת כיתה חדשה.
            </p>
          </div>
        )}
      </CardContent>

      <CreateClassDialog
        isOpen={isCreateClassOpen}
        onOpenChange={setCreateClassOpen}
        onAddClass={handleAddClass}
      />
      
      <ClassTimetableDialog
        isOpen={!!classToView}
        onOpenChange={() => setClassToView(null)}
        schoolClass={classToView}
        allTeachers={allTeachers}
        isEditing={false}
        allClasses={initialClasses}
      />

      <ClassTimetableDialog
        isOpen={!!classToEditSchedule}
        onOpenChange={() => setClassToEditSchedule(null)}
        schoolClass={classToEditSchedule}
        allTeachers={allTeachers}
        onUpdateSchedule={handleUpdateSchedule}
        isEditing={true}
        allClasses={initialClasses}
      />

    </Card>
  );
}
