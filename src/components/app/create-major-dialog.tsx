import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Teacher, SchoolClass, Major, TimeSlot, ClassSchedule, Lesson } from '@/lib/types';
import { daysOfWeek } from '@/lib/constants';

interface CreateMajorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: Teacher[];
  classes: SchoolClass[];
  timeSlots: TimeSlot[];
  majorToEdit?: Major | null;
  onSuccess?: () => void;
}

export default function CreateMajorDialog({ 
  isOpen, 
  onOpenChange, 
  teachers, 
  classes, 
  timeSlots,
  majorToEdit,
  onSuccess 
}: CreateMajorDialogProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<{ [day: string]: string[] }>({});

  useEffect(() => {
    if (majorToEdit) {
      setName(majorToEdit.name);
      setSubject(majorToEdit.subject);
      setTeacherId(majorToEdit.teacherId);
      setSelectedClassIds(majorToEdit.classIds);
      setSchedule(majorToEdit.schedule || {});
    } else {
      setName("");
      setSubject("");
      setTeacherId("");
      setSelectedClassIds([]);
      setSchedule({});
    }
  }, [majorToEdit, isOpen]);

  const handleClassToggle = (classId: string) => {
    setSelectedClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleScheduleToggle = (day: string, time: string) => {
    setSchedule(prev => {
      const daySchedule = prev[day] || [];
      const newDaySchedule = daySchedule.includes(time)
        ? daySchedule.filter(t => t !== time)
        : [...daySchedule, time];
      
      if (newDaySchedule.length === 0) {
        const { [day]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [day]: newDaySchedule };
    });
  };

  const [error, setError] = useState<string | null>(null);

  const checkConflicts = (teacherId: string, scheduleToCheck: { [day: string]: string[] }) => {
    for (const day of Object.keys(scheduleToCheck)) {
      const times = scheduleToCheck[day];
      for (const time of times) {
        // Check all classes for this teacher at this time
        for (const schoolClass of classes) {
           const daySchedule = schoolClass.schedule?.[day];
           if (!daySchedule) continue;
           
           const lessons = daySchedule[time];
           if (Array.isArray(lessons)) {
             const conflictingLesson = lessons.find(l => 
               l.teacherId === teacherId && 
               l.majorId !== majorToEdit?.id // Ignore lessons from the major we are currently editing
             );
             
             if (conflictingLesson) {
               return `המורה ${teachers.find(t => t.id === teacherId)?.name} כבר מלמד/ת ב${day} בשעה ${time} בכיתה ${schoolClass.name} (${conflictingLesson.subject})`;
             }
           }
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) return;
    setError(null);

    // Check for conflicts
    const conflictError = checkConflicts(teacherId, schedule);
    if (conflictError) {
      setError(conflictError);
      return;
    }

    setIsSubmitting(true);

    try {
      const batch = writeBatch(firestore);
      
      // 1. Determine Major Ref and ID
      const majorRef = majorToEdit 
        ? doc(firestore, 'majors', majorToEdit.id)
        : doc(collection(firestore, 'majors'));
      const majorId = majorRef.id;

      const majorData = {
        name,
        subject,
        teacherId,
        classIds: selectedClassIds,
        schedule,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (!majorToEdit) {
        // @ts-ignore
        majorData.createdAt = serverTimestamp();
      }
      
      batch.set(majorRef, majorData, { merge: true });


      // 2. Prepare Schedule Updates
      // We need to update classes and the teacher.
      // First, create a map of current schedules to modify in memory.
      const classSchedules = new Map<string, ClassSchedule>();
      classes.forEach(c => classSchedules.set(c.id, JSON.parse(JSON.stringify(c.schedule || {}))));

      const teacherSchedules = new Map<string, ClassSchedule>();
      teachers.forEach(t => teacherSchedules.set(t.id, JSON.parse(JSON.stringify(t.schedule || {}))));


      // 3. Remove Old Lessons (if editing)
      if (majorToEdit) {
        // Remove from classes
        majorToEdit.classIds.forEach(classId => {
            const s = classSchedules.get(classId);
            if (s) {
                Object.keys(s).forEach(day => {
                    Object.keys(s[day] || {}).forEach(time => {
                        const lessons = s[day][time];
                        if (Array.isArray(lessons)) {
                            s[day][time] = lessons.filter(l => l.majorId !== majorToEdit.id);
                            if (s[day][time].length === 0) delete s[day][time];
                        }
                    });
                    if (Object.keys(s[day]).length === 0) delete s[day];
                });
            }
        });

        // Remove from teacher
        const tSchedule = teacherSchedules.get(majorToEdit.teacherId);
        if (tSchedule) {
             Object.keys(tSchedule).forEach(day => {
                Object.keys(tSchedule[day] || {}).forEach(time => {
                    const lessons = tSchedule[day][time];
                    if (Array.isArray(lessons)) {
                        tSchedule[day][time] = lessons.filter(l => l.majorId !== majorToEdit.id);
                        if (tSchedule[day][time].length === 0) delete tSchedule[day][time];
                    }
                });
                if (Object.keys(tSchedule[day]).length === 0) delete tSchedule[day];
            });
        }
      }

      // 4. Add New Lessons
      // Add to classes
      selectedClassIds.forEach(classId => {
          let s = classSchedules.get(classId);
          if (!s) {
             s = {};
             classSchedules.set(classId, s);
          }

          Object.entries(schedule).forEach(([day, times]) => {
              if (!s![day]) s![day] = {};
              times.forEach(time => {
                  if (!s![day][time]) s![day][time] = [];
                  // Check if already exists (shouldn't if we just removed it, but good to be safe)
                  const exists = s![day][time]!.some(l => l.majorId === majorId);
                  if (!exists) {
                      s![day][time]!.push({
                          subject,
                          teacherId,
                          classId,
                          majorId
                      });
                  }
              });
          });
      });

      // Add to teacher
      let tSchedule = teacherSchedules.get(teacherId);
      if (!tSchedule) {
          tSchedule = {};
          teacherSchedules.set(teacherId, tSchedule);
      }
      Object.entries(schedule).forEach(([day, times]) => {
        if (!tSchedule![day]) tSchedule![day] = {};
        times.forEach(time => {
            if (!tSchedule![day][time]) tSchedule![day][time] = [];
            const exists = tSchedule![day][time]!.some(l => l.majorId === majorId);
            if (!exists) {
                tSchedule![day][time]!.push({
                    subject,
                    teacherId,
                    classId: selectedClassIds[0] || '', // Use first class as representative, or empty
                    majorId
                });
            }
        });
    });


      // 5. Commit Updates
      // Update classes
      classSchedules.forEach((newSchedule, classId) => {
          // Only update if it was one of the involved classes (old or new)
          if (selectedClassIds.includes(classId) || (majorToEdit?.classIds.includes(classId))) {
              batch.update(doc(firestore, 'classes', classId), { schedule: newSchedule });
          }
      });

      // Update teachers
      teacherSchedules.forEach((newSchedule, tId) => {
          if (tId === teacherId || tId === majorToEdit?.teacherId) {
              batch.update(doc(firestore, 'teachers', tId), { schedule: newSchedule });
          }
      });

      await batch.commit();

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving major:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{majorToEdit ? 'ערוך מגמה' : 'צור מגמה חדשה'}</DialogTitle>
          <DialogDescription>
            מגמות מאפשרות לשבץ שיעורים למספר כיתות במקביל.
          </DialogDescription>
        </DialogHeader>

        {error && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md mb-4">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם המגמה</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="לדוגמה: מתמטיקה 5 יח״ל"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">מקצוע</Label>
              <Input 
                id="subject" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                placeholder="לדוגמה: מתמטיקה"
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher">מורה</Label>
            <Select value={teacherId} onValueChange={setTeacherId} required>
              <SelectTrigger>
                <SelectValue placeholder="בחר מורה" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>כיתות משתתפות</Label>
            <div className="grid grid-cols-3 gap-2 border p-4 rounded-md">
              {classes.map((schoolClass) => (
                <div key={schoolClass.id} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox 
                    id={`class-${schoolClass.id}`} 
                    checked={selectedClassIds.includes(schoolClass.id)}
                    onCheckedChange={() => handleClassToggle(schoolClass.id)}
                  />
                  <Label htmlFor={`class-${schoolClass.id}`} className="cursor-pointer">
                    {schoolClass.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>מערכת שעות</Label>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              <div className="space-y-4">
                {daysOfWeek.map((day) => (
                  <div key={day} className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">{day}</h4>
                    <div className="flex flex-wrap gap-2">
                      {timeSlots.map((slot) => {
                         const isSelected = schedule[day]?.includes(slot.start);
                         return (
                          <div 
                            key={`${day}-${slot.id}`}
                            onClick={() => handleScheduleToggle(day, slot.start)}
                            className={`
                              cursor-pointer px-2 py-1 rounded text-xs border transition-colors
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground border-primary' 
                                : 'bg-background hover:bg-accent'
                              }
                            `}
                          >
                            {slot.start} - {slot.end}
                          </div>
                         );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {majorToEdit ? 'שמור שינויים' : 'צור מגמה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
