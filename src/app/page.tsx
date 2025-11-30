
'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/app/header';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { collection, query, where, doc, writeBatch, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Loader2, AlertTriangle, CheckCircle, UserX, School, Edit, BookUser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format, isSameDay, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import type { Teacher, AbsenceDay, TimeSlot, AffectedLesson, SchoolClass, SubstitutionRecord, Lesson } from '@/lib/types';
import MarkAbsentDialog from '@/components/app/mark-absent-dialog';
import RecommendationDialog from '@/components/app/recommendation-dialog';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { findSubstitute } from '@/lib/substitute-finder';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAbsences } from '@/hooks/use-absences';

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
const NeededSubstitutePanel = dynamic(() => import('@/components/app/needed-substitutes-panel'), {
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

  const todaysAffectedLessons = useAbsences({
    teachers: teachers,
    classes: allClasses,
    substitutions: allSubstitutions,
    timeSlots: timeSlots,
  });

  const todaysAbsences = useMemo(() => {
    const absenceMap = new Map<string, { teacher: Teacher; absences: AbsenceDay[]; }>();

    (teachers || []).forEach(teacher => {
        const today = startOfDay(new Date());
        const teacherAbsencesToday = (teacher.absences || []).filter(absence => {
            try {
                return isSameDay(startOfDay(new Date(absence.date)), today);
            } catch (e) { return false; }
        });

        if (teacherAbsencesToday.length > 0) {
            if (!absenceMap.has(teacher.id)) {
                absenceMap.set(teacher.id, {
                    teacher: teacher,
                    absences: teacherAbsencesToday,
                });
            }
        }
    });

    return Array.from(absenceMap.values());
  }, [teachers, todaysAffectedLessons]);
  
  const affectedClasses = useMemo(() => {
    const affected = new Map<string, { classId: string; className: string; lessons: any[] }>();
    const uncoveredLessons = todaysAffectedLessons.filter(l => !l.isCovered && isSameDay(l.date, new Date()));

    uncoveredLessons.forEach(lesson => {
      if (!affected.has(lesson.classId)) {
        affected.set(lesson.classId, {
          classId: lesson.classId,
          className: lesson.className,
          lessons: [],
        });
      }
      affected.get(lesson.classId)!.lessons.push(lesson);
    });

    const fullyCoveredClasses = new Set<string>();
    todaysAffectedLessons.forEach(lesson => {
        if(lesson.isCovered && isSameDay(lesson.date, new Date()) && !uncoveredLessons.some(ul => ul.classId === lesson.classId)) {
            fullyCoveredClasses.add(lesson.classId);
        }
    });

    const result = Array.from(affected.values()).map(classData => ({
        ...classData,
        isFullyCovered: false,
    }));
    
    fullyCoveredClasses.forEach(classId => {
        const classInfo = allClasses.find(c => c.id === classId);
        if(classInfo && !affected.has(classId)) {
            result.push({
                classId: classId,
                className: classInfo.name,
                lessons: [],
                isFullyCovered: true
            })
        }
    })

    return result;
  }, [todaysAffectedLessons, allClasses]);

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
      // Get all teachers and classes belonging to the user
      const teacherQuery = query(collection(firestore, 'teachers'), where('userId', '==', user.uid));
      const classQuery = query(collection(firestore, 'classes'), where('userId', '==', user.uid));
      const subsQuery = query(collection(firestore, 'substitutions'), where('userId', '==', user.uid));
      
      const [teacherSnapshot, classSnapshot, subsSnapshot] = await Promise.all([
        getDocs(teacherQuery),
        getDocs(classQuery),
        getDocs(subsQuery),
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
      
      const parseTimeToNumber = (time: string) => {
        if (!time || typeof time !== 'string' || !time.includes(':')) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours + minutes / 60;
      };
  
      absenceDays.forEach(absence => {
          const date = startOfDay(new Date(absence.date));
          const dayOfWeek = format(date, 'EEEE', { locale: he });
          
          const daySchedule = absentTeacher.schedule?.[dayOfWeek];
          if(daySchedule){
            Object.entries(daySchedule).forEach(([time, lessonsData]) => {
              const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
              lessons.forEach((lesson: Lesson) => {
                  const lessonSlot = timeSlots.find(ts => ts.start === time);
                  if (!lessonSlot) return;

                  const lessonStart = parseTimeToNumber(lessonSlot.start);
                  const lessonEnd = parseTimeToNumber(lessonSlot.end);
                  const absenceStart = parseTimeToNumber(absence.startTime);
                  const absenceEnd = parseTimeToNumber(absence.endTime);
                  
                  const isAffected = absence.isAllDay || (lessonStart < absenceEnd && lessonEnd > absenceStart);
                  
                  const schoolClass = allClasses.find(c => c.id === lesson.classId);
                  if(isAffected && schoolClass) {
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
                            absentTeacherName: absentTeacher.name,
                            recommendation: subResult.recommendation,
                            recommendationId: subResult.recommendationId,
                            reasoning: subResult.reasoning,
                            substituteOptions: subResult.substituteOptions,
                        });
                    });
                    promises.push(promise);
                  }
              });
            });
          }
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

  const handleAssignSubstituteFromPanel = async (lesson: any) => {
      if (!lesson || !teachers || !timeSlots) return;
      
      const substitutePool = teachers.filter(t => t.id !== lesson.absentTeacherId);
      const date = startOfDay(new Date(lesson.date));
      const absentTeacher = teachers.find(t => t.id === lesson.absentTeacherId);

      if (!absentTeacher) {
          toast({
              variant: "destructive",
              title: "שגיאה",
              description: "לא ניתן למצוא את המורה החסר.",
          });
          return;
      }
      
      try {
          const subResult = await findSubstitute(
              { subject: lesson.subject, date, time: lesson.time },
              substitutePool,
              allClasses,
              timeSlots
          );

          setRecommendation({
              results: [{
                  classId: lesson.classId,
                  className: lesson.className,
                  date,
                  time: lesson.time,
                  lesson: { ...lesson, teacherId: lesson.absentTeacherId }, // Reconstruct minimal lesson object
                  absentTeacherName: absentTeacher.name,
                  recommendation: subResult.recommendation,
                  recommendationId: subResult.recommendationId,
                  reasoning: subResult.reasoning,
                  substituteOptions: subResult.substituteOptions,
              }],
              absentTeacher: absentTeacher,
              absenceDays: [{ date: date.toISOString(), startTime: "08:00", endTime: "16:00", isAllDay: true, reason: "Generated from panel" }] // Dummy absence day for context
          });

      } catch (error) {
          console.error("Error finding substitute:", error);
          toast({
              variant: "destructive",
              title: "שגיאה",
              description: "אירעה שגיאה בחיפוש מחליף.",
          });
      }
  };

  const handleAssignSubstitute = async (substituteTeacher: Teacher, lesson: AffectedLesson) => {
      if (!firestore || !user) return;
      
      const substitution: Omit<SubstitutionRecord, 'id' | 'createdAt'> = {
          date: format(new Date(lesson.date), 'yyyy-MM-dd'),
          time: lesson.time,
          classId: lesson.classId,
          className: lesson.className,
          absentTeacherId: lesson.lesson.teacherId,
          absentTeacherName: teachers.find(t => t.id === lesson.lesson.teacherId)?.name || 'לא ידוע',
          substituteTeacherId: substituteTeacher.id,
          substituteTeacherName: substituteTeacher.name,
          subject: lesson.lesson.subject,
          userId: user.uid,
      };

      const newSubRef = doc(collection(firestore, 'substitutions'));
      const batch = writeBatch(firestore);
      batch.set(newSubRef, {...substitution, id: newSubRef.id, createdAt: new Date().toISOString()});

      try {
          await commitBatchWithContext(batch, { operation: 'create', path: newSubRef.path, data: substitution });
          toast({
              title: 'השיבוץ הושלם',
              description: `${substituteTeacher.name} שובץ להחליף בשיעור ${lesson.lesson.subject} בכיתה ${lesson.className}.`,
          });
          setRecommendation(null); // Close the dialog on success
      } catch (error) {
          console.error("Error assigning substitute:", error);
          toast({
              variant: "destructive",
              title: "שגיאת שיבוץ",
              description: "לא ניתן היה לשבץ את המורה המחליף.",
          });
      }
  };
  
  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const isLoading = isUserLoading || teachersLoading || settingsLoading || classesLoading || substitutionsLoading;
  const isInitialSetup = !isLoading && user && timeSlots.length === 0;

  if (isLoading) {
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
                  onStartNewYear={handleStartNewYear}
               />
            </main>
         </div>
      );
  }

  return <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card className="border-l-4 border-l-destructive shadow-md h-full">
                <CardHeader className="pb-3">
                    <CardTitle className="text-xl flex items-center gap-2">
                    <AlertTriangle className="text-destructive h-5 w-5" />
                    מורים חסרים היום
                    </CardTitle>
                    <CardDescription>סקירה מהירה של ההיעדרויות להיום.</CardDescription>
                </CardHeader>
                <CardContent>
                {todaysAbsences && todaysAbsences.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-1">
                        {todaysAbsences.map((item) => {
                            if (!item) return null;
                            const { teacher, absences } = item;
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
                                </div>
                            );
                        })}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground bg-secondary/20 rounded-lg">
                        <BookUser className="w-10 h-10 mb-2 opacity-50"/>
                        <p className="font-medium">כל המורים נוכחים!</p>
                        <p className="text-xs">אין היעדרויות רשומות להיום.</p>
                    </div>
                )}
                </CardContent>
            </Card>

            <NeededSubstitutePanel 
                teachers={teachers}
                classes={allClasses}
                substitutions={allSubstitutions}
                timeSlots={timeSlots}
                onAssignSubstitute={handleAssignSubstituteFromPanel}
            />
        </div>


        <div className="space-y-6">
        <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 border-b sm:border-none">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar sm:grid sm:w-full sm:grid-cols-6 sm:max-w-4xl sm:mx-auto sm:h-auto sm:p-1 sm:bg-muted/50 sm:backdrop-blur-sm sm:rounded-full">
                <Button variant={activeTab === "teachers" ? "secondary" : "ghost"} onClick={() => setActiveTab("teachers")} className={`rounded-full whitespace-nowrap px-4 py-2 h-auto text-sm sm:text-base sm:py-2.5 transition-all ${activeTab === "teachers" ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>פרופילי מורים</Button>
                <Button variant={activeTab === "classes" ? "secondary" : "ghost"} onClick={() => setActiveTab("classes")} className={`rounded-full whitespace-nowrap px-4 py-2 h-auto text-sm sm:text-base sm:py-2.5 transition-all ${activeTab === "classes" ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>כיתות לימוד</Button>
                <Button variant={activeTab === "timetable" ? "secondary" : "ghost"} onClick={() => setActiveTab("timetable")} className={`rounded-full whitespace-nowrap px-4 py-2 h-auto text-sm sm:text-base sm:py-2.5 transition-all ${activeTab === "timetable" ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>זמינות מחליפים</Button>
                <Button variant={activeTab === "calendar" ? "secondary" : "ghost"} onClick={() => setActiveTab("calendar")} className={`rounded-full whitespace-nowrap px-4 py-2 h-auto text-sm sm:text-base sm:py-2.5 transition-all ${activeTab === "calendar" ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>לוח שנה</Button>
                <Button variant={activeTab === "statistics" ? "secondary" : "ghost"} onClick={() => setActiveTab("statistics")} className={`rounded-full whitespace-nowrap px-4 py-2 h-auto text-sm sm:text-base sm:py-2.5 transition-all ${activeTab === "statistics" ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>סטטיסטיקות</Button>
                <Button variant={activeTab === "settings" ? "secondary" : "ghost"} onClick={() => setActiveTab("settings")} className={`rounded-full whitespace-nowrap px-4 py-2 h-auto text-sm sm:text-base sm:py-2.5 transition-all ${activeTab === "settings" ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>הגדרות</Button>

              </div>
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

                {activeTab === "majors" && (
                    <motion.div
                        key="majors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mt-0"
                    >
                        <MajorsTab teachers={teachers} classes={allClasses} timeSlots={timeSlots} />
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
        onAssign={handleAssignSubstitute}
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
  ;
}

    

    

    