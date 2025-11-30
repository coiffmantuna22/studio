
'use client';

import { useState, useMemo } from 'react';
import type { SchoolClass, Teacher, ClassSchedule, TimeSlot, Lesson } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, getDoc, getDocs } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Loader2 } from 'lucide-react';
import { daysOfWeek } from '@/lib/constants';
import MajorsTab from './majors-tab';

interface ClassListProps {}

export default function ClassList({}: ClassListProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [isCreateClassOpen, setCreateClassOpen] = useState(false);
  const [classToView, setClassToView] = useState<SchoolClass | null>(null);
  const [classToEditSchedule, setClassToEditSchedule] = useState<SchoolClass | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'classes' | 'majors'>('classes');

  const classesQuery = useMemoFirebase(() => user ? query(collection(firestore, 'classes'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: initialClassesData, isLoading: classesLoading } = useCollection<SchoolClass>(classesQuery);
  const initialClasses = initialClassesData || [];
  
  const teachersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: allTeachersData } = useCollection<Teacher>(teachersQuery);
  const allTeachers = allTeachersData || [];

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

  const handleAddClass = async (className: string) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'classes'));
    const newClass: Omit<SchoolClass, 'id'> = {
      name: className,
      schedule: {},
      userId: user.uid,
    };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, { ...newClass, id: newDocRef.id });
    await commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: { ...newClass, id: newDocRef.id } });
  };

  const handleDeleteClass = async (classId: string) => {
    if (!firestore || !user) return;
    const batch = writeBatch(firestore);
    try {
      const classRef = doc(firestore, "classes", classId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) return;

      const teacherDocs = await getDocs(query(collection(firestore, 'teachers'), where('userId', '==', user.uid)));

      // Iterate through ALL teachers to clean up their schedules
      teacherDocs.forEach(teacherDoc => {
        const teacher = teacherDoc.data() as Teacher;
        const schedule = teacher.schedule;
        if (!schedule) return;

        let teacherScheduleModified = false;
        const newSchedule = JSON.parse(JSON.stringify(schedule));

        Object.keys(newSchedule).forEach(day => {
          Object.keys(newSchedule[day] || {}).forEach(time => {
            const lessons = newSchedule[day][time];
            if (Array.isArray(lessons)) {
              const originalLength = lessons.length;
              const filteredLessons = lessons.filter((l: Lesson) => l.classId !== classId);
              
              if (filteredLessons.length < originalLength) {
                teacherScheduleModified = true;
                if (filteredLessons.length === 0) {
                  delete newSchedule[day][time];
                } else {
                  newSchedule[day][time] = filteredLessons;
                }
              }
            }
          });
          if (Object.keys(newSchedule[day]).length === 0) {
            delete newSchedule[day];
          }
        });

        if (teacherScheduleModified) {
          batch.update(teacherDoc.ref, { schedule: newSchedule });
        }
      });
      
      // Finally, delete the class itself
      batch.delete(classRef);

      await commitBatchWithContext(batch, {
        operation: 'delete',
        path: `classes/${classId} and related teachers`,
      });
    } catch (e) {
      if (!(e instanceof FirestorePermissionError)) {
        const permissionError = new FirestorePermissionError({
          operation: 'delete',
          path: `classes/${classId} and related teachers`,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
      }
      throw e;
    }
  };

  const handleUpdateSchedule = async (classId: string, newSchedule: ClassSchedule) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);
    try {
        const classRef = doc(firestore, 'classes', classId);
        const classSnap = await getDoc(classRef);
        if (!classSnap.exists()) return;
        const oldSchedule = classSnap.data().schedule || {};

        batch.update(classRef, { schedule: newSchedule });

        const allRelevantTeacherIds = new Set<string>();
        for (const schedule of [oldSchedule, newSchedule]) {
            Object.values(schedule || {}).forEach(day => 
                Object.values(day || {}).forEach(lessons => {
                    const safeLessons = Array.isArray(lessons) ? lessons : [];
                    safeLessons.forEach((lesson: Lesson) => {
                        if (lesson?.teacherId) allRelevantTeacherIds.add(lesson.teacherId);
                    });
                })
            )
        }

        for (const teacherId of allRelevantTeacherIds) {
            const teacherRef = doc(firestore, 'teachers', teacherId);
            const teacherSnap = await getDoc(teacherRef);
            if (!teacherSnap.exists()) continue;

            const teacherData = teacherSnap.data() as Teacher;
            const updatedTeacherSchedule = JSON.parse(JSON.stringify(teacherData.schedule || {}));

            daysOfWeek.forEach(day => {
                (timeSlots || []).forEach(slot => {
                    const time = slot.start;
                    const oldLessons = oldSchedule[day]?.[time] || [];
                    const newLessons = newSchedule[day]?.[time] || [];

                    const safeOldLessons = Array.isArray(oldLessons) ? oldLessons : [];
                    const safeNewLessons = Array.isArray(newLessons) ? newLessons : [];

                    const oldLesson = safeOldLessons.find((l: Lesson) => l.teacherId === teacherId);
                    const newLesson = safeNewLessons.find((l: Lesson) => l.teacherId === teacherId);

                    if (oldLesson && !newLesson) {
                         // Removed
                         const currentTeacherLessons = updatedTeacherSchedule[day]?.[time] || [];
                         if (Array.isArray(currentTeacherLessons)) {
                             updatedTeacherSchedule[day][time] = currentTeacherLessons.filter((l: Lesson) => l.classId !== classId);
                             if (updatedTeacherSchedule[day][time].length === 0) delete updatedTeacherSchedule[day][time];
                         }
                    }
                    if (newLesson) {
                        // Added or Updated
                        updatedTeacherSchedule[day] = updatedTeacherSchedule[day] || {};
                        const currentTeacherLessons = updatedTeacherSchedule[day][time] || [];
                        // Remove existing lesson for this class if any
                        const otherLessons = Array.isArray(currentTeacherLessons) 
                            ? currentTeacherLessons.filter((l: Lesson) => l.classId !== classId) 
                            : [];
                        
                        updatedTeacherSchedule[day][time] = [...otherLessons, { ...newLesson, classId: classId }];
                    }
                });
            });
            batch.update(teacherRef, { schedule: updatedTeacherSchedule });
        }
        
        await commitBatchWithContext(batch, {
            operation: 'update',
            path: `classes/${classId}`,
            data: { schedule: newSchedule }
        });

        setClassToEditSchedule(null);

    } catch (e) {
      if (!(e instanceof FirestorePermissionError)) {
        const permissionError = new FirestorePermissionError({
            operation: 'update',
            path: `classes/${classId}`,
            requestResourceData: { schedule: newSchedule },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
      }
      throw e;
    }
  };


  const filteredClasses = (initialClasses || []).filter(schoolClass =>
    schoolClass.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (classesLoading) {
      return <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <Card className="mt-6 border-none shadow-none">
      <CardHeader>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div className='flex-1'>
              <CardTitle className="text-xl">ניהול כיתות ומגמות</CardTitle>
              <CardDescription>צפה ונהל את כיתות האם ומגמות הלימוד.</CardDescription>
          </div>
          <div className="flex bg-muted p-1 rounded-lg shrink-0">
            <button
              onClick={() => setActiveTab('classes')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'classes'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              כיתות אם
            </button>
            <button
              onClick={() => setActiveTab('majors')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'majors'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              מגמות
            </button>
          </div>
        </div>
        
        {activeTab === 'classes' && (
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4'>
            <div className='flex-1'>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
        )}
      </CardHeader>

      <CardContent>
        {activeTab === 'majors' ? (
            <MajorsTab 
                teachers={allTeachers}
                classes={initialClasses}
                timeSlots={timeSlots}
            />
        ) : (
            initialClasses && initialClasses.length > 0 ? (
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
                                פעולה זו תמחק את הכיתה ואת כל השיבוצים המשוייכים אליה ממערכות המורים לצמיתות. לא ניתן לבטל את הפעולה.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => handleDeleteClass(schoolClass.id)}>
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
            )
        )}
      </CardContent>

      <CreateClassDialog
        isOpen={isCreateClassOpen}
        onOpenChange={setCreateClassOpen}
        onAddClass={handleAddClass}
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
        onUpdateSchedule={handleUpdateSchedule}
        isEditing={true}
        allClasses={initialClasses}
        timeSlots={timeSlots}
      />

    </Card>
  );
}
