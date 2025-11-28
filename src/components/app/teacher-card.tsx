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
import { Book, Calendar, UserX } from 'lucide-react';

interface TeacherCardProps {
  teacher: Teacher;
  onMarkAbsent: () => void;
}

export default function TeacherCard({ teacher, onMarkAbsent }: TeacherCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback>{teacher.avatar.fallback}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-lg">{teacher.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="flex items-start gap-3">
          <Book className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h4 className="font-semibold text-sm">Subjects</h4>
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
            <h4 className="font-semibold text-sm">Availability</h4>
            <p className="text-sm text-muted-foreground">{teacher.availability}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={onMarkAbsent}>
          <UserX className="mr-2 h-4 w-4" />
          Mark Absent
        </Button>
      </CardFooter>
    </Card>
  );
}
