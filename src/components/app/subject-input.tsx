import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface SubjectInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export default function SubjectInput({ value, onChange, placeholder }: SubjectInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && inputValue.trim()) {
      event.preventDefault();
      const newSubjects = [...value, inputValue.trim()];
      onChange(newSubjects);
      setInputValue('');
    }
  };

  const removeSubject = (subjectToRemove: string) => {
    const newSubjects = value.filter(subject => subject !== subjectToRemove);
    onChange(newSubjects);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(subject => (
          <Badge key={subject} variant="secondary">
            {subject}
            <button
              type="button"
              className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20"
              onClick={() => removeSubject(subject)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}
