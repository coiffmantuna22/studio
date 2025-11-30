'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/app/header';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where, doc, writeBatch, getDocs } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2, AlertTriangle, CheckCircle, UserX, School, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, isSameDay, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import type { Teacher, AbsenceDay, TimeSlot, AffectedLesson, SchoolClass, SubstitutionRecord, Lesson, Major } from '@/lib/types';
import MarkAbsentDialog from '@/components/app/mark-absent-dialog';
import RecommendationDialog from '@/components/app/recommendation-dialog';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { findSubstitute } from '@/lib/substitute-finder';
import { daysOfWeek } from '@/lib/constants';
import { groupBy } from 'lodash';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
const ClassTimetableDialog = dynamic(() => import('@/components/app/class-timetable-dialog'), {
    loading: () => null
});
const SchoolCalendar = dynamic(() => import('@/components/app/school-calendar'), {
  loading: () => <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});
const StatisticsTab = dynamic(() => import('@/components/app/statistics-tab'), {
  loading: () => <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});
const MajorsTab = dynamic(() => import('@/components/app/majors-tab'), {
  loading: () => <div className="p-4 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});


export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("teachers");
  const [teacherToMarkAbsent, setTeacherToMarkAbsent] = useState<{teacher: Teacher, existingAbsences?: AbsenceDay[]} | null>(null);
  const [classToView, setClassToView] = useState<SchoolClass | null>(null);
  const [recommendation, setRecommendation] = useState<{
    results: any[];
    absentTeacher: Teacher;
    absenceDays: any[];
  } | null>(null);
  
  const teachersQuery = useMemoFirebase(() => user ? query(collection(firestore, 'teachers'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: teachersData, isLoading: teachersLoading } = useCollection<Teacher>(teachersQuery);
  const teachers = teachersData || [];

  const classesQuery = useMemoFirebase(() => user ? query(collection(firestore, 'classes'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: classesData, isLoading: classesLoading } = useCollection<SchoolClass>(classesQuery);
  const allClasses = classesData || [];

  const substitutionsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'substitutions'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: substitutionsData, isLoading: substitutionsLoading } = useCollection<SubstitutionRecord>(substitutionsQuery);
  const allSubstitutions = substitutionsData || [];

  const settingsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'settings'), where('userId', '==', user.uid)) : null, [user, firestore]);
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

  const parseTimeToNumber = (time: string) => {
    if (!time || typeof time !== 'string' || !time.includes(':')) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
  };

  const todaysAbsences = useMemo(() => {
    const today = startOfDay(new Date());
    if (!teachers || teachers.length === 0) return [];
  
    return teachers
      .map(teacher => {
        const todaysTeacherAbsences = (teacher.absences || []).filter(absence => {
          try {
            const absenceDate = typeof absence.date === 'string' ? new Date(absence.date) : absence.date;
            return isSameDay(startOfDay(absenceDate), today);
          } catch (e) {
            console.error("Error parsing absence date:", absence.date);
            return false;
          }
        });
  
        if (todaysTeacherAbsences.length === 0) return null;
  
        const dayOfWeek = daysOfWeek[today.getDay()];
        const teacherScheduleForToday = teacher.schedule?.[dayOfWeek] || {};
        
        const affectedLessons: any[] = Object.entries(teacherScheduleForToday)
          .flatMap(([time, lessonsData]) => {
            const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
            if (!lessons || lessons.length === 0) return [];
            
            return lessons.map(lesson => {
                if (lesson && lesson.classId) {
                  const isAbsentDuringLesson = todaysTeacherAbsences.some(absence => {
                    if (absence.isAllDay) return true;
                    const lessonStart = parseTimeToNumber(time);
                    const absenceStart = parseTimeToNumber(absence.startTime);
                    const absenceEnd = parseTimeToNumber(absence.endTime);
                    return lessonStart >= absenceStart && lessonStart < absenceEnd;
                  });
      
                  if (isAbsentDuringLesson) {
                    const schoolClass = allClasses.find(c => c.id === lesson.classId);
                    if (schoolClass) {
                      const isCovered = (allSubstitutions || []).some(sub => 
                        isSameDay(startOfDay(new Date(sub.date)), today) &&
                        sub.time === time &&
                        sub.classId === lesson.classId
                      );
                      return { ...lesson, time, className: schoolClass.name, isCovered, absentTeacherName: teacher.name };
                    }
                  }
                }
                return null;
            }).filter(Boolean);
          });
  
        return { teacher, absences: todaysTeacherAbsences, affectedLessons };
      })
      .filter(item => item !== null && item.absences.length > 0) as { teacher: Teacher, absences: AbsenceDay[], affectedLessons: any[] }[];
  }, [teachers, allClasses, allSubstitutions]);


  const affectedClasses = useMemo(() => {
    const today = startOfDay(new Date());
    const affected = new Map<string, { classId: string; className: string; lessons: any[] }>();

    todaysAbsences.forEach(({ teacher, absences }) => {
        const dayOfWeek = daysOfWeek[today.getDay()];
        const teacherSchedule = teacher.schedule?.[dayOfWeek] || {};

        Object.entries(teacherSchedule).forEach(([time, lessonsData]) => {
            const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
            if (!lessons || lessons.length === 0) return;

            lessons.forEach((lesson: Lesson) => {
                if (!lesson || !lesson.classId) return;

                const isAbsentDuringLesson = absences.some(absence => {
                    if (absence.isAllDay) return true;
                    const lessonStart = parseTimeToNumber(time);
                    const absenceStart = parseTimeToNumber(absence.startTime);
                    const absenceEnd = parseTimeToNumber(absence.endTime);
                    return lessonStart >= absenceStart && lessonStart < absenceEnd;
                });
                
                if (isAbsentDuringLesson) {
                     const schoolClass = (allClasses || []).find(c => c.id === lesson.classId);
                     if (schoolClass) {
                        if (!affected.has(schoolClass.id)) {
                            affected.set(schoolClass.id, {
                                classId: schoolClass.id,
                                className: schoolClass.name,
                                lessons: [],
                            });
                        }
                        affected.get(schoolClass.id)!.lessons.push({
                            ...lesson,
                            time,
                            absentTeacherName: teacher.name,
                        });
                     }
                }
            });
        });
    });

    return Array.from(affected.values()).map(classData => {
        const uncoveredLessons = classData.lessons.filter(lesson => 
            !(allSubstitutions || []).some(sub => 
                isSameDay(startOfDay(new Date(sub.date)), today) &&
                sub.time === lesson.time &&
                sub.classId === lesson.classId
            )
        );
        return {
            ...classData,
            isFullyCovered: uncoveredLessons.length === 0,
            lessons: uncoveredLessons,
        };
    });
}, [todaysAbsences, allClasses, allSubstitutions]);


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

  const handleStartNewYear = async () => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);

    try {
      const teacherQuery = query(collection(firestore, 'teachers'), where('userId', '==', user.uid));
      const classQuery = query(collection(firestore, 'classes'), where('userId', '==', user.uid));
      const subsQuery = query(collection(firestore, 'substitutions'), where('userId', '==', user.uid));
      const majorsQuery = query(collection(firestore, 'majors'), where('userId', '==', user.uid));

      const [teacherSnapshot, classSnapshot, subsSnapshot, majorsSnapshot] = await Promise.all([
        getDocs(teacherQuery),
        getDocs(classQuery),
        getDocs(subsQuery),
        getDocs(majorsQuery)
      ]);

      // Reset schedules and absences for all teachers
      teacherSnapshot.forEach(teacherDoc => {
        batch.update(teacherDoc.ref, { schedule: {}, absences: [] });
      });

      // Reset schedules for all classes
      classSnapshot.forEach(classDoc => {
        batch.update(classDoc.ref, { schedule: {} });
      });

      // Delete all substitution records
      subsSnapshot.forEach(subDoc => {
        batch.delete(subDoc.ref);
      });
        
      // Delete all major records
      majorsSnapshot.forEach(majorDoc => {
        batch.delete(majorDoc.ref);
      });

      await commitBatchWithContext(batch, {
        operation: 'delete',
        path: `user_data/${user.uid}/new_year_reset`,
      });
      
      toast({
        title: 'השנה החדשה החלה!',
        description: 'כל מערכות השעות, ההיעדרויות וההחלפות אופסו.',
      });

    } catch (e) {
      console.error("Failed to start new year:", e);
      toast({
        variant: "destructive",
        title: 'שגיאה',
        description: 'לא ניתן היה לאפס את נתוני השנה. אנא נסה שוב.',
      });
    }
  };

  const getAffectedLessons = (
    absentTeacher: Teacher,
    absenceDays: AbsenceDay[],
    allClasses: SchoolClass[],
    allTeachers: Teacher[],
    timeSlots: TimeSlot[]
  ): Promise<AffectedLesson[]> => {
      const affected: AffectedLesson[] = [];
      const promises: Promise<any>[] = [];
      const substitutePool = allTeachers.filter(t => t.id !== absentTeacher.id);
  
      absenceDays.forEach(absence => {
          const date = startOfDay(new Date(absence.date));
          const dayOfWeek = format(date, 'EEEE', { locale: he });
  
          allClasses.forEach(schoolClass => {
              const daySchedule = schoolClass.schedule?.[dayOfWeek];
              if (daySchedule) {
                  Object.entries(daySchedule).forEach(([time, lessonsData]) => {
                      const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
                      lessons.forEach((lesson: Lesson) => {
                          if (lesson?.teacherId === absentTeacher.id) {
                              const lessonStart = parseTimeToNumber(time);
                              const lessonSlot = timeSlots.find(ts => ts.start === time);
                              if (!lessonSlot) return;
    
                              const lessonEnd = parseTimeToNumber(lessonSlot.end);
      
                              const isAffected = absence.isAllDay || 
                                  (
                                      lessonEnd > parseTimeToNumber(absence.startTime) && 
                                      lessonStart < parseTimeToNumber(absence.endTime)
                                  );
      
                              if (isAffected) {
                                  const promise = findSubstitute(
                                      { subject: lesson.subject, date, time },
                                      substitutePool,
                                      allClasses,
                                      timeSlots
                                  ).then(subResult => {
                                    affected.push({
                                          classId: schoolClass.id,
                                          className: schoolClass.name,
                                          date,
                                          time,
                                          lesson,
                                          recommendation: subResult.recommendation,
                                          recommendationId: subResult.recommendationId,
                                          reasoning: subResult.reasoning,
                                          substituteOptions: subResult.substituteOptions,
                                      });
                                  });
                                  promises.push(promise);
                              }
                          }
                      });
                  });
              }
          });
      });
  
      return Promise.all(promises).then(() => affected);
  }

  const handleMarkAbsent = async (absentTeacher: Teacher, absenceDays: AbsenceDay[]) => {
    if (!firestore || !user) return;

    const batch = writeBatch(firestore);
    const teacherRef = doc(firestore, 'teachers', absentTeacher.id);
    
    // Get the dates of the new/edited absences
    const newAbsenceDates = new Set(
        absenceDays.map(d => startOfDay(new Date(d.date)).getTime())
    );

    // Filter out any existing absences on the days we are editing.
    const updatedAbsences = (absentTeacher.absences || []).filter(
      (existing) => {
         let existingDate;
         try {
            existingDate = typeof existing.date === 'string' ? new Date(existing.date) : existing.date;
            if (isNaN(existingDate.getTime())) return true; // Keep malformed data to avoid losing it
         } catch (e) {
            return true; // Keep if date is unparsable
         }
         
         // If the existing absence is NOT on one of the dates we are editing, keep it.
         return !newAbsenceDates.has(startOfDay(existingDate).getTime());
      }
    );

    const newAbsenceData = absenceDays.map(d => ({
      ...d,
      date: startOfDay(new Date(d.date)).toISOString(),
    }));

    batch.update(teacherRef, { absences: [...updatedAbsences, ...newAbsenceData] });

    await commitBatchWithContext(batch, {
        operation: 'update',
        path: teacherRef.path,
        data: { absences: '...' } // Don't log full absence array
    });

     const schoolClasses = allClasses || [];

    const affected = await getAffectedLessons(absentTeacher, newAbsenceData, schoolClasses, teachers || [], timeSlots);
    if(affected.length > 0) {
       setRecommendation({
         results: affected,
         absentTeacher,
         absenceDays: newAbsenceData
       })
    } else {
        setRecommendation(null);
    }
  };


  const isLoading = isUserLoading || teachersLoading || settingsLoading || classesLoading || substitutionsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  const isInitialSetup = !isUserLoading && !settingsLoading && user && timeSlots.length === 0;

  if (isInitialSetup) {
      return (
         <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 p-4 sm:p-6 md:p-8">
               <SettingsTab
                  timeSlots={[]}
                  onUpdate={handleTimetableSettingsUpdate}
                  isInitialSetup={isInitialSetup}
                  onStartNewYear={handleStartNewYear}
               />
            </main>
         </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
        <div className="space-y-6">
          {todaysAbsences && todaysAbsences.length > 0 && (
            <Card className="border-l-4 border-l-destructive shadow-md">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xl flex items-center gap-2">
                    <AlertTriangle className="text-destructive h-5 w-5" />
                    מורים חסרים היום
                    </CardTitle>
                    <CardDescription>סקירה מהירה של ההיעדרויות והשיעורים המושפעים להיום.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    {todaysAbsences.map((item) => {
                        if (!item) return null;
                        const { teacher, absences, affectedLessons } = item;
                        const absenceTime = absences.map(a => a.isAllDay ? `יום שלם` : `${a.startTime}-${a.endTime}`).join('; ');
                        
                        return (
                            <div key={teacher.id} className="flex flex-col justify-between p-4 bg-secondary/30 rounded-xl border">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <span className="font-semibold text-lg block">{teacher.name}</span>
                                        <div className="text-xs text-center text-destructive-foreground bg-destructive/80 rounded-md px-2 py-1 font-medium inline-block mt-1">
                                        {absenceTime}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 -mr-2"
                                        onClick={() => setTeacherToMarkAbsent({ teacher, existingAbsences: absences })}
                                    >
                                        <Edit className="h-4 w-4 text-muted-foreground" />
                                        <span className="mr-1">ערוך</span>
                                    </Button>
                                </div>
                                {affectedLessons.length > 0 && (
                                    <div className="mt-3 space-y-2 text-sm">
                                    <h4 className="font-medium text-muted-foreground">שיעורים מושפעים:</h4>
                                    <ul className="space-y-1">
                                        {affectedLessons.map((lesson, index) => (
                                        <li key={index} className="flex items-center justify-between">
                                            <span>{lesson.className} - {lesson.subject} ({lesson.time})</span>
                                            {lesson.isCovered ? (
                                            <span className="flex items-center text-green-600 dark:text-green-400">
                                                <CheckCircle className="ml-1 h-4 w-4" />
                                                מכוסה
                                            </span>
                                            ) : (
                                            <span className="flex items-center text-destructive">
                                                <UserX className="ml-1 h-4 w-4" />
                                                דרוש מחליף
                                            </span>
                                            )}
                                        </li>
                                        ))}
                                    </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                </CardContent>
            </Card>
          )}

          {affectedClasses.length > 0 && (
            <Card className="border-l-4 border-l-amber-500 shadow-md">
              <CardHeader className="pb-3">
                  <CardTitle className="text-xl flex items-center gap-2">
                  <School className="text-amber-500 h-5 w-5" />
                  כיתות דורשות שיבוץ
                  </CardTitle>
                  <CardDescription>כיתות עם שיעורים לא מכוסים להיום. לחץ על כיתה לצפייה במערכת.</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                  {affectedClasses.map(({ classId, className, lessons, isFullyCovered }) => {
                      const schoolClass = (allClasses || []).find(c => c.id === classId);
                      return (
                      <div 
                          key={classId} 
                          className={cn(
                            "flex flex-col justify-between p-4 rounded-xl border-2 transition-colors hover:bg-secondary/50 cursor-pointer",
                            isFullyCovered 
                              ? "border-green-500/50 bg-green-500/5"
                              : "border-destructive/50 bg-destructive/5"
                          )}
                          onClick={() => schoolClass && setClassToView(schoolClass)}
                      >
                          <span className="font-semibold text-lg block">{className}</span>
                          {isFullyCovered ? (
                              <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                                  <CheckCircle className="h-5 w-5"/>
                                  <span className="font-medium">כל השיעורים מכוסים</span>
                              </div>
                          ) : (
                              <div className="mt-3 space-y-2 text-sm">
                              <h4 className="font-medium text-muted-foreground">שיעורים לא מכוסים:</h4>
                              <ul className="space-y-1">
                                  {lessons.map((lesson, index) => (
                                  <li key={index} className="flex items-center justify-between">
                                      <span>{lesson.subject} ({lesson.time})</span>
                                      <span className="text-xs text-muted-foreground">
                                      עם {lesson.absentTeacherName}
                                      </span>
                                  </li>
                                  ))}
                              </ul>
                              </div>
                          )}
                      </div>
                      )
                  })}
                  </div>
              </CardContent>
            </Card>
          )}
        </div>


        <div className="space-y-6">
              <div className="w-full">
              <div className="grid w-full grid-cols-2 sm:grid-cols-6 max-w-4xl mx-auto h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-full mb-8 overflow-x-auto">
                <Button variant="ghost" onClick={() => setActiveTab("teachers")} className={`rounded-full py-2.5 transition-all ${activeTab === "teachers" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>פרופילי מורים</Button>
                <Button variant="ghost" onClick={() => setActiveTab("classes")} className={`rounded-full py-2.5 transition-all ${activeTab === "classes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>כיתות לימוד</Button>
                <Button variant="ghost" onClick={() => setActiveTab("timetable")} className={`rounded-full py-2.5 transition-all ${activeTab === "timetable" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>זמינות מחליפים</Button>
                <Button variant="ghost" onClick={() => setActiveTab("calendar")} className={`rounded-full py-2.5 transition-all ${activeTab === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>לוח שנה</Button>
                <Button variant="ghost" onClick={() => setActiveTab("statistics")} className={`rounded-full py-2.5 transition-all ${activeTab === "statistics" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>סטטיסטיקות</Button>
                <Button variant="ghost" onClick={() => setActiveTab("settings")} className={`rounded-full py-2.5 transition-all ${activeTab === "settings" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`}>הגדרות</Button>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "teachers" && (
                  <motion.div
                    key="teachers"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-0"
                  >
                    <TeacherList
                      onMarkAbsent={(teacher) => setTeacherToMarkAbsent({teacher})}
                    />
                  </motion.div>
                )}

                {activeTab === "classes" && (
                  <motion.div
                    key="classes"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-0"
                  >
                    <ClassList />
                  </motion.div>
                )}

                {activeTab === "timetable" && (
                  <motion.div
                    key="timetable"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-0"
                  >
                    <Timetable substitutions={allSubstitutions} />
                  </motion.div>
                )}

                {activeTab === "calendar" && (
                  <motion.div
                    key="calendar"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-0"
                  >
                    <SchoolCalendar />
                  </motion.div>
                )}

                {activeTab === "settings" && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-0"
                  >
                    <SettingsTab 
                        timeSlots={timeSlots} 
                        onUpdate={handleTimetableSettingsUpdate} 
                        onStartNewYear={handleStartNewYear}
                    />
                  </motion.div>
                )}

                {activeTab === "statistics" && (
                  <motion.div
                    key="statistics"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="mt-0"
                  >
                    <StatisticsTab substitutions={allSubstitutions} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        </div>
      </main>

       <MarkAbsentDialog
        isOpen={!!teacherToMarkAbsent}
        onOpenChange={(open) => !open && setTeacherToMarkAbsent(null)}
        teacher={teacherToMarkAbsent?.teacher ?? null}
        existingAbsences={teacherToMarkAbsent?.existingAbsences}
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

      <ClassTimetableDialog
        isOpen={!!classToView}
        onOpenChange={(isOpen) => !isOpen && setClassToView(null)}
        schoolClass={classToView}
        allTeachers={teachers || []}
        isEditing={false}
        allClasses={allClasses || []}
        timeSlots={timeSlots}
      />

    </div>
  );
}

    

    