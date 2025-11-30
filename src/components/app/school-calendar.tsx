'use client';

import { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Trash2, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react';
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { commitBatchWithContext } from '@/lib/firestore-utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { SuccessAnimation } from '../ui/success-animation';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  type: 'holiday' | 'exam' | 'event' | 'other';
  location?: string;
  time?: string;
  userId: string;
}

export default function SchoolCalendar() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventType, setEventType] = useState<'holiday' | 'exam' | 'event' | 'other'>('event');
  const [eventLocation, setEventLocation] = useState('');
  const [eventTime, setEventTime] = useState('');

  const eventsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'events'), where('userId', '==', user.uid)) : null, [user, firestore]);
  const { data: events = [], isLoading: eventsLoading } = useCollection<CalendarEvent>(eventsQuery);

  const selectedDateEvents = useMemo(() => {
    if (!date) return [];
    return (events || []).filter(event => isSameDay(parseISO(event.date), date));
  }, [date, events]);

  const handleOpenDialog = (eventToEdit?: CalendarEvent) => {
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setEventTitle(eventToEdit.title);
      setEventDescription(eventToEdit.description || '');
      setEventType(eventToEdit.type);
      setEventLocation(eventToEdit.location || '');
      setEventTime(eventToEdit.time || '');
    } else {
      setEditingEvent(null);
      setEventTitle('');
      setEventDescription('');
      setEventType('event');
      setEventLocation('');
      setEventTime('');
    }
    setIsDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!user || !date || !eventTitle.trim()) return;
    
    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      
      const eventData: Omit<CalendarEvent, 'id'> = {
        date: format(date, 'yyyy-MM-dd'),
        title: eventTitle,
        description: eventDescription,
        type: eventType,
        location: eventLocation,
        time: eventTime,
        userId: user.uid,
      };

      if (editingEvent) {
        const eventRef = doc(firestore, 'events', editingEvent.id);
        batch.update(eventRef, eventData);
        await commitBatchWithContext(batch, {
            operation: 'update',
            path: `events/${editingEvent.id}`,
            data: eventData
        });
      } else {
        const newEventRef = doc(collection(firestore, 'events'));
        batch.set(newEventRef, { ...eventData, id: newEventRef.id });
        await commitBatchWithContext(batch, {
            operation: 'create',
            path: `events/${newEventRef.id}`,
            data: eventData
        });
      }
      
      setShowSuccess(true);
      setTimeout(() => {
          setIsDialogOpen(false);
          setShowSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error saving event:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק אירוע זה?')) return;
    
    try {
      await deleteDoc(doc(firestore, 'events', eventId));
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'holiday': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'exam': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'event': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'holiday': return 'חופשה/חג';
      case 'exam': return 'מבחן';
      case 'event': return 'אירוע';
      default: return 'אחר';
    }
  };

  // Modifiers for the calendar to show dots for days with events
  const modifiers = useMemo(() => {
    const holidays: Date[] = [];
    const exams: Date[] = [];
    const generalEvents: Date[] = [];

    (events || []).forEach(event => {
      const eventDate = parseISO(event.date);
      if (event.type === 'holiday') holidays.push(eventDate);
      else if (event.type === 'exam') exams.push(eventDate);
      else generalEvents.push(eventDate);
    });

    return { holidays, exams, generalEvents };
  }, [events]);

  const modifiersStyles = {
    holidays: { color: 'var(--green-500)', fontWeight: 'bold' },
    exams: { color: 'var(--destructive)', fontWeight: 'bold' },
    generalEvents: { color: 'var(--primary)', fontWeight: 'bold' }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <Card className="flex-1 border-none shadow-none lg:max-w-md">
        <CardHeader>
          <CardTitle>לוח שנה</CardTitle>
          <CardDescription>צפה ונהל אירועים, חגים ומבחנים.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border shadow-sm bg-card"
            modifiers={modifiers}
            modifiersClassNames={{
              holidays: "after:content-['•'] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:text-green-500 after:text-lg",
              exams: "after:content-['•'] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:text-red-500 after:text-lg",
              generalEvents: "after:content-['•'] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:text-blue-500 after:text-lg"
            }}
          />
        </CardContent>
      </Card>

      <Card className="flex-[2] border-none shadow-none h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>
              {date ? format(date, 'EEEE, d בMMMM yyyy', { locale: he }) : 'בחר תאריך'}
            </CardTitle>
            <CardDescription>
              {selectedDateEvents.length === 0 
                ? 'אין אירועים ליום זה' 
                : `${selectedDateEvents.length} אירועים מתוכננים`}
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={!date}>
            <Plus className="h-4 w-4 ml-2" />
            הוסף אירוע
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-[500px] pr-4">
            {selectedDateEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground opacity-60">
                <CalendarIcon className="h-12 w-12 mb-2" />
                <p>לא נמצאו אירועים לתאריך זה</p>
              </div>
            ) : (
              <motion.div 
                className="space-y-4"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
              >
                <AnimatePresence mode="popLayout">
                {selectedDateEvents.map(event => (
                  <motion.div 
                    key={event.id} 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "p-4 rounded-xl border flex flex-col gap-2 transition-all hover:shadow-md",
                      "bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("font-normal", getEventTypeColor(event.type))}>
                          {getEventTypeLabel(event.type)}
                        </Badge>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(event)}>
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteEvent(event.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {event.description && (
                      <p className="text-muted-foreground text-sm">{event.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                      {event.time && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{event.time}</span>
                        </div>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{event.location}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </motion.div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {showSuccess ? (
             <SuccessAnimation message={editingEvent ? 'האירוע עודכן בהצלחה!' : 'האירוע נוצר בהצלחה!'} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{editingEvent ? 'ערוך אירוע' : 'הוסף אירוע חדש'}</DialogTitle>
                <DialogDescription>
                  {date && format(date, 'd בMMMM yyyy', { locale: he })}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">כותרת</Label>
                  <Input
                    id="title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="טיול שנתי, מבחן במתמטיקה..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">סוג אירוע</Label>
                  <Select value={eventType} onValueChange={(val: any) => setEventType(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוג" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event">אירוע</SelectItem>
                      <SelectItem value="holiday">חופשה/חג</SelectItem>
                      <SelectItem value="exam">מבחן</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="time">שעה (אופציונלי)</Label>
                    <Input
                      id="time"
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="location">מיקום (אופציונלי)</Label>
                    <Input
                      id="location"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="חדר 101, חצר..."
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">תיאור (אופציונלי)</Label>
                  <Textarea
                    id="description"
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="פרטים נוספים..."
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">ביטול</Button>
                </DialogClose>
                <Button onClick={handleSaveEvent} disabled={!eventTitle.trim() || isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingEvent ? 'שמור שינויים' : 'צור אירוע')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
