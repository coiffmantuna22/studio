'use client';

import { useEffect, useState } from 'react';
import { findSubstitute, FindSubstituteOutput } from '@/ai/flows/recommend-substitute-teachers';
import type { Teacher, AbsenceDay, SchoolClass, AffectedLesson } from '@/lib/types';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, eachDayOfInterval, startOfDay, getDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import { timeSlots, daysOfWeek } from '@/lib/constants';

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const absenceDaySchema = z.object({
  date: z.date(),
  isAllDay: z.boolean(),
  startTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
  endTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
});

const formSchema = z.object({
  dateRange: z.object({
    from: z.date({ required_error: 'נדרש תאריך התחלה.' }),
    to: z.date({ required_error: 'נדרש תאריך סיום.' }),
  }),
  absenceDays: z.array(absenceDaySchema),
  reason: z.string().optional(),
}).refine(data => {
    for (const day of data.absenceDays) {
        if (!day.isAllDay) {
            const start = new Date(`1970-01-01T${day.startTime}:00`);
            const end = new Date(`1970-01-01T${day.endTime}:00`);
            if (start >= end) {
                return false;
            }
        }
    }
    return true;
}, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה.",
    path: ["absenceDays"], 
});


type FormValues = z.infer<typeof formSchema>;

interface MarkAbsentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teacher: Teacher | null;
  allTeachers: Teacher[];
  allClasses: SchoolClass[];
  onShowRecommendation: (
    results: AffectedLesson[],
    absentTeacher: Teacher
  ) => void;
}

const getAffectedLessons = (
  absentTeacher: Teacher,
  absenceDays: AbsenceDay[],
  allClasses: SchoolClass[]
): AffectedLesson[] => {
  const affected: AffectedLesson[] = [];
  const dayMap = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  absenceDays.forEach(day => {
    const dayOfWeek = dayMap[getDay(day.date)];
    const absenceStart = day.isAllDay ? 0 : parseInt(day.startTime.split(':')[0]);
    const absenceEnd = day.isAllDay ? 24 : parseInt(day.endTime.split(':')[0]);

    allClasses.forEach(schoolClass => {
      const classDaySchedule = schoolClass.schedule[dayOfWeek];
      if (classDaySchedule) {
        Object.entries(classDaySchedule).forEach(([time, lesson]) => {
          const lessonHour = parseInt(time.split(':')[0]);
          if (lesson && lesson.teacherId === absentTeacher.id && lessonHour >= absenceStart && lessonHour < absenceEnd) {
            affected.push({
              classId: schoolClass.id,
              className: schoolClass.name,
              date: day.date,
              time: time,
              lesson: lesson,
              recommendation: null, // Will be filled later
              reasoning: null,
            });
          }
        });
      }
    });
  });

  return affected;
};

export default function MarkAbsentDialog({
  isOpen,
  onOpenChange,
  teacher,
  allTeachers,
  allClasses,
  onShowRecommendation,
}: MarkAbsentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
      absenceDays: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "absenceDays",
  });

  const dateRange = form.watch('dateRange');

  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const newAbsenceDays = days.map(day => ({
        date: startOfDay(day),
        isAllDay: true,
        startTime: '08:00',
        endTime: '16:00',
      }));
      replace(newAbsenceDays);
    } else {
      replace([]);
    }
  }, [dateRange, replace]);


  useEffect(() => {
    if (!isOpen) {
      form.reset({
        reason: '',
        dateRange: undefined,
        absenceDays: [],
      });
      setIsSubmitting(false);
    }
  }, [isOpen, form]);

  if (!teacher) return null;

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const substituteProfiles = allTeachers
        .filter((t) => t.id !== teacher.id)
        .map((t) => ({
          name: t.name,
          subjects: t.subjects,
          availability: t.availability,
          preferences: t.preferences,
        }));
      
      const affectedLessons = getAffectedLessons(teacher, values.absenceDays, allClasses);
      
      const recommendationPromises = affectedLessons.map(affected => 
        findSubstitute({
            lessonDetails: {
                subject: affected.lesson.subject,
                date: format(affected.date, 'yyyy-MM-dd'),
                time: affected.time
            },
            teacherProfiles: substituteProfiles,
        })
      );
      
      const recommendations = await Promise.all(recommendationPromises);
      
      const finalResults = affectedLessons.map((lesson, index) => ({
        ...lesson,
        recommendation: recommendations[index].recommendation,
        reasoning: recommendations[index].reasoning,
      }));

      onShowRecommendation(finalResults, teacher);
      onOpenChange(false);
    } catch (error) {
      console.error('שגיאה בקבלת המלצות:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה להפיק המלצות למחליפים. אנא נסה שוב.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>סימון היעדרות עבור {teacher.name}</DialogTitle>
          <DialogDescription>בחר את תאריכי ושעות ההיעדרות כדי למצוא מחליף.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>תאריכי היעדרות</FormLabel>
                   <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value?.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {field.value?.from ? (
                            field.value.to ? (
                              <>
                                {format(field.value.from, "d LLL, y", {locale: he})} -{" "}
                                {format(field.value.to, "d LLL, y", {locale: he})}
                              </>
                            ) : (
                              format(field.value.from, "d LLL, y", {locale: he})
                            )
                          ) : (
                            <span>בחר טווח תאריכים</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        locale={he}
                        mode="range"
                        selected={{ from: field.value?.from, to: field.value?.to }}
                        onSelect={field.onChange}
                        numberOfMonths={2}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {fields.length > 0 && (
                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                    {fields.map((field, index) => {
                       const isAllDay = form.watch(`absenceDays.${index}.isAllDay`);
                        return (
                          <div key={field.id} className="space-y-2">
                            <h4 className="font-semibold text-sm">{format(field.date, "EEEE, d MMM", {locale: he})}</h4>
                             <FormField
                              control={form.control}
                              name={`absenceDays.${index}.isAllDay`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 mr-auto">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    יום שלם
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                            {!isAllDay && (
                                <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name={`absenceDays.${index}.startTime`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>שעת התחלה</FormLabel>
                                        <FormControl>
                                        <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`absenceDays.${index}.endTime`}
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>שעת סיום</FormLabel>
                                        <FormControl>
                                        <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                </div>
                            )}
                            {index < fields.length - 1 && <Separator className="mt-4" />}
                          </div>
                        )
                    })}
                </div>
            )}
            
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סיבה (אופציונלי)</FormLabel>
                  <FormControl>
                    <Input placeholder="למשל, פיתוח מקצועי" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             <Alert variant="default" className="bg-secondary">
              <AlertDescription className="text-sm text-secondary-foreground">
                המערכת תשתמש ב-AI כדי למצוא את המורה המחליף המתאים ביותר לכל שיעור חסר.
              </AlertDescription>
            </Alert>
            
            {form.formState.errors.absenceDays && (
                 <p className="text-sm font-medium text-destructive">{form.formState.errors.absenceDays.message}</p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || fields.length === 0}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    מחפש מחליפים...
                  </>
                ) : (
                  'מצא מחליפים'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
