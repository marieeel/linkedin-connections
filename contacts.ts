// contacts.ts
export interface Contact {
    name: string; 
    url: string;
    status: 'Pending' | 'Done' | 'Failed';
  }