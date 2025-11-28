export interface Teacher {
  id: string;
  name: string;
  subjects: string[];
  availability: string;
  avatar: {
    fallback: string;
  };
}
