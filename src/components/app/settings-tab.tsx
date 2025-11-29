
'use client';

import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TimeSlot } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Coffee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const timeSlotSchema = z.object({
  id: z.string().optional(),
  start: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "פורמט לא חוקי"),
  end: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "פורמט לא חוקי"),
  type: z.enum(['lesson', 'break']),
});

const formSchema = z.object({
  slots: z.array(timeSlotSchema),
}).refine(data => {
    const sortedSlots = [...data.slots].sort((a, b) => a.start.localeCompare(b.start));
    for(let i = 0; i < sortedSlots.length; i++) {
        const start = new Date(`1970-01-01T${sortedSlots[i].start}:00`);
        const end = new Date(`1970-01-01T${sortedSlots[i].end}:00`);
        if (start >= end) return false; // End must be after start

        if (i > 0) {
            const prevEnd = new Date(`1970-01-01T${sortedSlots[i-1].end}:00`);
            if (start < prevEnd) return false; // Slots must not overlap
        }
    }
    return true;
}, {
    message: 'כל משבצת חייבת להתחיל אחרי שהקודמת מסתיימת, ושעת הסיום חייבת להיות אחרי שעת ההתחלה. ייתכן שתצטרך למיין את המשבצות.',
    path: ['slots'],
});


type FormValues = z.infer<typeof formSchema>;

interface SettingsTabProps {
    timeSlots: TimeSlot[];
    onUpdate: (newTimeSlots: TimeSlot[]) => void;
    isInitialSetup?: boolean;
}

export default function SettingsTab({ timeSlots, onUpdate, isInitialSetup = false }: SettingsTabProps) {
    const { toast } = useToast();
    
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            slots: timeSlots,
        },
    });

    const { fields, append, remove, move } = useFieldArray({
        control: form.control,
        name: "slots",
    });

    const onSubmit = (data: FormValues) => {
        const sortedSlots = [...data.slots].sort((a, b) => a.start.localeCompare(b.start));
        const finalSlots = sortedSlots.map((slot, index) => ({ ...slot, id: String(index + 1) }));
        
        onUpdate(finalSlots);

        if (!isInitialSetup) {
          toast({
              title: 'הגדרות נשמרו',
              description: 'מערכת השעות עודכנה בהצלחה.',
          });
        }
    };

    const addSlot = () => {
        const lastSlot = fields.length > 0 ? [...fields].sort((a, b) => a.start.localeCompare(b.start))[fields.length - 1] : null;
        const newStart = lastSlot ? lastSlot.end : '08:00';
        const newEndMinute = (parseInt(newStart.split(':')[1]) + 45) % 60;
        const newEndHour = parseInt(newStart.split(':')[0]) + Math.floor((parseInt(newStart.split(':')[1]) + 45) / 60);
        const newEnd = `${newEndHour.toString().padStart(2, '0')}:${newEndMinute.toString().padStart(2, '0')}`;

        append({ start: newStart, end: newEnd, type: 'lesson' });
    }

    const handleSort = () => {
        const currentSlots = form.getValues('slots');
        const sortedSlots = [...currentSlots].sort((a, b) => a.start.localeCompare(b.start));
        form.setValue('slots', sortedSlots);
        form.trigger('slots'); // Re-run validation after sorting
    }

    const addFiveMinBreaks = () => {
        const currentSlots = form.getValues('slots');
        const sortedSlots = [...currentSlots].sort((a, b) => a.start.localeCompare(b.start));
        const newSlots: any[] = [];
        let shiftMinutes = 0;

        for (let i = 0; i < sortedSlots.length; i++) {
            const slot = sortedSlots[i];
            
            // Calculate new start/end with accumulated shift
            const startParts = slot.start.split(':').map(Number);
            const endParts = slot.end.split(':').map(Number);
            
            const startTotal = startParts[0] * 60 + startParts[1] + shiftMinutes;
            const endTotal = endParts[0] * 60 + endParts[1] + shiftMinutes;

            const newStart = `${Math.floor(startTotal / 60).toString().padStart(2, '0')}:${(startTotal % 60).toString().padStart(2, '0')}`;
            const newEnd = `${Math.floor(endTotal / 60).toString().padStart(2, '0')}:${(endTotal % 60).toString().padStart(2, '0')}`;

            newSlots.push({ ...slot, start: newStart, end: newEnd });

            // If next slot exists and both are lessons, add a break
            if (i < sortedSlots.length - 1) {
                const nextSlot = sortedSlots[i + 1];
                if (slot.type === 'lesson' && nextSlot.type === 'lesson') {
                     // Add 5 min break
                     const breakStart = newEnd;
                     const breakEndTotal = endTotal + 5;
                     const breakEnd = `${Math.floor(breakEndTotal / 60).toString().padStart(2, '0')}:${(breakEndTotal % 60).toString().padStart(2, '0')}`;
                     
                     newSlots.push({
                         start: breakStart,
                         end: breakEnd,
                         type: 'break'
                     });
                     
                     shiftMinutes += 5;
                }
            }
        }
        form.setValue('slots', newSlots);
    };

  return (
    <Card className="mt-6 border-border/80 rounded-2xl max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>הגדרות מערכת שעות</CardTitle>
        <CardDescription>
            {isInitialSetup 
                ? 'ברוך הבא! כדי להתחיל, הגדר את שעות הלימוד וההפסקות בבית הספר.'
                : 'כאן ניתן להתאים את שעות הלימוד וההפסקות בבית הספר. השינויים יחולו על כל מערכות השעות באפליקציה.'
            }
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end p-4 border rounded-lg">
                            <FormField
                                control={form.control}
                                name={`slots.${index}.start`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>שעת התחלה</FormLabel>
                                        <FormControl><Input type="time" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name={`slots.${index}.end`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>שעת סיום</FormLabel>
                                        <FormControl><Input type="time" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`slots.${index}.type`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>סוג</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="בחר סוג" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="lesson">שיעור</SelectItem>
                                                <SelectItem value="break">הפסקה</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                             <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                             </Button>
                        </div>
                    ))}
                </div>
                 {form.formState.errors.slots && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.slots.message || form.formState.errors.slots?.root?.message}</p>
                )}
                <div className='flex flex-wrap gap-2'>
                    <Button type="button" variant="outline" onClick={addSlot}>
                        <Plus className="ml-2 h-4 w-4" />
                        הוסף משבצת זמן
                    </Button>
                     <Button type="button" variant="secondary" onClick={handleSort}>
                        מיין לפי שעה
                    </Button>
                    <Button type="button" variant="secondary" onClick={addFiveMinBreaks}>
                        <Coffee className="ml-2 h-4 w-4" />
                        הוסף הפסקות 5 דק'
                    </Button>
                </div>
            </CardContent>
            <CardFooter>
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type='button' disabled={!form.formState.isValid && !isInitialSetup}>שמור הגדרות</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>אישור שמירת שינויים</AlertDialogTitle>
                      <AlertDialogDescription>
                        {isInitialSetup 
                        ? 'פעולה זו תקבע את מבנה מערכת השעות. האם להמשיך?'
                        : 'שינוי מבנה מערכת השעות עשוי להשפיע על שיבוצים קיימים. האם אתה בטוח שברצונך לשמור את השינויים?'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={() => form.handleSubmit(onSubmit)()}>שמור</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
