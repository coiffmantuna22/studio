'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/app/header';
import type { SchoolClass, Teacher, TimeSlot, ClassSchedule, Lesson, TeacherAvailabilityStatus, AffectedLesson, AbsenceDay } from '@/lib/types';
import { isSameDay, startOfDay, getDay, format } from 'date-fns';
import { he } from 'date-fns/locale';

const TeacherList = dynamic(() => import('@/components/app/teacher-list'), {
  loading: () => <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});
const Timetable = dynamic(() => import('@/components/app/timetable'), {
  loading: () => <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});
const ClassList = dynamic(() => import('@/components/app/class-list'), {
  loading: () => <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});
const SettingsTab = dynamic(() => import('@/components/app/settings-tab'), {
  loading: () => <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, doc, writeBatch, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2, AlertTriangle } from 'lucide-react';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { Button } from '@/components/ui/button';
import { daysOfWeek } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getTeacherAvailabilityStatus, findSubstitute } from '@/lib/substitute-finder';
import MarkAbsentDialog from '@/components/app/mark-absent-dialog';
import RecommendationDialog from '@/components/app/recommendation-dialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const getAffectedLessons = (
  absentTeacher: Teacher,
  absenceDays: AbsenceDay[],
  allClasses: SchoolClass[],
  timeSlots: TimeSlot[]
): Omit<AffectedLesson, 'recommendation' | 'recommendationId' | 'reasoning' | 'substituteOptions'>[] => {
  const affected: Omit<AffectedLesson, 'recommendation' | 'recommendationId' | 'reasoning' | 'substituteOptions'>[] = [];
  const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  const getMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  (absenceDays || []).forEach(day => {
    const dayOfWeek = dayMap[getDay(startOfDay(new Date(day.date)))];
    const absenceStart = day.isAllDay ? 0 : getMinutes(day.startTime);
    const absenceEnd = day.isAllDay ? 24 * 60 : getMinutes(day.endTime);

    (allClasses || []).forEach(schoolClass => {
      const classDaySchedule = schoolClass.schedule?.[dayOfWeek];
      if (classDaySchedule) {
        Object.entries(classDaySchedule).forEach(([time, lesson]) => {
          const lessonSlot = timeSlots.find(s => s.start === time);
          if (!lessonSlot || lessonSlot.type === 'break') return;

          const lessonStart = getMinutes(lessonSlot.start);
          const lessonEnd = getMinutes(lessonSlot.end);
          
          if (lesson && lesson.teacherId === absentTeacher.id && Math.max(lessonStart, absenceStart) < Math.min(lessonEnd, absenceEnd)) {
             affected.push({
              classId: schoolClass.id,
              className: schoolClass.name,
              date: new Date(day.date),
              time: time,
              lesson: lesson,
            });
          }
        });
      }
    });
  });

  return affected;
};

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const [activeTab, setActiveTab] = useState("teachers");
  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<Teacher | null>(null);
  const [recommendation, setRecommendation] = useState<{
    results: AffectedLesson[];
    absentTeacher: Teacher;
    absenceDays: any[];
  } | null>(null);
  const [absenceToReview, setAbsenceToReview] = useState<{ teacher: Teacher; absences: AbsenceDay[] } | null>(null);


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

  const isDataLoading = isUserLoading || teachersLoading || classesLoading || settingsLoading;

  const isInitialSetup = !isDataLoading && user && timeSlots.length === 0;

  const teacherAvailabilityNow = useMemo(() => {
    const availabilityMap = new Map<string, TeacherAvailabilityStatus>();
    const now = new Date();
    (teachers || []).forEach(teacher => {
        availabilityMap.set(teacher.id, getTeacherAvailabilityStatus(teacher, now, timeSlots));
    });
    return availabilityMap;
  }, [teachers, timeSlots]);


  const handleAddTeacher = async (newTeacherData: Omit<Teacher, 'id' | 'userId' | 'avatar'>) => {
    if (!firestore || !user) return;
    const newDocRef = doc(collection(firestore, 'teachers'));
    const fallback = newTeacherData.name.split(' ').map((n) => n[0]).join('').toUpperCase();
    const newTeacher = { ...newTeacherData, id: newDocRef.id, userId: user.uid, avatar: { fallback }, schedule: {}, absences: [] };
    const batch = writeBatch(firestore);
    batch.set(newDocRef, newTeacher);
    await commitBatchWithContext(batch, { operation: 'create', path: newDocRef.path, data: newTeacher });
  };

  const handleEditTeacher = async (updatedTeacher: Omit<Teacher, 'avatar' | 'userId' | 'schedule' | 'absences'>) => {
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

                daysOfWeek.forEach(day => {
                    (timeSlots || []).forEach(slot => {
                        const time = slot.start;
                        const oldLesson = oldSchedule[day]?.[time];
                        const newLesson = newSchedule[day]?.[time];

                        if (oldLesson?.classId === classId && (!newLesson || newLesson.classId !== classId)) {
                            if (updatedClassSchedule[day]?.[time]?.teacherId === entityId) {
                                (updatedClassSchedule[day] as any)[time] = null;
                            }
                        }
                        if (newLesson?.classId === classId) {
                            updatedClassSchedule[day] = updatedClassSchedule[day] || {};
                            updatedClassSchedule[day][time] = { ...(newLesson as Lesson), teacherId: entityId };
                        }
                    });
                });
                batch.update(classRef, { schedule: updatedClassSchedule });
            }

        } else { 
            const classRef = doc(firestore, 'classes', entityId);
            const classSnap = await getDoc(classRef);
            if (!classSnap.exists()) return;
            const oldSchedule = classSnap.data().schedule || {};

            batch.update(classRef, { schedule: newSchedule });

            const allRelevantTeacherIds = new Set<string>();
            for (const schedule of [oldSchedule, newSchedule]) {
                Object.values(schedule || {}).forEach(day => 
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
                    (timeSlots || []).forEach(slot => {
                        const time = slot.start;
                        const oldLesson = oldSchedule[day]?.[time];
                        const newLesson = newSchedule[day]?.[time];

                        if (oldLesson?.teacherId === teacherId && (!newLesson || newLesson.teacherId !== teacherId)) {
                             if (updatedTeacherSchedule[day]?.[time]?.classId === entityId) {
                                (updatedTeacherSchedule[day] as any)[time] = null;
                            }
                        }
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
      
      const settingsRef = doc(firestore, 'settings', `timetable_${user.uid}`);
      const timetableData = { slots: newTimeSlots, userId: user.uid };

      const batch = writeBatch(firestore);
      batch.set(settingsRef, timetableData, { merge: true });
      
      try {
        await commitBatchWithContext(batch, { operation: 'update', path: settingsRef.path, data: timetableData });
      } catch (e) {
        console.error("Failed to update timetable settings.", e);
      }
  }

  const handleMarkAbsent = async (absentTeacher: Teacher, absenceDays: AbsenceDay[]) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);
    const teacherRef = doc(firestore, 'teachers', absentTeacher.id);

    // Filter out old absences for the same days and add the new ones.
    const newAbsenceDates = absenceDays.map(d => startOfDay(new Date(d.date)).getTime());
    const updatedAbsences = (absentTeacher.absences || []).filter(
      (existing) => !newAbsenceDates.includes(startOfDay(new Date(existing.date)).getTime())
    );

    const newAbsenceData = absenceDays.map(d => ({
      ...d,
      date: startOfDay(new Date(d.date)).toISOString(),
    }));

    batch.update(teacherRef, { absences: [...updatedAbsences, ...newAbsenceData] });

    await commitBatchWithContext(batch, {
        operation: 'update',
        path: teacherRef.path,
        data: { absences: '...' }
    });

    setRecommendation(null);
  };

  const todaysAbsences = useMemo(() => {
    const today = startOfDay(new Date());
    return (teachers || [])
      .map(teacher => {
        const absences = (teacher.absences || []).filter(absence => {
          if (typeof absence.date !== 'string') return false;
          try {
            return isSameDay(startOfDay(new Date(absence.date)), today);
          } catch (e) {
            return false;
          }
        });
        return { teacher, absences };
      })
      .filter(item => item.absences.length > 0);
  }, [teachers]);

  const handleShowAffectedLessons = async (teacher: Teacher, absences: AbsenceDay[]) => {
    if (absences.length === 0 || !schoolClasses) return;
    
    const affectedLessons = getAffectedLessons(teacher, absences, schoolClasses, timeSlots);

    const substitutePool = (teachers || []).filter(t => t.id !== teacher.id);
    const recommendationPromises = affectedLessons.map(affected => 
      findSubstitute(
        { subject: affected.lesson.subject, date: affected.date, time: affected.time },
        substitutePool,
        schoolClasses,
        timeSlots
      )
    );
      
    const recommendations = await Promise.all(recommendationPromises);
    
    const finalResults = affectedLessons.map((lesson, index) => ({
      ...lesson,
      recommendation: recommendations[index].recommendation,
      recommendationId: recommendations[index].recommendationId,
      reasoning: recommendations[index].reasoning,
      substituteOptions: recommendations[index].substituteOptions,
    }));
    
    setRecommendation({ results: finalResults, absentTeacher: teacher, absenceDays: absences });
  };
  
    useEffect(() => {
        if (absenceToReview) {
            handleShowAffectedLessons(absenceToReview.teacher, absenceToReview.absences);
            setAbsenceToReview(null);
        }
    }, [absenceToReview]);

  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isInitialSetup) {
      return (
         <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 p-4 sm:p-6 md:p-8">
               <SettingsTab
                  timeSlots={[]}
                  onUpdate={handleTimetableSettingsUpdate}
                  isInitialSetup={isInitialSetup}
               />
            </main>
         </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
        {todaysAbsences.length > 0 && (
          <Card className="border-l-4 border-l-destructive shadow-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2">
                  <AlertTriangle className="text-destructive h-5 w-5" />
                  מורים חסרים היום
                </CardTitle>
                <CardDescription>סקירה מהירה של ההיעדרויות להיום. ניתן לעבור ללשונית "זמינות מחליפים" לשיבוץ.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {todaysAbsences.map(({ teacher, absences }) => {
                      const absenceTime = absences.map(a => {
                          const dayName = format(new Date(a.date), 'EEEE', { locale: he });
                          return a.isAllDay ? `${dayName}, יום שלם` : `${dayName}, ${a.startTime}-${a.endTime}`;
                      }).join('; ');
                      
                      return (
                          <div key={teacher.id} className="flex flex-col justify-between p-4 bg-secondary/30 rounded-xl border border-border">
                              <div className="mb-3">
                                <span className="font-semibold text-lg block">{teacher.name}</span>
                                <p className="text-sm text-muted-foreground mt-1">{absenceTime}</p>
                              </div>
                          </div>
                      );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
             <div className="w-full">
              <div className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-3xl mx-auto h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-full mb-8">
                <Button variant="ghost" onClick={() => setActiveTab("teachers")} className={`rounded-full py-2.5 transition-all ${activeTab === "teachers" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>פרופילי מורים</Button>
                <Button variant="ghost" onClick={() => setActiveTab("classes")} className={`rounded-full py-2.5 transition-all ${activeTab === "classes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>כיתות לימוד</Button>
                <Button variant="ghost" onClick={() => setActiveTab("timetable")} className={`rounded-full py-2.5 transition-all ${activeTab === "timetable" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>זמינות מחליפים</Button>
                <Button variant="ghost" onClick={() => setActiveTab("settings")} className={`rounded-full py-2.5 transition-all ${activeTab === "settings" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>הגדרות</Button>
              </div>

              {activeTab === "teachers" && (
                <div className="mt-0">
                  <TeacherList
                    teachers={teachers || []}
                    allClasses={schoolClasses || []}
                    timeSlots={timeSlots}
                    onAddTeacher={handleAddTeacher}
                    onEditTeacher={handleEditTeacher}
                    onDeleteTeacher={handleDeleteTeacher}
                    onMarkAbsent={(teacher) => setTeacherToMarkAbsent(teacher)}
                    onUpdateTeacherSchedule={(teacherId, schedule) => handleScheduleUpdate('teacher', teacherId, schedule)}
                    teacherAvailabilityNow={teacherAvailabilityNow}
                  />
                </div>
              )}

              {activeTab === "classes" && (
                <div className="mt-0">
                  <ClassList 
                    initialClasses={schoolClasses || []} 
                    allTeachers={teachers || []}
                    timeSlots={timeSlots}
                    onAddClass={handleAddClass}
                    onDeleteClass={handleDeleteClass}
                    onUpdateSchedule={(classId, schedule) => handleScheduleUpdate('class', classId, schedule)}
                  />
                </div>
              )}

              {activeTab === "timetable" && (
                <div className="mt-0">
                  <Timetable allTeachers={teachers || []} timeSlots={timeSlots} />
                </div>
              )}

              {activeTab === "settings" && (
                <div className="mt-0">
                  <SettingsTab timeSlots={timeSlots} onUpdate={handleTimetableSettingsUpdate}/>
                </div>
              )}
            </div>
        </div>
      </main>

       <MarkAbsentDialog
        isOpen={!!teacherToMarkAbsent}
        onOpenChange={(open) => !open && setTeacherToMarkAbsent(null)}
        teacher={teacherToMarkAbsent}
        onConfirm={handleMarkAbsent}
      />

       <RecommendationDialog
        isOpen={!!recommendation}
        onOpenChange={(open) => !open && setRecommendation(null)}
        recommendationResult={recommendation}
        onConfirm={() => {
            setRecommendation(null);
            setActiveTab('timetable');
        }}
      />

    </div>
  );
}
