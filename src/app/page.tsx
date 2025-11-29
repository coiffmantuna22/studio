
'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/app/header';
import TeacherList from '@/components/app/teacher-list';
import Timetable from '@/components/app/timetable';
import ClassList from '@/components/app/class-list';
import SettingsTab from '@/components/app/settings-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SchoolClass, Teacher, TimeSlot, ClassSchedule, Lesson, TeacherAvailabilityStatus } from '@/lib/types';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, doc, writeBatch, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2, UserX, AlertTriangle } from 'lucide-react';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { Button } from '@/components/ui/button';
import { daysOfWeek } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { isSameDay, startOfDay } from 'date-fns';
import { getTeacherAvailabilityStatus } from '@/lib/substitute-finder';
import MarkAbsentDialog from '@/components/app/mark-absent-dialog';
import RecommendationDialog from '@/components/app/recommendation-dialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';


export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<Teacher | null>(null);
  const [recommendation, setRecommendation] = useState<{
    results: any[];
    absentTeacher: Teacher;
    absenceDays: any[];
  } | null>(null);


  const teachersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const classesQuery = useMemoFirebase(() => user ? query(collection(firestore, 'classes'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const settingsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'settings'), where('userId', '==', user.uid)) : null, [user, firestore]);

  const { data: teachers = [], isLoading: teachersLoading } = useCollection<Teacher>(teachersQuery);
  const { data: schoolClasses = [], isLoading: classesLoading } = useCollection<SchoolClass>(classesQuery);
  const { data: settingsCollection, isLoading: settingsLoading } = useCollection(settingsQuery);

  const timeSlots: TimeSlot[] = useMemo(() => {
    if (settingsCollection) {
      const settingsDoc = settingsCollection.find(d => d.id === `timetable_${user?.uid}`);
      if (settingsDoc) {
        return settingsDoc.slots || [];
      }
    }
    return [];
  }, [settingsCollection, user]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const teacherAvailabilityNow = useMemo(() => {
    const availabilityMap = new Map<string, TeacherAvailabilityStatus>();
    const now = new Date();
    (teachers || []).forEach(teacher => {
        availabilityMap.set(teacher.id, getTeacherAvailabilityStatus(teacher, now, timeSlots));
    });
    return availabilityMap;
  }, [teachers, timeSlots]);


  const seedData = async () => {
    if (!firestore || !user) return;
    try {
      const batch = writeBatch(firestore);
      
      const teacherDocs = (await getDocs(query(collection(firestore, 'teachers'), where('userId', '==', user.uid)))).docs;
      const classDocs = (await getDocs(query(collection(firestore, 'classes'), where('userId', '==', user.uid)))).docs;
      
      // If data already exists, don't seed.
      if (teacherDocs.length > 0 || classDocs.length > 0) return;

      const teacherIdMap: { [key: string]: string } = {};

      
      const classIdMap: { [key: string]: string } = {};

      

      const settingsRef = doc(firestore, 'settings', `timetable_${user.uid}`);
      const timetableData = { slots: [], userId: user.uid };
      batch.set(settingsRef, timetableData);
      
      await commitBatchWithContext(batch, {
          operation: 'create',
          path: `user_data_seed/${user.uid}`
      });

    } catch (e) {
      if (!(e instanceof FirestorePermissionError)) {
        const permissionError = new FirestorePermissionError({
          operation: 'create',
          path: `seed data for user ${user?.uid}`,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
      }
      throw e;
    }
  };

  const handleAddTeacher = async (newTeacherData: Omit<Teacher, 'id' | 'userId' | 'avatar'>) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'teachers'));
    const fallback = newTeacherData.name.split(' ').map((n) => n[0]).join('').toUpperCase();
    const newTeacher = { ...newTeacherData, id: newDocRef.id, userId: user.uid, avatar: { fallback }, schedule: {} };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newTeacher);
    await commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newTeacher });
  };

  const handleEditTeacher = async (updatedTeacher: Omit<Teacher, 'avatar' | 'userId' | 'schedule'>) => {
    if (!firestore || !user) return;
    const teacherRef = doc(firestore, 'teachers', updatedTeacher.id);
    const batch = writeBatch(firestore);
    batch.update(teacherRef, { ...updatedTeacher });
    await commitBatchWithContext(batch, { operation: 'update', path: teacherRef.path, data: updatedTeacher });
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!firestore || !user) return;
    
    const batch = writeBatch(firestore);
    try {
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

        const teacherRef = doc(firestore, 'teachers', teacherId);
        batch.delete(teacherRef);

        await commitBatchWithContext(batch, {
            operation: 'delete',
            path: `teachers/${teacherId} and related classes`
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
    }
  }

  const handleAddClass = async (className: string) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'classes'));
    const newClass: Omit<SchoolClass, 'id'> = {
      name: className,
      schedule: {},
      userId: user.uid,
    };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newClass);
    await commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newClass });
  };

  const handleDeleteClass = async (classId: string) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);
     try {
        const classRef = doc(firestore, "classes", classId);
        const classSnap = await getDoc(classRef);
        if (!classSnap.exists()) return;

        const schoolClass = classSnap.data() as SchoolClass;

        const teacherIds = new Set<string>();
        Object.values(schoolClass.schedule || {}).forEach(daySchedule => {
            Object.values(daySchedule).forEach(lesson => {
                if (lesson) teacherIds.add(lesson.teacherId);
            });
        });

        for (const teacherId of teacherIds) {
            const teacherRef = doc(firestore, "teachers", teacherId);
            const teacherSnap = await getDoc(teacherRef);
            if (teacherSnap.exists()) {
                const teacher = teacherSnap.data() as Teacher;
                const newSchedule = JSON.parse(JSON.stringify(teacher.schedule || {}));
                Object.keys(newSchedule).forEach(day => {
                    Object.keys(newSchedule[day] || {}).forEach(time => {
                        if (newSchedule[day][time]?.classId === classId) {
                            delete newSchedule[day][time];
                        }
                    });
                });
                batch.update(teacherRef, { schedule: newSchedule });
            }
        }
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

const handleScheduleUpdate = async (
    entityType: 'teacher' | 'class',
    entityId: string,
    newSchedule: ClassSchedule
) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);
    try {
        if (entityType === 'teacher') {
            const teacherRef = doc(firestore, 'teachers', entityId);
            const teacherSnap = await getDoc(teacherRef);
            if (!teacherSnap.exists()) return;
            const oldSchedule = teacherSnap.data().schedule || {};

            batch.update(teacherRef, { schedule: newSchedule });

            const allRelevantClassIds = new Set<string>();
            for (const schedule of [oldSchedule, newSchedule]) {
                Object.values(schedule).forEach(day => 
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

                daysOfWeek.forEach(day => {
                    timeSlots.forEach(slot => {
                        const time = slot.start;
                        const oldLesson = oldSchedule[day]?.[time];
                        const newLesson = newSchedule[day]?.[time];

                        // Case 1: Lesson was removed for this teacher in this slot
                        if (oldLesson?.classId === classId && (!newLesson || newLesson.classId !== classId)) {
                            if (updatedClassSchedule[day]?.[time]?.teacherId === entityId) {
                                (updatedClassSchedule[day] as any)[time] = null;
                            }
                        }
                        // Case 2: Lesson was added for this teacher in this slot
                        if (newLesson?.classId === classId) {
                            updatedClassSchedule[day] = updatedClassSchedule[day] || {};
                            updatedClassSchedule[day][time] = { ...(newLesson as Lesson), teacherId: entityId };
                        }
                    });
                });
                batch.update(classRef, { schedule: updatedClassSchedule });
            }

        } else { // entityType === 'class'
            const classRef = doc(firestore, 'classes', entityId);
            const classSnap = await getDoc(classRef);
            if (!classSnap.exists()) return;
            const oldSchedule = classSnap.data().schedule || {};

            batch.update(classRef, { schedule: newSchedule });

            const allRelevantTeacherIds = new Set<string>();
            for (const schedule of [oldSchedule, newSchedule]) {
                Object.values(schedule).forEach(day => 
                    Object.values(day || {}).forEach(lesson => 
                        lesson?.teacherId && allRelevantTeacherIds.add(lesson.teacherId)
                    )
                )
            }

            for (const teacherId of allRelevantTeacherIds) {
                const teacherRef = doc(firestore, 'teachers', teacherId);
                const teacherSnap = await getDoc(teacherRef);
                if (!teacherSnap.exists()) continue;

                const teacherData = teacherSnap.data() as Teacher;
                const updatedTeacherSchedule = JSON.parse(JSON.stringify(teacherData.schedule || {}));

                daysOfWeek.forEach(day => {
                    timeSlots.forEach(slot => {
                        const time = slot.start;
                        const oldLesson = oldSchedule[day]?.[time];
                        const newLesson = newSchedule[day]?.[time];

                        // Case 1: Lesson was removed for this class for this teacher
                        if (oldLesson?.teacherId === teacherId && (!newLesson || newLesson.teacherId !== teacherId)) {
                             if (updatedTeacherSchedule[day]?.[time]?.classId === entityId) {
                                (updatedTeacherSchedule[day] as any)[time] = null;
                            }
                        }
                        // Case 2: Lesson was added for this class for this teacher
                        if (newLesson?.teacherId === teacherId) {
                            updatedTeacherSchedule[day] = updatedTeacherSchedule[day] || {};
                            updatedTeacherSchedule[day][time] = { ...(newLesson as Lesson), classId: entityId };
                        }
                    });
                });
                batch.update(teacherRef, { schedule: updatedTeacherSchedule });
            }
        }

        await commitBatchWithContext(batch, {
            operation: 'update',
            path: `${entityType === 'teacher' ? 'teachers' : 'classes'}/${entityId}`,
            data: { schedule: newSchedule }
        });

    } catch (e) {
      if (!(e instanceof FirestorePermissionError)) {
        const permissionError = new FirestorePermissionError({
            operation: 'update',
            path: `${entityType === 'teacher' ? 'teachers' : 'classes'}/${entityId}`,
            requestResourceData: { schedule: newSchedule },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
      }
      throw e;
    }
}
  
  const handleTimetableSettingsUpdate = async (newTimeSlots: TimeSlot[]) => {
      if (!firestore || !user) return;
      
      const isInitialSetup = timeSlots.length === 0 && (teachers?.length ?? 0) === 0 && (schoolClasses?.length ?? 0) === 0;

      const settingsRef = doc(firestore, 'settings', `timetable_${user.uid}`);
      const timetableData = { slots: newTimeSlots, userId: user.uid };

      const batch = writeBatch(firestore);
      batch.set(settingsRef, timetableData, { merge: true });
      
      try {
        await commitBatchWithContext(batch, { operation: 'update', path: settingsRef.path, data: timetableData });
        if (isInitialSetup) {
          await seedData();
        }
      } catch (e) {
        console.error("Failed to update timetable settings.", e);
      }
  }

  const handleMarkAbsent = async (absentTeacher: Teacher, absenceDays: any[], assignments: any[]) => {
    if (!firestore || !user) return;
    
    const batch = writeBatch(firestore);

    // 1. Mark teacher as absent
    const teacherRef = doc(firestore, 'teachers', absentTeacher.id);
    const existingAbsences = absentTeacher.absences || [];
    const absenceData = absenceDays.map(d => ({...d, date: d.date.toISOString()}));
    batch.update(teacherRef, { absences: [...existingAbsences, ...absenceData] });

    const allClassSchedulesToUpdate = new Map<string, ClassSchedule>();
    const allTeacherSchedulesToUpdate = new Map<string, ClassSchedule>();
    
    // Prime the maps with current schedules
    (schoolClasses || []).forEach(c => allClassSchedulesToUpdate.set(c.id, JSON.parse(JSON.stringify(c.schedule))));
    (teachers || []).forEach(t => allTeacherSchedulesToUpdate.set(t.id, JSON.parse(JSON.stringify(t.schedule || {}))));


    for (const assignment of assignments) {
      const { classId, day, time, newTeacherId, originalLesson } = assignment;
      
      // Update Class Schedule
      const classSchedule = allClassSchedulesToUpdate.get(classId);
      if (classSchedule) {
          if (!classSchedule[day]) classSchedule[day] = {};
          if (newTeacherId) { 
              classSchedule[day][time] = { ...originalLesson, teacherId: newTeacherId };
          } else { 
              classSchedule[day][time] = null;
          }
      }

      // Update new Teacher's schedule
      if (newTeacherId) {
        const subTeacherSchedule = allTeacherSchedulesToUpdate.get(newTeacherId);
        if(subTeacherSchedule) {
           if (!subTeacherSchedule[day]) subTeacherSchedule[day] = {};
           subTeacherSchedule[day][time] = { ...originalLesson, classId };
        }
      }
    }
    
    // Apply all schedule updates to the batch
    for (const [classId, schedule] of allClassSchedulesToUpdate.entries()) {
        const classRef = doc(firestore, 'classes', classId);
        batch.update(classRef, { schedule });
    }
    for (const [teacherId, schedule] of allTeacherSchedulesToUpdate.entries()) {
        const teacherRef = doc(firestore, 'teachers', teacherId);
        batch.update(teacherRef, { schedule });
    }
    
    await commitBatchWithContext(batch, { operation: 'update', path: `absences_and_substitutions` });
    setRecommendation(null);
  }

  const todaysAbsences = useMemo(() => {
    const today = startOfDay(new Date());
    return (teachers || []).filter(teacher => 
        teacher.absences?.some(absence => {
            // Ensure absence.date is a valid date string before parsing
            if (typeof absence.date !== 'string') return false;
            try {
                return isSameDay(new Date(absence.date), today);
            } catch (e) {
                return false;
            }
        })
    );
  }, [teachers]);

  const isDataLoading = isUserLoading || teachersLoading || classesLoading || settingsLoading;

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  const isNewUser = !isDataLoading && user && (teachers?.length === 0) && (schoolClasses?.length === 0) && timeSlots.length === 0;

  if (isNewUser) {
      return (
         <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 p-4 sm:p-6 md:p-8">
               <SettingsTab
                  timeSlots={[]}
                  onUpdate={handleTimetableSettingsUpdate}
                  isInitialSetup={isNewUser}
               />
            </main>
         </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
        <Card>
          <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <AlertTriangle className="text-destructive" />
                מורים חסרים היום
              </CardTitle>
              <CardDescription>סקירה מהירה של ההיעדרויות להיום. לחץ על מורה כדי למצוא מחליפים.</CardDescription>
          </CardHeader>
          <CardContent>
            {todaysAbsences.length > 0 ? (
                <div className="space-y-3">
                    {todaysAbsences.map(teacher => (
                        <div key={teacher.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                            <span className="font-semibold">{teacher.name}</span>
                            <Button size="sm" variant="destructive" onClick={() => setTeacherToMarkAbsent(teacher)}>
                                <UserX className="ml-2 h-4 w-4" />
                                מצא מחליף
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">אין היעדרויות רשומות להיום.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <Tabs defaultValue="teachers" className="w-full">
              <div className='flex justify-center'>
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl">
                  <TabsTrigger value="teachers">פרופילי מורים</TabsTrigger>
                  <TabsTrigger value="classes">כיתות לימוד</TabsTrigger>
                  <TabsTrigger value="timetable">זמינות מחליפים</TabsTrigger>
                  <TabsTrigger value="settings">הגדרות</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="teachers">
                <TeacherList
                  teachers={teachers}
                  allClasses={schoolClasses}
                  timeSlots={timeSlots}
                  onAddTeacher={handleAddTeacher}
                  onEditTeacher={handleEditTeacher}
                  onDeleteTeacher={handleDeleteTeacher}
                  onMarkAbsent={(teacher) => setTeacherToMarkAbsent(teacher)}
                  onUpdateTeacherSchedule={(teacherId, schedule) => handleScheduleUpdate('teacher', teacherId, schedule)}
                  teacherAvailabilityNow={teacherAvailabilityNow}
                />
              </TabsContent>
              <TabsContent value="classes">
                <ClassList 
                  initialClasses={schoolClasses} 
                  allTeachers={teachers}
                  timeSlots={timeSlots}
                  onAddClass={handleAddClass}
                  onDeleteClass={handleDeleteClass}
                  onUpdateSchedule={(classId, schedule) => handleScheduleUpdate('class', classId, schedule)}
                />
              </TabsContent>
              <TabsContent value="timetable">
                <Timetable allTeachers={teachers} timeSlots={timeSlots} />
              </TabsContent>
              <TabsContent value="settings">
                <SettingsTab timeSlots={timeSlots} onUpdate={handleTimetableSettingsUpdate}/>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </main>

       <MarkAbsentDialog
        isOpen={!!teacherToMarkAbsent}
        onOpenChange={(open) => !open && setTeacherToMarkAbsent(null)}
        teacher={teacherToMarkAbsent}
        allTeachers={teachers}
        allClasses={schoolClasses}
        timeSlots={timeSlots}
        onShowRecommendation={(results, absentTeacher, absenceDays) => {
            setRecommendation({ results, absentTeacher, absenceDays });
        }}
      />

       <RecommendationDialog
        isOpen={!!recommendation}
        onOpenChange={(open) => !open && setRecommendation(null)}
        recommendationResult={recommendation}
        onConfirmAssignments={handleMarkAbsent}
      />

    </div>
  );
}
