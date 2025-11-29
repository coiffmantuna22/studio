'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Teacher, AbsenceDay } from '@/lib/types';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, startOfDay, isSameDay, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Loader2, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const absencePeriodSchema = z.object({
  date: z.date(),
  isAllDay: z.boolean(),
  startTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
  endTime: z.string().regex(timeRegex, { message: 'פורמט זמן לא חוקי (HH:mm).' }),
});

const formSchema = z.object({
  absencePeriods: z.array(absencePeriodSchema).min(1, "יש לבחור לפחות תאריך אחד."),
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
  existingAbsences?: AbsenceDay[] | null;
  onConfirm: (teacher: Teacher, absenceDays: AbsenceDay[]) => void;
}


export default function MarkAbsentDialog({
  isOpen,
  onOpenChange,
  teacher,
  existingAbsences,
  onConfirm,
}: MarkAbsentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!existingAbsences && existingAbsences.length > 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
      absencePeriods: [],
    },
  });

  // Helper to sync calendar selection with form state
  const selectedDates = useMemo(() => {
    return form.watch('absencePeriods').map(p => p.date);
  }, [form.watch('absencePeriods')]);

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (!dates) {
        form.setValue('absencePeriods', []);
        return;
    }

    const currentPeriods = form.getValues('absencePeriods');
    
    // Create new periods list preserving existing configs for kept dates
    const newPeriods = dates.map(date => {
        const existing = currentPeriods.find(p => isSameDay(p.date, date));
        if (existing) return existing;
        
        return {
            date: startOfDay(date),
            isAllDay: true,
            startTime: '08:00',
            endTime: '16:00'
        };
    });

    // Sort by date
    newPeriods.sort((a, b) => a.date.getTime() - b.date.getTime());

    form.setValue('absencePeriods', newPeriods, { shouldValidate: true });
  };

  const removeDate = (dateToRemove: Date) => {
      const currentPeriods = form.getValues('absencePeriods');
      const newPeriods = currentPeriods.filter(p => !isSameDay(p.date, dateToRemove));
      form.setValue('absencePeriods', newPeriods, { shouldValidate: true });
  };


  useEffect(() => {
    if (!isOpen) {
      form.reset({ reason: '', absencePeriods: [] });
      setIsSubmitting(false);
    } else {
       if (isEditMode && existingAbsences) {
            const absencesToEdit = existingAbsences.map(abs => {
              const date = typeof abs.date === 'string' ? startOfDay(new Date(abs.date)) : startOfDay(abs.date);
              return {
                date,
                isAllDay: abs.isAllDay,
                startTime: abs.startTime,
                endTime: abs.endTime
              };
            });
            form.reset({ reason: '', absencePeriods: absencesToEdit });
       } else {
            // Default to today if not editing
            // form.reset({ reason: '', absencePeriods: [{ date: startOfDay(new Date()), isAllDay: true, startTime: '08:00', endTime: '16:00' }] });
            form.reset({ reason: '', absencePeriods: [] });
       }
    }
  }, [isOpen, isEditMode, existingAbsences, form]);

  if (!teacher) return null;

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await onConfirm(teacher, values.absencePeriods);
      toast({
        title: isEditMode ? 'היעדרות עודכנה' : 'היעדרות נרשמה',
        description: `ההיעדרות של ${teacher.name} עודכנה במערכת.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('שגיאה ברישום היעדרות:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה',
        description: 'לא ניתן היה לרשום את ההיעדרות. אנא נסה שוב.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const absencePeriods = form.watch('absencePeriods');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl">{isEditMode ? `עריכת היעדרות: ${teacher.name}` : `רישום היעדרות: ${teacher.name}`}</DialogTitle>
          <DialogDescription>
             בחר תאריכים בלוח השנה והגדר את שעות ההיעדרות לכל יום.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left Side: Calendar */}
                <div className="p-6 pt-2 border-b md:border-b-0 md:border-l flex flex-col items-center justify-start bg-muted/10">
                    <h3 className="font-medium mb-4 self-start flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary"/>
                        בחירת תאריכים
                    </h3>
                    <Calendar
                        mode="multiple"
                        selected={selectedDates}
                        onSelect={handleDateSelect}
                        className="rounded-md border shadow bg-card"
                        locale={he}
                    />
                    <div className="mt-4 text-sm text-muted-foreground text-center">
                        {selectedDates.length === 0 ? 'לא נבחרו תאריכים' : `נבחרו ${selectedDates.length} ימים`}
                    </div>
                </div>

                {/* Right Side: Configuration List */}
                <div className="flex-1 flex flex-col p-6 pt-2 overflow-hidden bg-background">
                     <h3 className="font-medium mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary"/>
                        פרטי היעדרות
                    </h3>
                    
                    <ScrollArea className="flex-1 -mr-4 pr-4">
                        {absencePeriods.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-xl">
                                <CalendarIcon className="h-10 w-10 mb-2 opacity-20" />
                                <p>אנא בחר תאריכים מלוח השנה</p>
                            </div>
                        ) : (
                            <div className="space-y-3 pb-4">
                                {absencePeriods.map((period, index) => (
                                    <Card key={period.date.toISOString()} className="overflow-hidden border shadow-sm transition-all hover:shadow-md">
                                        <CardContent className="p-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center">
                                                {/* Date Header */}
                                                <div className="bg-muted/30 p-3 sm:w-40 flex flex-row sm:flex-col items-center justify-between sm:justify-center border-b sm:border-b-0 sm:border-l gap-2">
                                                    <div className="text-center">
                                                        <div className="font-bold text-lg text-primary">
                                                            {format(period.date, 'dd/MM')}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {format(period.date, 'EEEE', { locale: he })}
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive sm:hidden"
                                                        onClick={() => removeDate(period.date)}
                                                    >
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </div>

                                                {/* Controls */}
                                                <div className="flex-1 p-3 flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
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
                                                                <FormLabel className="font-medium cursor-pointer text-sm">
                                                                    יום שלם
                                                                </FormLabel>
                                                                </FormItem>
                                                            )}
                                                        />
                                                         <Button 
                                                            type="button" 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hidden sm:flex"
                                                            onClick={() => removeDate(period.date)}
                                                        >
                                                            <Trash2 className="h-4 w-4"/>
                                                        </Button>
                                                    </div>

                                                    {!period.isAllDay && (
                                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <FormField
                                                                control={form.control}
                                                                name={`absencePeriods.${index}.startTime`}
                                                                render={({ field }) => (
                                                                <FormItem className="flex-1 space-y-1">
                                                                    <FormLabel className="text-xs text-muted-foreground">התחלה</FormLabel>
                                                                    <FormControl>
                                                                    <Input type="time" className="h-8 text-sm" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage className="text-[10px]" />
                                                                </FormItem>
                                                                )}
                                                            />
                                                            <span className="text-muted-foreground mt-4">-</span>
                                                            <FormField
                                                                control={form.control}
                                                                name={`absencePeriods.${index}.endTime`}
                                                                render={({ field }) => (
                                                                <FormItem className="flex-1 space-y-1">
                                                                    <FormLabel className="text-xs text-muted-foreground">סיום</FormLabel>
                                                                    <FormControl>
                                                                    <Input type="time" className="h-8 text-sm" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage className="text-[10px]" />
                                                                </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                    
                     <div className="mt-4 pt-4 border-t space-y-4">
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>סיבה (אופציונלי)</FormLabel>
                                <FormControl>
                                    <Input placeholder="למשל, מחלה, מילואים..." {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        {form.formState.errors.absencePeriods && (
                            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 rotate-45"/>
                                {form.formState.errors.absencePeriods.message || form.formState.errors.absencePeriods?.root?.message}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <DialogFooter className="p-6 pt-4 border-t bg-muted/5">
              <DialogClose asChild>
                <Button type="button" variant="outline">ביטול</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || absencePeriods.length === 0}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'מעדכן...' : 'רושם היעדרות...'}
                  </>
                ) : (
                  isEditMode ? 'שמור שינויים' : 'אשר ורשום היעדרות'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
