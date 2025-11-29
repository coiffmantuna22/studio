
'use client';

import type { Teacher, TeacherAvailabilityStatus } from '@/lib/types';
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
import { Book, UserX, Pencil, Trash2, CalendarClock, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';


interface TeacherCardProps {
  teacher: Teacher;
  onMarkAbsent: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewSchedule: () => void;
  availabilityStatus: TeacherAvailabilityStatus;
}

const AvailabilityBadge = ({ status }: { status: TeacherAvailabilityStatus }) => {
    switch (status) {
        case 'available':
            return <Badge variant="secondary" className='bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'>פנוי/ה</Badge>;
        case 'teaching':
            return <Badge variant="secondary" className='bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'>מלמד/ת</Badge>;
        case 'absent':
            return <Badge variant="destructive">בחופש</Badge>;
        case 'not_in_school':
            return <Badge variant="outline">לא בביה"ס</Badge>;
        default:
            return <Badge variant="outline">לא ידוע</Badge>;
    }
}

export default function TeacherCard({ teacher, onMarkAbsent, onEdit, onDelete, onViewSchedule, availabilityStatus }: TeacherCardProps) {
  const isMobile = useIsMobile();
  
  return (
    <Card className="flex flex-col transition-all hover:shadow-lg">
      <CardHeader className="flex flex-row items-start gap-4">
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          <AvatarFallback className='bg-primary/10 text-primary font-bold'>{teacher.avatar.fallback}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle>{teacher.name}</CardTitle>
          <div className='mt-1 text-xs text-muted-foreground'>
            מקצועות: {teacher.subjects.join(', ')}
          </div>
        </div>
         <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewSchedule}>
              <CalendarClock className="ml-2 h-4 w-4" />
              צפה במערכת
            </DropdownMenuItem>
             <DropdownMenuItem onClick={onMarkAbsent} className="text-amber-600 focus:text-amber-700 dark:text-amber-500 dark:focus:text-amber-600">
              <UserX className="ml-2 h-4 w-4" />
              סמן היעדרות
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="ml-2 h-4 w-4" />
              עריכת פרופיל
            </DropdownMenuItem>
             <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="ml-2 h-4 w-4" />
              מחק
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h4 className="font-semibold text-sm">סטטוס נוכחי</h4>
            <div className="mt-1">
                <AvailabilityBadge status={availabilityStatus} />
            </div>
          </div>
        </div>
      </CardContent>
      {!isMobile && (
        <CardFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="w-full" onClick={onViewSchedule}>
            <CalendarClock className="ml-2 h-4 w-4" />
            צפה במערכת
          </Button>
          <Button variant="secondary" className="w-full" onClick={onMarkAbsent}>
             <UserX className="ml-2 h-4 w-4 text-amber-600 dark:text-amber-500" />
            <span className="text-amber-600 dark:text-amber-500">סמן היעדרות</span>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
