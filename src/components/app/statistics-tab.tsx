'use client';

import { useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, Query } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import type { SubstitutionRecord } from '@/lib/types';

interface StatisticsTabProps {
    substitutions: Query | null;
}

export default function StatisticsTab({ substitutions: substitutionsQuery }: StatisticsTabProps) {
  const { data: substitutions = [], isLoading } = useCollection<SubstitutionRecord>(substitutionsQuery);

  const filteredSubstitutions = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return (substitutions || []).filter(sub => new Date(sub.date) >= thirtyDaysAgo);
  }, [substitutions]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="mt-6 border-none shadow-none">
      <CardHeader>
        <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <CardTitle>היסטוריית החלפות</CardTitle>
        </div>
        <CardDescription>צפה בכל ההחלפות שבוצעו בחודש האחרון.</CardDescription>
      </CardHeader>
      <CardContent>
        {filteredSubstitutions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            לא נמצאו החלפות בחודש האחרון.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right">שעה</TableHead>
                  <TableHead className="text-right">כיתה</TableHead>
                  <TableHead className="text-right">מקצוע</TableHead>
                  <TableHead className="text-right">מורה חסר</TableHead>
                  <TableHead className="text-right">מורה מחליף</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubstitutions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>{format(new Date(sub.date), 'dd/MM/yyyy', { locale: he })}</TableCell>
                    <TableCell>{sub.time}</TableCell>
                    <TableCell>{sub.className}</TableCell>
                    <TableCell>{sub.subject}</TableCell>
                    <TableCell>{sub.absentTeacherName}</TableCell>
                    <TableCell className="font-medium text-primary">{sub.substituteTeacherName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
