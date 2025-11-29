
'use client';

import { useState, useMemo } from 'react';
import type { Teacher, SchoolClass, TimeSlot, TeacherAvailabilityStatus } from '@/lib/types';
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
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, getDoc, getDocs } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { getTeacherAvailabilityStatus } from '@/lib/substitute-finder';
import { Loader2 } from 'lucide-react';
import type { ClassSchedule } from '@/lib/types';


interface TeacherListProps {
  onMarkAbsent: (teacher: Teacher) => void;
}

export default function TeacherList({ 
  onMarkAbsent,
}: TeacherListProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [teacherToViewSchedule, setTeacherToViewSchedule] = useState<Teacher | null>(null);
  const [searchTerm, setSearchTerm] = useState('');


  const teachersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: teachers = [], isLoading: teachersLoading } = useCollection<Teacher>(teachersQuery);

  const classesQuery = useMemoFirebase(() => user ? query(collection(firestore, 'classes'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: allClasses = [] } = useCollection<SchoolClass>(classesQuery);

  const settingsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'settings'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: settingsCollection } = useCollection(settingsQuery);

  const timeSlots: TimeSlot[] = useMemo(() => {
    if (settingsCollection) {
      const settingsDoc = settingsCollection.find(d => d.id === `timetable_${user?.uid}`);
      if (settingsDoc) {
        return settingsDoc.slots || [];
      }
    }
    return [];
  }, [settingsCollection, user]);

  const teacherAvailabilityNow = useMemo(() => {
    const availabilityMap = new Map<string, TeacherAvailabilityStatus>();
    const now = new Date();
    (teachers || []).forEach(teacher => {
        availabilityMap.set(teacher.id, getTeacherAvailabilityStatus(teacher, now, timeSlots));
    });
    return availabilityMap;
  }, [teachers, timeSlots]);


 const handleCreateTeacher = async (newTeacherData: Omit<Teacher, 'id' | 'userId' | 'avatar' | 'schedule'>) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'teachers'));
    const fallback = newTeacherData.name.split(' ').map((n) => n[0]).join('').toUpperCase();
    const newTeacher = { ...newTeacherData, id: newDocRef.id, userId: user.uid, avatar: { fallback }, schedule: {}, absences: [] };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newTeacher);
    await commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newTeacher });

    toast({
      title: "פרופיל מורה נוצר",
      description: `הפרופיל של ${newTeacherData.name} נוסף למערכת.`,
    });
  };

  const handleUpdateTeacher = async (updatedTeacherData: Omit<Teacher, 'avatar' | 'userId' | 'schedule'>) => {
    if (!firestore || !user) return;
    const teacherRef = doc(firestore, 'teachers', updatedTeacherData.id);
    const batch = writeBatch(firestore);
    batch.update(teacherRef, { ...updatedTeacherData });
    await commitBatchWithContext(batch, { operation: 'update', path: teacherRef.path, data: updatedTeacherData });
    
    setTeacherToEdit(null);
     toast({
      title: "פרופיל עודכן",
      description: `הפרופיל של ${updatedTeacherData.name} עודכן.`,
    });
  };

 const handleDeleteTeacher = async () => {
    if (!firestore || !user || !teacherToDelete) return;
    
    const teacherId = teacherToDelete.id;
    const batch = writeBatch(firestore);
    try {
        const teacherRef = doc(firestore, 'teachers', teacherId);
        const teacherSnap = await getDoc(teacherRef);
        if (!teacherSnap.exists()) return;

        // Clear schedule for the teacher being deleted
        batch.update(teacherRef, { schedule: {} });

        // Remove teacher from any class schedules
        const classesQuerySnapshot = await getDocs(query(collection(firestore, 'classes'), where('userId', '==', user.uid)));
        
        classesQuerySnapshot.forEach(classDoc => {
          const schoolClass = { id: classDoc.id, ...classDoc.data() } as SchoolClass;
          let classWasModified = false;
          const newSchedule = { ...schoolClass.schedule };

          Object.keys(newSchedule).forEach(day => {
            if (newSchedule[day]) {
              Object.keys(newSchedule[day] as object).forEach(time => {
                const lesson = newSchedule[day]?.[time];
                if (lesson && lesson.teacherId === teacherId) {
                  (newSchedule[day] as any)[time] = null; 
                  classWasModified = true;
                }
              });
            }
          });

          if (classWasModified) {
            const classRef = doc(firestore, 'classes', schoolClass.id);
            batch.update(classRef, { schedule: newSchedule });
          }
        });

        // Finally, delete the teacher document
        batch.delete(teacherRef);

        await commitBatchWithContext(batch, {
            operation: 'delete',
            path: `teachers/${teacherId} and related classes`
        });

        toast({
            variant: 'destructive',
            title: "המורה נמחק",
            description: `הפרופיל של ${teacherToDelete.name} וכל השיבוצים שלו הוסרו מהמערכת.`,
        });

    } catch (e) {
      if (!(e instanceof FirestorePermissionError)) {
          const permissionError = new FirestorePermissionError({
            operation: 'delete',
            path: `teachers/${teacherId} and related classes`,
          });
          errorEmitter.emit('permission-error', permissionError);
          throw permissionError;
      }
      throw e;
    } finally {
        setTeacherToDelete(null);
    }
  }


 const handleUpdateTeacherSchedule = async (
    teacherId: string,
    newSchedule: ClassSchedule
) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);
    try {
        const teacherRef = doc(firestore, 'teachers', teacherId);
        const teacherSnap = await getDoc(teacherRef);
        if (!teacherSnap.exists()) return;
        const oldSchedule = teacherSnap.data().schedule || {};

        batch.update(teacherRef, { schedule: newSchedule });

        const allRelevantClassIds = new Set<string>();
        for (const schedule of [oldSchedule, newSchedule]) {
            Object.values(schedule || {}).forEach(day => 
                Object.values(day || {}).forEach(lesson => 
                    lesson?.classId && allRelevantClassIds.add(lesson.classId)
                )
            )
        }
        
        for (const classId of allRelevantClassIds) {
            const classRef = doc(firestore, 'classes', classId);
            const classSnap = await getDoc(classRef);
            if (!classSnap.exists()) continue;

            const classData = classSnap.data() as SchoolClass;
            const updatedClassSchedule = JSON.parse(JSON.stringify(classData.schedule || {}));

            const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
            daysOfWeek.forEach(day => {
                (timeSlots || []).forEach(slot => {
                    const time = slot.start;
                    const oldLesson = oldSchedule[day]?.[time];
                    const newLesson = newSchedule[day]?.[time];

                    if (oldLesson?.classId === classId && (!newLesson || newLesson.classId !== classId)) {
                        if (updatedClassSchedule[day]?.[time]?.teacherId === teacherId) {
                            (updatedClassSchedule[day] as any)[time] = null;
                        }
                    }
                    if (newLesson?.classId === classId) {
                        updatedClassSchedule[day] = updatedClassSchedule[day] || {};
                        updatedClassSchedule[day][time] = { ...(newLesson as any), teacherId: teacherId };
                    }
                });
            });
            batch.update(classRef, { schedule: updatedClassSchedule });
        }
        
        await commitBatchWithContext(batch, {
            operation: 'update',
            path: `teachers/${teacherId}`,
            data: { schedule: newSchedule }
        });

    } catch (e) {
      if (!(e instanceof FirestorePermissionError)) {
        const permissionError = new FirestorePermissionError({
            operation: 'update',
            path: `teachers/${teacherId}`,
            requestResourceData: { schedule: newSchedule },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
      }
      throw e;
    }
}


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

  const filteredTeachers = useMemo(() => {
    return (teachers || []).filter(teacher => 
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teachers, searchTerm]);

  if (teachersLoading) {
      return <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <Card className="mt-6 border-none shadow-none">
      <CardHeader>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
            <div className='flex-1'>
                <CardTitle className="text-xl font-bold">פרופילי מורים</CardTitle>
                <CardDescription>ניהול מורים מחליפים וסימון היעדרויות.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <Button onClick={openCreateDialog} className='shrink-0'>
                    <Plus className="me-2 h-4 w-4" />
                    יצירת פרופיל
                </Button>
                <div className="relative flex-grow w-full sm:w-auto">
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
        </AlertDialog>
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
        onUpdateSchedule={handleUpdateTeacherSchedule}
      />
    </Card>
  );
}


