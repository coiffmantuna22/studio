import { BookOpenCheck } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-card shadow-sm">
      <div className="container mx-auto px-4 py-4 sm:px-6 md:px-8">
        <div className="flex items-center gap-3">
          <BookOpenCheck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
            SubFinder
          </h1>
        </div>
      </div>
    </header>
  );
}
