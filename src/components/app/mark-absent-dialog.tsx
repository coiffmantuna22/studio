
'use client';

import { useEffect, useState } from 'react';
import { findSubstitute } from '@/lib/substitute-finder';
import type { Teacher, AbsenceDay, SchoolClass, AffectedLesson, TimeSlot } from '@/lib/types';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const absencePeriodSchema = z.object({
  date: z.date(),
  isAllDay: z.boolean(),
  startTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
  endTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
});

const formSchema = z.object({
  absencePeriods: z.array(absencePeriodSchema),
  reason: z.string().optional(),
}).refine(data => {
    for (const period of data.absencePeriods) {
        if (!period.isAllDay) {
            const start = new Date(`1970-01-01T${period.startTime}:00`);
            const end = new Date(`1970-01-01T${period.endTime}:00`);
            if (start >= end) {
                return false;
            }
        }
    }
    return true;
}, {
    message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה.",
    path: ["absencePeriods"], 
});


type FormValues = z.infer<typeof formSchema>;

interface MarkAbsentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teacher: Teacher | null;
  allTeachers: Teacher[];
  allClasses: SchoolClass[];
  timeSlots: TimeSlot[];
  getAffectedLessons: (
    absentTeacher: Teacher,
    absenceDays: AbsenceDay[],
    allClasses: SchoolClass[],
    timeSlots: TimeSlot[]
  ) => Omit<AffectedLesson, 'recommendation' | 'recommendationId' | 'reasoning' | 'substituteOptions'>[];
  onShowRecommendation: (
    results: AffectedLesson[],
    absentTeacher: Teacher,
    absenceDays: AbsenceDay[]
  ) => void;
}


export default function MarkAbsentDialog({
  isOpen,
  onOpenChange,
  teacher,
  allTeachers,
  allClasses,
  timeSlots,
  onShowRecommendation,
  getAffectedLessons,
}: MarkAbsentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
      absencePeriods: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "absencePeriods",
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset({
        reason: '',
        absencePeriods: [],
      });
      setIsSubmitting(false);
    } else {
       form.reset({
        reason: '',
        absencePeriods: [{ date: startOfDay(new Date()), isAllDay: true, startTime: '08:00', endTime: '16:00' }],
      });
    }
  }, [isOpen, form]);

  if (!teacher) return null;

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const substituteProfiles = allTeachers.filter((t) => t.id !== teacher.id);
      
      const affectedLessons = getAffectedLessons(teacher, values.absencePeriods, allClasses, timeSlots);

      const recommendationPromises = affectedLessons.map(affected => 
        findSubstitute(
          {
            subject: affected.lesson.subject,
            date: affected.date,
            time: affected.time
          },
          substituteProfiles,
          allClasses,
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

      onShowRecommendation(finalResults, teacher, values.absencePeriods);
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
  
  const addAbsencePeriod = () => {
    const lastDate = fields.length > 0 ? fields[fields.length - 1].date : new Date();
     append({
        date: startOfDay(lastDate),
        isAllDay: false,
        startTime: '08:00',
        endTime: '09:00'
     });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>סימון היעדרות עבור {teacher.name}</DialogTitle>
          <DialogDescription>בחר את תאריכי ושעות ההיעדרות כדי למצוא מחליף. המערכת תציג את כל השיעורים המושפעים.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-4 max-h-60 overflow-y-auto pl-2">
              {fields.map((field, index) => {
                const isAllDay = form.watch(`absencePeriods.${index}.isAllDay`);
                return (
                  <div key={field.id} className="p-3 border rounded-lg relative">
                    <div className="space-y-3">
                      <FormField
                          control={form.control}
                          name={`absencePeriods.${index}.date`}
                          render={({ field }) => (
                           <FormItem className="flex flex-col">
                              <FormLabel>תאריך</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full justify-start text-right font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      <CalendarIcon className="ml-2 h-4 w-4" />
                                      {field.value ? format(field.value, "PPP", {locale: he}) : <span>בחר תאריך</span>}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    locale={he}
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                       <FormField
                        control={form.control}
                        name={`absencePeriods.${index}.isAllDay`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-x-reverse space-y-0">
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
                              name={`absencePeriods.${index}.startTime`}
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
                              name={`absencePeriods.${index}.endTime`}
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
                    </div>
                    {fields.length > 1 && (
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-1 left-1 h-6 w-6"
                            onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                    )}
                  </div>
                )
              })}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addAbsencePeriod}>
                <PlusCircle className="ml-2 h-4 w-4"/>
                הוסף תקופת היעדרות
            </Button>
            
            <Separator />

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
            
            {form.formState.errors.absencePeriods && (
                 <p className="text-sm font-medium text-destructive">{form.formState.errors.absencePeriods.message}</p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || fields.length === 0}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    מחפש המלצות...
                  </>
                ) : (
                  'הצג שיעורים מושפעים'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
