
'use client';

import type { Teacher } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Book, Calendar, UserX, Pencil, Trash2, CalendarClock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface TeacherCardProps {
  teacher: Teacher;
  onMarkAbsent: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewSchedule: () => void;
  isAvailableNow: boolean;
}

const formatAvailability = (availability: Teacher['availability']) => {
  const presentDays = availability
    .filter(day => day.slots.length > 0)
    .map(day => day.day.substring(0, 3));
  if (presentDays.length === 0) {
    return 'לא נוכח/ת';
  }
  if (presentDays.length > 3) {
    return `${presentDays.slice(0, 3).join(', ')}...`;
  }
  return presentDays.join(', ');
}

export default function TeacherCard({ teacher, onMarkAbsent, onEdit, onDelete, onViewSchedule, isAvailableNow }: TeacherCardProps) {
  return (
    <Card className="flex flex-col transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-start gap-4">
        <Avatar className={cn(
            "h-12 w-12 border-2",
            isAvailableNow ? 'border-green-500' : 'border-transparent'
        )}>
          <AvatarFallback>{teacher.avatar.fallback}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle>{teacher.name}</CardTitle>
        </div>
         <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="ml-2 h-4 w-4" />
              עריכת פרופיל
            </DropdownMenuItem>
             <DropdownMenuSeparator />
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="ml-2 h-4 w-4" />
                מחק
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-start gap-3">
          <Book className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h4 className="font-semibold text-sm">מקצועות</h4>
            <div className="flex flex-wrap gap-1 mt-1">
              {teacher.subjects.map((subject) => (
                <Badge key={subject} variant="secondary">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Calendar className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h4 className="font-semibold text-sm">שעות נוכחות</h4>
            <p className="text-sm text-muted-foreground">{formatAvailability(teacher.availability)}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2">
         <Button variant="outline" className="w-full" onClick={onViewSchedule}>
          <CalendarClock className="ml-2 h-4 w-4" />
          צפה במערכת
        </Button>
        <Button variant="destructive" className="w-full" onClick={onMarkAbsent}>
          <UserX className="ml-2 h-4 w-4" />
          סמן היעדרות
        </Button>
      </CardFooter>
    </Card>
  );
}
