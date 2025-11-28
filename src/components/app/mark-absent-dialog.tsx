'use client';

import { useEffect, useState } from 'react';
import { recommendSubstituteTeachers, RecommendSubstituteTeachersOutput } from '@/ai/flows/recommend-substitute-teachers';
import type { Teacher } from '@/lib/types';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '../ui/alert';

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const formSchema = z.object({
  dateRange: z.object({
    from: z.date({ required_error: 'נדרש תאריך התחלה.' }),
    to: z.date({ required_error: 'נדרש תאריך סיום.' }),
  }),
  startTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
  endTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
  reason: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface MarkAbsentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teacher: Teacher | null;
  allTeachers: Teacher[];
  onShowRecommendation: (
    result: RecommendSubstituteTeachersOutput,
    absentTeacher: Teacher,
    details: { from: Date; to: Date; startTime: string; endTime: string }
  ) => void;
}

export default function MarkAbsentDialog({
  isOpen,
  onOpenChange,
  teacher,
  allTeachers,
  onShowRecommendation,
}: MarkAbsentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
      startTime: '08:00',
      endTime: '16:00',
    },
  });

  useEffect(() => {
    if (!isOpen) {
      form.reset({ reason: '', startTime: '08:00', endTime: '16:00' });
      setIsSubmitting(false);
    }
  }, [isOpen, form]);

  if (!teacher) return null;

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const absenceDetails = {
        absentTeacher: teacher.name,
        startDate: format(values.dateRange.from, 'yyyy-MM-dd'),
        endDate: format(values.dateRange.to, 'yyyy-MM-dd'),
        startTime: values.startTime,
        endTime: values.endTime,
        reason: values.reason,
      };

      const teacherProfiles = allTeachers
        .filter((t) => t.id !== teacher.id)
        .map((t) => ({
          name: t.name,
          subjects: t.subjects,
          availability: t.availability,
          preferences: t.preferences,
        }));

      const result = await recommendSubstituteTeachers({ absenceDetails, teacherProfiles });
      
      onShowRecommendation(result, teacher, { 
        from: values.dateRange.from, 
        to: values.dateRange.to,
        startTime: values.startTime,
        endTime: values.endTime
      });
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
      <DialogContent className="sm:max-w-md">
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
                                {format(field.value.from, "dd, LLL y")} -{" "}
                                {format(field.value.to, "dd, LLL y")}
                              </>
                            ) : (
                              format(field.value.from, "dd, LLL y")
                            )
                          ) : (
                            <span>בחר טווח תאריכים</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
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
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
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
                name="endTime"
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

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סיבה (אופציונלי)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="למשל, פיתוח מקצועי" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

             <Alert variant="default" className="bg-secondary">
              <AlertDescription className="text-sm text-secondary-foreground">
                המערכת תשתמש ב-AI כדי למצוא את המורים המחליפים המתאימים ביותר על סמך כישוריהם.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
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
