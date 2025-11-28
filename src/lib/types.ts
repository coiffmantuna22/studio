export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  availability: string;
  preferences?: string;
  avatar: {
    fallback: string;
  };
}
