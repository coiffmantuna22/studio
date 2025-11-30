'use client';
import { BookOpenCheck, LogOut, Loader2 } from 'lucide-react';
import { ModeToggle } from '../mode-toggle';
import { useAuth, useUser } from '@/firebase';
import { Button } from '../ui/button';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function Header() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-card/80 backdrop-blur-sm border-b'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <div className="container mx-auto px-4 py-3 sm:px-6 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <BookOpenCheck className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
              מורה מחליף
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isUserLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : user ? (
              <Button variant="ghost" size="icon" onClick={() => auth?.signOut()} className="h-8 w-8 sm:h-10 sm:w-10">
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            ) : null}
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
