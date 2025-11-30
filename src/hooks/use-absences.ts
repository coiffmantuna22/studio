import { useMemo } from 'react';
import { startOfDay, isSameDay, addDays, isWithinInterval, parseISO } from 'date-fns';
import { daysOfWeek } from '@/lib/constants';
import { Teacher, SchoolClass, SubstitutionRecord, TimeSlot, Lesson } from '@/lib/types';

interface UseAbsencesProps {
  teachers: Teacher[];
  classes: SchoolClass[];
  substitutions: SubstitutionRecord[];
  timeSlots: TimeSlot[];
  dateRange?: { start: Date; end: Date }; // Optional range, defaults to today if not provided
}

export function useAbsences({ teachers, classes, substitutions, timeSlots, dateRange }: UseAbsencesProps) {
  return useMemo(() => {
    const start = dateRange ? startOfDay(dateRange.start) : startOfDay(new Date());
    const end = dateRange ? startOfDay(dateRange.end) : start;
    
    // Helper to parse time string "HH:MM" to number
    const parseTimeToNumber = (time: string) => {
      if (!time || typeof time !== 'string' || !time.includes(':')) return 0;
      const [hours, minutes] = time.split(':').map(Number);
      return hours + minutes / 60;
    };

    const affectedLessons: any[] = [];

    // Iterate through each day in the range
    let currentDay = start;
    while (currentDay <= end) {
        const dayOfWeek = daysOfWeek[currentDay.getDay()];
        
        teachers.forEach(teacher => {
            const teacherAbsences = (teacher.absences || []).filter(absence => {
                try {
                    const absenceDate = typeof absence.date === 'string' ? new Date(absence.date) : absence.date;
                    return isSameDay(startOfDay(absenceDate), currentDay);
                } catch (e) {
                    return false;
                }
            });

            if (teacherAbsences.length === 0) return;

            const teacherSchedule = teacher.schedule?.[dayOfWeek] || {};

            Object.entries(teacherSchedule).forEach(([time, lessonsData]) => {
                const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
                if (!lessons || lessons.length === 0) return;

                lessons.forEach((lesson: Lesson) => {
                    if (!lesson || !lesson.classId) return;

                    const lessonSlot = timeSlots.find(ts => ts.start === time);
                    if (!lessonSlot) return;

                    const isAbsentDuringLesson = teacherAbsences.some(absence => {
                        if (absence.isAllDay) return true;
                        const lessonStart = parseTimeToNumber(lessonSlot.start);
                        const lessonEnd = parseTimeToNumber(lessonSlot.end);
                        const absenceStart = parseTimeToNumber(absence.startTime);
                        const absenceEnd = parseTimeToNumber(absence.endTime);
                        return lessonStart < absenceEnd && lessonEnd > absenceStart;
                    });

                    if (isAbsentDuringLesson) {
                        const schoolClass = classes.find(c => c.id === lesson.classId);
                        if (schoolClass) {
                             const substitution = (substitutions || []).find(sub => 
                                isSameDay(startOfDay(new Date(sub.date)), currentDay) &&
                                sub.time === time &&
                                sub.classId === lesson.classId
                              );

                              let isCovered = !!substitution;

                              // If covered, check if the substitute teacher is also absent
                              if (isCovered && substitution?.substituteTeacherId) {
                                  const substituteTeacher = teachers.find(t => t.id === substitution.substituteTeacherId);
                                  if (substituteTeacher) {
                                      const substituteAbsences = (substituteTeacher.absences || []).filter(absence => {
                                          try {
                                              const absenceDate = typeof absence.date === 'string' ? new Date(absence.date) : absence.date;
                                              return isSameDay(startOfDay(absenceDate), currentDay);
                                          } catch (e) {
                                              return false;
                                          }
                                      });

                                      const isSubstituteAbsent = substituteAbsences.some(absence => {
                                          if (absence.isAllDay) return true;
                                          const lessonStart = parseTimeToNumber(lessonSlot.start);
                                          const lessonEnd = parseTimeToNumber(lessonSlot.end);
                                          const absenceStart = parseTimeToNumber(absence.startTime);
                                          const absenceEnd = parseTimeToNumber(absence.endTime);
                                          return lessonStart < absenceEnd && lessonEnd > absenceStart;
                                      });

                                      if (isSubstituteAbsent) {
                                          isCovered = false;
                                      }
                                  }
                              }

                              affectedLessons.push({
                                  ...lesson,
                                  date: currentDay,
                                  time,
                                  className: schoolClass.name,
                                  classId: schoolClass.id,
                                  absentTeacherName: teacher.name,
                                  absentTeacherId: teacher.id,
                                  isCovered
                              });
                        }
                    }
                });
            });
        });
        
        currentDay = addDays(currentDay, 1);
    }

    return affectedLessons;

  }, [teachers, classes, substitutions, timeSlots, dateRange]);
}
