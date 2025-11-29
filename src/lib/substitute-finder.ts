
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
}

const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const parseTimeToNumber = (time: string) => {
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
    const todaysAbsence = teacher.absences?.find(absence => isSameDay(new Date(absence.date), today));
    if (todaysAbsence) {
        if (todaysAbsence.isAllDay) return 'absent';
        const absenceStart = parseTimeToNumber(todaysAbsence.startTime);
        const absenceEnd = parseTimeToNumber(todaysAbsence.endTime);
        const slotStart = parseTimeToNumber(currentSlot.start);
        if (slotStart >= absenceStart && slotStart < absenceEnd) {
            return 'absent';
        }
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
    if (teacher.schedule?.[dayOfWeek]?.[currentSlot.start]) {
        return 'teaching';
    }

    // If present, not absent, and not teaching, they are available.
    return 'available';
}

export function isTeacherAvailable(teacher: Teacher, date: Date, time: string, timeSlots: TimeSlot[]): boolean {
  const lessonSlot = timeSlots.find(s => s.start === time);
  if (!lessonSlot) return false;

  const status = getTeacherAvailabilityStatus(teacher, date, timeSlots);

  // For substitution purposes, we only care if they are 'available' at the specific lesson time
  // which means we need to check their schedule for that *specific* slot, not just the current time.
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
  
  const isTeaching = teacher.schedule?.[dayOfWeek]?.[time];
  if (isTeaching) return false;

  const todaysAbsence = teacher.absences?.find(absence => isSameDay(new Date(absence.date), startOfDay(date)));
   if (todaysAbsence) {
        if (todaysAbsence.isAllDay) return false;
        const absenceStart = parseTimeToNumber(todaysAbsence.startTime);
        const absenceEnd = parseTimeToNumber(todaysAbsence.endTime);
        if (lessonStartNum >= absenceStart && lessonStartNum < absenceEnd) {
            return false;
        }
    }

  return true;
}

export function isTeacherAlreadyScheduled(teacherId: string, date: Date, time: string, allClasses: SchoolClass[], ignoreClassId?: string): boolean {
    const dayOfWeek = dayMap[getDay(date)];
    
    return allClasses.some(schoolClass => {
        if (schoolClass.id === ignoreClassId) return false;
        const lesson = schoolClass.schedule[dayOfWeek]?.[time];
        return lesson?.teacherId === teacherId;
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
          reasoning: 'לא נמצאו מורים פנויים (נוכחים בבית הספר אך ללא שיעור) בשעה זו.',
      };
  }
  
  let qualifiedTeachers = availableTeachers.filter(t => t.subjects.includes(lessonDetails.subject));

  if (qualifiedTeachers.length === 0) {
     const bestOfWorst = availableTeachers[0]; // Just take the first available
      return {
        recommendation: bestOfWorst.name,
        recommendationId: bestOfWorst.id,
        reasoning: `שימו לב: לא נמצא מורה פנוי המוכשר ב${lessonDetails.subject}. ${bestOfWorst.name} מוצע/ת כמפקח/ת בלבד מאחר והוא/היא זמין/ה.`,
    };
  }
  
  const scoredTeachers = qualifiedTeachers.map(teacher => ({
    teacher,
    score: scoreTeacher(teacher, lessonDetails),
  })).sort((a, b) => b.score - a.score);

  const bestChoice = scoredTeachers[0].teacher;
  
  let reasoning = `${bestChoice.name} פנוי/ה ומוכשר/ת ב${lessonDetails.subject}.`;
  if (bestChoice.preferences) {
      reasoning += ` העדפות: ${bestChoice.preferences}.`
  }

  return {
    recommendation: bestChoice.name,
    recommendationId: bestChoice.id,
    reasoning: reasoning,
  };
}
