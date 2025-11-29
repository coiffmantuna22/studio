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
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const timeSlotSchema = z.object({
  start: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "פורמט לא חוקי"),
  end: z.string().regex(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, "פורמט לא חוקי"),
  type: z.enum(['lesson', 'break']),
});

const formSchema = z.object({
  slots: z.array(timeSlotSchema),
}).refine(data => {
    for(let i = 0; i < data.slots.length; i++) {
        const start = new Date(`1970-01-01T${data.slots[i].start}:00`);
        const end = new Date(`1970-01-01T${data.slots[i].end}:00`);
        if (start >= end) return false; // End must be after start

        if (i > 0) {
            const prevEnd = new Date(`1970-01-01T${data.slots[i-1].end}:00`);
            if (start < prevEnd) return false; // Slots must not overlap
        }
    }
    return true;
}, {
    message: 'כל משבצת חייבת להתחיל אחרי שהקודמת מסתיימת, ושעת הסיום חייבת להיות אחרי שעת ההתחלה.',
    path: ['slots'],
});


type FormValues = z.infer<typeof formSchema>;

interface SettingsTabProps {
    timeSlots: TimeSlot[];
    onUpdate: (newTimeSlots: TimeSlot[]) => void;
    children?: React.ReactNode;
}

export default function SettingsTab({ timeSlots, onUpdate, children }: SettingsTabProps) {
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
        toast({
            title: 'הגדרות נשמרו',
            description: 'מערכת השעות עודכנה בהצלחה.',
        });
    };

    const addSlot = () => {
        const lastSlot = fields[fields.length - 1];
        const newStart = lastSlot ? lastSlot.end : '08:00';
        const newEnd = lastSlot ? `${(parseInt(lastSlot.end.split(':')[0]) + 1).toString().padStart(2, '0')}:00` : '09:00';
        append({ start: newStart, end: newEnd, type: 'lesson' });
    }

  return (
    <Card className="mt-6 border-border/80 rounded-2xl max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>הגדרות מערכת שעות</CardTitle>
        <CardDescription>
            כאן ניתן להתאים את שעות הלימוד וההפסקות בבית הספר. השינויים יחולו על כל מערכות השעות באפליקציה.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
                 {form.formState.errors.slots && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.slots.message}</p>
                )}
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
                <Button type="button" variant="outline" onClick={addSlot}>
                    <Plus className="ml-2 h-4 w-4" />
                    הוסף משבצת זמן
                </Button>
            </CardContent>
            <CardFooter className='justify-between'>
                 <Button type="submit">שמור הגדרות</Button>
                 {children}
            </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
