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
import { Book, Calendar, UserX, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

interface TeacherCardProps {
  teacher: Teacher;
  onMarkAbsent: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const formatAvailability = (availability: Teacher['availability']) => {
  const availableDays = availability
    .filter(day => day.slots.length > 0)
    .map(day => day.day.substring(0, 3));
  if (availableDays.length === 0) {
    return 'לא זמין/ה';
  }
  if (availableDays.length > 3) {
    return `${availableDays.slice(0, 3).join(', ')}...`;
  }
  return availableDays.join(', ');
}

export default function TeacherCard({ teacher, onMarkAbsent, onEdit, onDelete }: TeacherCardProps) {
  return (
    <Card className="flex flex-col transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-start gap-4">
        <Avatar className="h-12 w-12">
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
              <Pencil className="mr-2 h-4 w-4" />
              עריכה
            </DropdownMenuItem>
             <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              מחק
            </DropdownMenuItem>
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
            <h4 className="font-semibold text-sm">זמינות</h4>
            <p className="text-sm text-muted-foreground">{formatAvailability(teacher.availability)}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-1 gap-2">
        <Button className="w-full" onClick={onMarkAbsent}>
          <UserX className="mr-2 h-4 w-4" />
          סימון היעדרות
        </Button>
      </CardFooter>
    </Card>
  );
}
