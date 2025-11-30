'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { SubstitutionRecord } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Loader2, BarChart3 } from 'lucide-react';

interface StatisticsTabProps {
  substitutions: SubstitutionRecord[];
}

export default function StatisticsTab({ substitutions }: StatisticsTabProps) {
  
  if (!substitutions) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            יומן החלפות
          </CardTitle>
          <CardDescription>
            תיעוד היסטורי של כל ההחלפות שבוצעו במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!substitutions || substitutions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו רישומי החלפות.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">שעה</TableHead>
                    <TableHead className="text-right">כיתה</TableHead>
                    <TableHead className="text-right">מורה חסר/ה</TableHead>
                    <TableHead className="text-right">מורה מחליף/ה</TableHead>
                    <TableHead className="text-right">מקצוע</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {substitutions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        {format(new Date(sub.date), 'dd/MM/yyyy', { locale: he })}
                      </TableCell>
                      <TableCell>{sub.time}</TableCell>
                      <TableCell>{sub.className}</TableCell>
                      <TableCell>{sub.absentTeacherName}</TableCell>
                      <TableCell className="text-primary font-semibold">
                        {sub.substituteTeacherName}
                      </TableCell>
                      <TableCell>{sub.subject}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
