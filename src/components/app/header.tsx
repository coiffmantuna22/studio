import { BookOpenCheck, LogOut } from 'lucide-react';
import { ModeToggle } from '../mode-toggle';
import { useAuth } from '@/firebase';
import { Button } from '../ui/button';

export default function Header() {
  const { auth } = useAuth();
  return (
    <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 sm:px-6 md:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpenCheck className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
              SubFinder
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            {auth.currentUser && (
              <Button variant="ghost" size="icon" onClick={() => auth.signOut()}>
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
