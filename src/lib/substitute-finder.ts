

import { getDay, isSameDay, startOfDay } from 'date-fns';
import type { Teacher, SchoolClass, TimeSlot, TeacherAvailabilityStatus } from './types';

interface LessonDetails {
  subject: string;
  date: Date;
  time: string;
}

interface FindSubstituteResult {
  recommendation: string | null;
  recommendationId: string | null;
  reasoning: string | null;
  substituteOptions: Teacher[];
}

const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const parseTimeToNumber = (time: string) => {
    if (!time || typeof time !== 'string' || !time.includes(':')) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
};

export function getTeacherAvailabilityStatus(teacher: Teacher, date: Date, timeSlots: TimeSlot[]): TeacherAvailabilityStatus {
    const dayOfWeek = dayMap[getDay(date)];
    const now = date;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentSlot = timeSlots.find(slot => currentTime >= slot.start && currentTime < slot.end);
    
    if (!currentSlot) return 'unknown';

    // 1. Is the teacher marked as absent today?
    const today = startOfDay(date);
    const todaysAbsences = (teacher.absences || []).filter(absence => isSameDay(startOfDay(new Date(absence.date)), today));
    if (todaysAbsences.length > 0) {
        const slotStart = parseTimeToNumber(currentSlot.start);
        const isAbsentNow = todaysAbsences.some(absence => {
            if (absence.isAllDay) return true;
            const absenceStart = parseTimeToNumber(absence.startTime);
            const absenceEnd = parseTimeToNumber(absence.endTime);
            return slotStart >= absenceStart && slotStart < absenceEnd;
        });
        if (isAbsentNow) return 'absent';
    }

    // 2. Is the teacher generally present at school during this slot?
    const availabilityForDay = teacher.availability.find(a => a.day === dayOfWeek);
    if (!availabilityForDay) {
        return 'not_in_school';
    }

    const slotStartNum = parseTimeToNumber(currentSlot.start);
    const isPresent = availabilityForDay.slots.some(presenceSlot => {
        const presenceStartNum = parseTimeToNumber(presenceSlot.start);
        const presenceEndNum = parseTimeToNumber(presenceSlot.end);
        return slotStartNum >= presenceStartNum && slotStartNum < presenceEndNum;
    });

    if (!isPresent) {
        return 'not_in_school';
    }
    
    // 3. Is the teacher teaching a scheduled lesson now?
    const lessonsData = teacher.schedule?.[dayOfWeek]?.[currentSlot.start];
    const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
    if (lessons && lessons.length > 0) {
        return 'teaching';
    }

    // If present, not absent, and not teaching, they are available.
    return 'available';
}

export function isTeacherAvailable(teacher: Teacher, date: Date, time: string, timeSlots: TimeSlot[]): boolean {
  const lessonSlot = timeSlots.find(s => s.start === time);
  if (!lessonSlot) return false;

  const dayOfWeek = dayMap[getDay(date)];
  const availabilityForDay = teacher.availability.find(a => a.day === dayOfWeek);
  if (!availabilityForDay) return false;

  const lessonStartNum = parseTimeToNumber(lessonSlot.start);

  const isPresent = availabilityForDay.slots.some(slot => {
    const startNum = parseTimeToNumber(slot.start);
    const endNum = parseTimeToNumber(slot.end);
    return lessonStartNum >= startNum && lessonStartNum < endNum;
  });

  if (!isPresent) return false;
  
  const lessonsData = teacher.schedule?.[dayOfWeek]?.[time];
  const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
  if (lessons && lessons.length > 0) return false;

  const todaysAbsences = (teacher.absences || []).filter(absence => isSameDay(startOfDay(new Date(absence.date)), startOfDay(date)));
   if (todaysAbsences.length > 0) {
        const isAbsentNow = todaysAbsences.some(absence => {
            if (absence.isAllDay) return true;
            const absenceStart = parseTimeToNumber(absence.startTime);
            const absenceEnd = parseTimeToNumber(absence.endTime);
            return lessonStartNum >= absenceStart && lessonStartNum < absenceEnd;
        });
        if (isAbsentNow) return false;
    }

  return true;
}

export function isTeacherAlreadyScheduled(teacherId: string, date: Date, time: string, allClasses: SchoolClass[], ignoreClassId?: string): boolean {
    const dayOfWeek = dayMap[getDay(date)];
    
    return allClasses.some(schoolClass => {
        if (schoolClass.id === ignoreClassId) return false;
        const lessonsData = schoolClass.schedule[dayOfWeek]?.[time];
        const lessons = Array.isArray(lessonsData) ? lessonsData : (lessonsData ? [lessonsData] : []);
        return lessons && lessons.some(lesson => lesson.teacherId === teacherId);
    });
}

const scoreTeacher = (teacher: Teacher, lessonDetails: LessonDetails): number => {
    let score = 0;
    if (teacher.subjects.includes(lessonDetails.subject)) {
        score += 10;
    }

    if (teacher.preferences?.includes('כיתות בוגרות')) {
        score += 2;
    }
    if (teacher.preferences?.includes('חינוך מיוחד') && lessonDetails.subject === 'חינוך מיוחד') {
        score += 5;
    }

    return score;
}

export async function findSubstitute(
  lessonDetails: LessonDetails,
  substitutePool: Teacher[],
  allClasses: SchoolClass[],
  timeSlots: TimeSlot[],
): Promise<FindSubstituteResult> {
  
  const availableTeachers = substitutePool.filter(t => 
      isTeacherAvailable(t, lessonDetails.date, lessonDetails.time, timeSlots) &&
      !isTeacherAlreadyScheduled(t.id, lessonDetails.date, lessonDetails.time, allClasses)
  );

  if(availableTeachers.length === 0) {
      return {
          recommendation: null,
          recommendationId: null,
          reasoning: 'לא נמצאו מורים פנויים.',
          substituteOptions: [],
      };
  }
  
  let qualifiedTeachers = availableTeachers.filter(t => t.subjects.includes(lessonDetails.subject));
  let substituteOptions: Teacher[] = [];
  let bestChoice: Teacher | null = null;
  let reasoning: string | null = null;

  if (qualifiedTeachers.length > 0) {
      const scoredTeachers = qualifiedTeachers.map(teacher => ({
        teacher,
        score: scoreTeacher(teacher, lessonDetails),
      })).sort((a, b) => b.score - a.score);
      
      bestChoice = scoredTeachers[0].teacher;
      reasoning = `${bestChoice.name} מומלץ/ת כי הוא/היא פנוי/ה ומוכשר/ת ב${lessonDetails.subject}.`;
      if (bestChoice.preferences) {
          reasoning += ` העדפות: ${bestChoice.preferences}.`
      }
      substituteOptions = qualifiedTeachers;

  } else { // No qualified teachers, suggest any available teacher
     bestChoice = availableTeachers[0];
     reasoning = `שימו לב: לא נמצא מורה פנוי המוכשר ב${lessonDetails.subject}. ${bestChoice.name} מוצע/ת כמפקח/ת בלבד.`;
     substituteOptions = availableTeachers;
  }

  return {
    recommendation: bestChoice?.name || null,
    recommendationId: bestChoice?.id || null,
    reasoning: reasoning,
    substituteOptions: substituteOptions,
  };
}
