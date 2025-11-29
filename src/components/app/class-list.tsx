'use client';

import { useState } from 'react';
import type { SchoolClass, Teacher, ClassSchedule, TimeSlot } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit, Eye, Search } from 'lucide-react';
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
import { Input } from '../ui/input';

interface ClassListProps {
  initialClasses: SchoolClass[];
  allTeachers: Teacher[];
  timeSlots: TimeSlot[];
  onAddClass: (name: string) => void;
  onDeleteClass: (classId: string) => void;
  onUpdateSchedule: (classId: string, schedule: ClassSchedule) => void;
}

export default function ClassList({ initialClasses, allTeachers, timeSlots, onAddClass, onDeleteClass, onUpdateSchedule }: ClassListProps) {
  const [isCreateClassOpen, setCreateClassOpen] = useState(false);
  const [classToView, setClassToView] = useState<SchoolClass | null>(null);
  const [classToEditSchedule, setClassToEditSchedule] = useState<SchoolClass | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDeleteClass = (classId: string) => {
    onDeleteClass(classId);
  };
  
  const handleUpdateSchedule = (classId: string, newSchedule: ClassSchedule) => {
    onUpdateSchedule(classId, newSchedule);
    setClassToEditSchedule(null);
  };

  const filteredClasses = initialClasses.filter(schoolClass =>
    schoolClass.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="mt-6 border-border/80 rounded-2xl">
      <CardHeader>
        <div className='flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-4'>
          <div className='flex-1'>
              <CardTitle className="text-xl">כיתות לימוד</CardTitle>
              <CardDescription>ניהול מערכת השעות הכיתתית.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row-reverse gap-2 w-full sm:w-auto">
              <Button onClick={() => setCreateClassOpen(true)} className='shrink-0'>
                <Plus className="ml-2 h-4 w-4" />
                הוסף כיתה
              </Button>
              <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      type="search"
                      placeholder="חיפוש כיתה..."
                      className="w-full pl-9"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {initialClasses.length > 0 ? (
          filteredClasses.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredClasses.map((schoolClass) => (
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
              <h3 className="text-lg font-semibold text-foreground">לא נמצאו כיתות תואמות</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                  נסה מונח חיפוש אחר.
              </p>
            </div>
          )
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
        onAddClass={onAddClass}
      />
      
      <ClassTimetableDialog
        isOpen={!!classToView}
        onOpenChange={(isOpen) => !isOpen && setClassToView(null)}
        schoolClass={classToView}
        allTeachers={allTeachers}
        isEditing={false}
        allClasses={initialClasses}
        timeSlots={timeSlots}
      />

      <ClassTimetableDialog
        isOpen={!!classToEditSchedule}
        onOpenChange={(isOpen) => !isOpen && setClassToEditSchedule(null)}
        schoolClass={classToEditSchedule}
        allTeachers={allTeachers}
        onUpdateSchedule={onUpdateSchedule}
        isEditing={true}
        allClasses={initialClasses}
        timeSlots={timeSlots}
      />

    </Card>
  );
}
