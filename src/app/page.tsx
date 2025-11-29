

'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/app/header';
import TeacherList from '@/components/app/teacher-list';
import Timetable from '@/components/app/timetable';
import ClassList from '@/components/app/class-list';
import SettingsTab from '@/components/app/settings-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { initialTeachers, initialClasses as defaultClasses, initialTimeSlots } from '@/lib/data';
import type { SchoolClass, Teacher, TimeSlot, ClassSchedule, Lesson } from '@/lib/types';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, doc, writeBatch, query, where, getDocs, runTransaction, DocumentReference } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Loader2 } from 'lucide-react';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { Button } from '@/components/ui/button';
import { daysOfWeek } from '@/lib/constants';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  
  const teachersQuery = user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null;
  const classesQuery = user ? query(collection(firestore, 'classes'), where('userId', '==', user.uid)) : null;
  const settingsQuery = user ? query(collection(firestore, 'settings'), where('userId', '==', user.uid)) : null;
  
  const [teachersCollection, teachersLoading] = useCollection(teachersQuery);
  const [classesCollection, classesLoading] = useCollection(classesQuery);
  const [settingsCollection, settingsLoading] = useCollection(settingsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (teachersCollection) {
      const teachersData = teachersCollection.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
      setTeachers(teachersData);
    }
  }, [teachersCollection]);

  useEffect(() => {
    if (classesCollection) {
      const classesData = classesCollection.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolClass));
      setSchoolClasses(classesData);
    }
  }, [classesCollection]);

  useEffect(() => {
    if (settingsCollection) {
      const settingsDoc = settingsCollection.docs.find(d => d.id === `timetable_${user?.uid}`);
      if (settingsDoc?.exists()) {
        setTimeSlots(settingsDoc.data().slots);
      } else {
        setTimeSlots([]);
      }
    }
  }, [settingsCollection, user]);

  const seedData = async () => {
    if (!firestore || !user) return;
    try {
      await runTransaction(firestore, async (transaction) => {
        const teacherRefMap = new Map<string, DocumentReference>();
        initialTeachers.forEach(t => {
            const tempRef = doc(collection(firestore, 'teachers'));
            teacherRefMap.set(t.id, tempRef);
        });

        const classRefMap = new Map<string, DocumentReference>();
        defaultClasses.forEach(c => {
            const tempRef = doc(collection(firestore, 'classes'));
            classRefMap.set(c.id, tempRef);
        });

        const synchronizedTeachers = initialTeachers.map(teacher => {
            const newTeacherRef = teacherRefMap.get(teacher.id)!;
            return { ...teacher, id: newTeacherRef.id, userId: user.uid, schedule: {} };
        });

        const synchronizedClasses = defaultClasses.map(sc => {
            const newSchedule: ClassSchedule = {};
            daysOfWeek.forEach(day => {
                newSchedule[day] = {};
                if(sc.schedule[day]) {
                    Object.keys(sc.schedule[day]).forEach(time => {
                        const lesson = sc.schedule[day]![time];
                        if (lesson) {
                           const originalTeacherId = lesson.teacherId;
                           const newTeacherRef = teacherRefMap.get(originalTeacherId);
                           if(newTeacherRef) {
                             newSchedule[day]![time] = { ...lesson, teacherId: newTeacherRef.id };
                           }
                        }
                    });
                }
            });
            const newClassRef = classRefMap.get(sc.id)!;
            return { ...sc, id: newClassRef.id, userId: user.uid, schedule: newSchedule };
        });

        synchronizedTeachers.forEach(teacher => {
             const newTeacherSchedule: ClassSchedule = {};
              daysOfWeek.forEach(day => {
                newTeacherSchedule[day] = {};
                synchronizedClasses.forEach(sc => {
                    if (sc.schedule[day]) {
                        Object.entries(sc.schedule[day]).forEach(([time, lesson]) => {
                             if(lesson && lesson.teacherId === teacher.id) {
                                newTeacherSchedule[day]![time] = { ...lesson, classId: sc.id };
                            }
                        })
                    }
                })
            });
            teacher.schedule = newTeacherSchedule;
        })


        synchronizedTeachers.forEach(teacher => {
            const originalTeacher = initialTeachers.find(t => t.name === teacher.name);
            if (originalTeacher) {
                const teacherRef = teacherRefMap.get(originalTeacher.id)!;
                transaction.set(teacherRef, teacher);
            }
        });

        synchronizedClasses.forEach(sClass => {
             const originalId = Array.from(classRefMap.entries()).find(([, ref]) => ref.id === sClass.id)?.[0];
             if(originalId){
                const classRef = classRefMap.get(originalId)!;
                transaction.set(classRef, sClass);
             }
        });
        
        const settingsRef = doc(firestore, 'settings', `timetable_${user.uid}`);
        const timetableData = { slots: initialTimeSlots, userId: user.uid };
        transaction.set(settingsRef, timetableData);
      });
    } catch (e) {
       console.error("Transaction to seed data failed. This may be a permission error. The error was: ", e);
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
    batch.update(teacherRef, updatedTeacher as any);
    await commitBatchWithContext(batch, { operation: 'update', path: teacherRef.path, data: updatedTeacher });
  }

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!firestore || !user) return;
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const classesQuerySnapshot = await getDocs(query(collection(firestore, 'classes'), where('userId', '==', user.uid)));
        
        classesQuerySnapshot.forEach(classDoc => {
          const schoolClass = { id: classDoc.id, ...classDoc.data() } as SchoolClass;
          let classWasModified = false;
          const newSchedule = { ...schoolClass.schedule };

          Object.keys(newSchedule).forEach(day => {
            if (newSchedule[day]) {
              Object.keys(newSchedule[day]).forEach(time => {
                const lesson = newSchedule[day]?.[time];
                if (lesson && lesson.teacherId === teacherId) {
                  newSchedule[day][time] = null; 
                  classWasModified = true;
                }
              });
            }
          });

          if (classWasModified) {
            const classRef = doc(firestore, 'classes', schoolClass.id);
            transaction.update(classRef, { schedule: newSchedule });
          }
        });

        const teacherRef = doc(firestore, 'teachers', teacherId);
        transaction.delete(teacherRef);
      });
    } catch (e) {
      const permissionError = new FirestorePermissionError({
        operation: 'delete',
        path: `teachers/${teacherId} and related classes`,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
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

     try {
      await runTransaction(firestore, async (transaction) => {
        const classRef = doc(firestore, "classes", classId);
        const classSnap = await transaction.get(classRef);
        if (!classSnap.exists()) return;

        const schoolClass = classSnap.data() as SchoolClass;

        const teacherIds = new Set<string>();
        Object.values(schoolClass.schedule).forEach(daySchedule => {
            Object.values(daySchedule).forEach(lesson => {
                if (lesson) teacherIds.add(lesson.teacherId);
            });
        });

        for (const teacherId of teacherIds) {
            const teacherRef = doc(firestore, "teachers", teacherId);
            const teacherSnap = await transaction.get(teacherRef);
            if (teacherSnap.exists()) {
                const teacher = teacherSnap.data() as Teacher;
                const newSchedule = JSON.parse(JSON.stringify(teacher.schedule || {}));
                Object.keys(newSchedule).forEach(day => {
                    Object.keys(newSchedule[day]).forEach(time => {
                        if (newSchedule[day][time]?.classId === classId) {
                            newSchedule[day][time] = null;
                        }
                    });
                });
                transaction.update(teacherRef, { schedule: newSchedule });
            }
        }
        transaction.delete(classRef);
      });
    } catch (e) {
      const permissionError = new FirestorePermissionError({
        operation: 'delete',
        path: `classes/${classId} and related teachers`,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    }
  };

  const handleScheduleUpdate = async (
    entityType: 'teacher' | 'class', 
    entityId: string, 
    newSchedule: ClassSchedule
  ) => {
    if (!firestore || !user) return;

    try {
      await runTransaction(firestore, async (transaction) => {
        if (entityType === 'teacher') {
          const teacherRef = doc(firestore, 'teachers', entityId);
          const teacherSnap = await transaction.get(teacherRef);
          if (!teacherSnap.exists()) return;
          const oldSchedule = teacherSnap.data().schedule || {};
          transaction.update(teacherRef, { schedule: newSchedule });
          
          const allRelevantClassIds = new Set<string>();
          [oldSchedule, newSchedule].forEach(schedule => Object.values(schedule).forEach(day => Object.values(day).forEach(lesson => lesson?.classId && allRelevantClassIds.add(lesson.classId))));

          for (const classId of allRelevantClassIds) {
              const classRef = doc(firestore, 'classes', classId);
              const classSnap = await transaction.get(classRef);
              if (!classSnap.exists()) continue;
              
              const classData = classSnap.data() as SchoolClass;
              const updatedClassSchedule = JSON.parse(JSON.stringify(classData.schedule || {}));

              daysOfWeek.forEach(day => {
                  timeSlots.forEach(slot => {
                      const time = slot.start;
                      const oldLesson = oldSchedule[day]?.[time];
                      const newLesson = newSchedule[day]?.[time];

                      if (oldLesson?.classId === classId && newLesson?.classId !== classId) {
                          if (updatedClassSchedule[day]?.[time]?.teacherId === entityId) {
                              updatedClassSchedule[day][time] = null;
                          }
                      }
                      if (newLesson?.classId === classId) {
                          updatedClassSchedule[day] = updatedClassSchedule[day] || {};
                          updatedClassSchedule[day][time] = { ...(newLesson as Lesson), teacherId: entityId };
                      }
                  });
              });
              transaction.update(classRef, { schedule: updatedClassSchedule });
          }

        } else { // entityType === 'class'
          const classRef = doc(firestore, 'classes', entityId);
          const classSnap = await transaction.get(classRef);
          if (!classSnap.exists()) return;
          const oldSchedule = classSnap.data().schedule || {};

          transaction.update(classRef, { schedule: newSchedule });

          const allRelevantTeacherIds = new Set<string>();
          [oldSchedule, newSchedule].forEach(schedule => Object.values(schedule).forEach(day => Object.values(day).forEach(lesson => lesson?.teacherId && allRelevantTeacherIds.add(lesson.teacherId))));

          for (const teacherId of allRelevantTeacherIds) {
              const teacherRef = doc(firestore, 'teachers', teacherId);
              const teacherSnap = await transaction.get(teacherRef);
              if (!teacherSnap.exists()) continue;

              const teacherData = teacherSnap.data() as Teacher;
              const updatedTeacherSchedule = JSON.parse(JSON.stringify(teacherData.schedule || {}));

              daysOfWeek.forEach(day => {
                  timeSlots.forEach(slot => {
                      const time = slot.start;
                      const oldLesson = oldSchedule[day]?.[time];
                      const newLesson = newSchedule[day]?.[time];
                      
                      if (oldLesson?.teacherId === teacherId && newLesson?.teacherId !== teacherId) {
                           if (updatedTeacherSchedule[day]?.[time]?.classId === entityId) {
                              updatedTeacherSchedule[day][time] = null;
                          }
                      }
                      if (newLesson?.teacherId === teacherId) {
                          updatedTeacherSchedule[day] = updatedTeacherSchedule[day] || {};
                          updatedTeacherSchedule[day][time] = { ...(newLesson as Lesson), classId: entityId };
                      }
                  });
              });
              transaction.update(teacherRef, { schedule: updatedTeacherSchedule });
          }
        }
      });
    } catch (e) {
        const permissionError = new FirestorePermissionError({
            operation: 'update',
            path: `${entityType === 'teacher' ? 'teachers' : 'classes'}/${entityId}`,
            requestResourceData: { schedule: newSchedule },
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
  }
  
  const handleTimetableSettingsUpdate = async (newTimeSlots: TimeSlot[]) => {
      if (!firestore || !user) return;
      
      const isInitialSetup = timeSlots.length === 0 && teachers.length === 0 && schoolClasses.length === 0;

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
        // Error is already emitted by commitBatchWithContext, just log for debugging
        console.error("Failed to update timetable settings.", e);
      }
  }

  const handleMarkAbsent = async (teacherId: string, absenceDays: any[]) => {
    if (!firestore || !user) return;
    const teacherRef = doc(firestore, 'teachers', teacherId);
    
    const absenceData = absenceDays.map(d => ({...d, date: d.date.toISOString()}));

    const batch = writeBatch(firestore);
    batch.update(teacherRef, { absences: absenceData });
    await commitBatchWithContext(batch, { operation: 'update', path: teacherRef.path, data: { absences: absenceData } });
  }

  const isDataLoading = isUserLoading || teachersLoading || classesLoading || settingsLoading;

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  const isNewUser = !isDataLoading && user && teachers.length === 0 && schoolClasses.length === 0 && timeSlots.length === 0;

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
      <main className="flex-1 p-4 sm:p-6 md:p-8">
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
              onMarkAbsent={handleMarkAbsent}
              onUpdateTeacherSchedule={(teacherId, schedule) => handleScheduleUpdate('teacher', teacherId, schedule)}
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
      </main>
    </div>
  );
}
