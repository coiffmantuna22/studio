'use client';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useEffect } from 'react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'שם הכיתה חייב להכיל לפחות 2 תווים.' }),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateClassDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddClass: (name: string) => void;
}

export default function CreateClassDialog({
  isOpen,
  onOpenChange,
  onAddClass,
}: CreateClassDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });
  
  useEffect(() => {
    if (isOpen) {
        form.reset();
    }
  }, [isOpen, form]);


  const onSubmit = (values: FormValues) => {
    onAddClass(values.name);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>יצירת כיתה חדשה</DialogTitle>
          <DialogDescription>
            הזן את שם הכיתה החדשה.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם הכיתה</FormLabel>
                  <FormControl>
                    <Input placeholder="למשל, כיתה י'2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">שמור</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
