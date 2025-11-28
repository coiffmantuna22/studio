'use client';

import type { Teacher } from '@/lib/types';
import type { RecommendSubstituteTeachersOutput } from '@/ai/flows/recommend-substitute-teachers';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, UserCheck } from 'lucide-react';

interface RecommendationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  recommendationResult: {
    result: RecommendSubstituteTeachersOutput;
    absentTeacher: Teacher;
    dates: { from: Date; to: Date };
  } | null;
}

export default function RecommendationDialog({
  isOpen,
  onOpenChange,
  recommendationResult,
}: RecommendationDialogProps) {
  if (!recommendationResult) return null;

  const { result, absentTeacher, dates } = recommendationResult;
  const { recommendations, reasoning } = result;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Substitute Recommendations</DialogTitle>
          <DialogDescription>
            For {absentTeacher.name}'s absence from{' '}
            {format(dates.from, 'MMM d')} to {format(dates.to, 'MMM d, yyyy')}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserCheck className="h-4 w-4 text-primary" />
              Top Recommendations
            </h3>
            {recommendations.length > 0 ? (
              <ul className="space-y-2 rounded-md border bg-card p-3">
                {recommendations.map((name) => (
                  <li key={name} className="font-medium">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic p-3 border rounded-md">
                No suitable substitutes found based on the criteria.
              </p>
            )}
          </div>
          
          <Separator />
          
          <div>
             <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Lightbulb className="h-4 w-4 text-primary" />
                AI Reasoning
            </h3>
            <div className="space-y-2 rounded-md border bg-secondary p-3">
              <p className="text-sm text-secondary-foreground">{reasoning}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
