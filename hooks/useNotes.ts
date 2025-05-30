
import { useState, useEffect, useCallback } from 'react';
import { NoteEntry } from '../types';

/**
 * Custom hook to manage private notes for a specific candidate.
 * Notes are stored in localStorage as an array of NoteEntry objects.
 * @param candidateId The ID of the candidate for whom notes are being managed.
 * @returns An object containing the notes array and functions to manage them.
 */
export function useNotes(candidateId: number | string) {
  const storageKey = `notes_${candidateId}`;

  const [notes, setNotes] = useState<NoteEntry[]>(() => {
    try {
      const storedNotes = localStorage.getItem(storageKey);
      return storedNotes ? JSON.parse(storedNotes) : [];
    } catch (error) {
      console.error("Error reading notes from localStorage:", error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch (error) {
      console.error("Error saving notes to localStorage:", error);
    }
  }, [storageKey, notes]);

  const addNote = useCallback((text: string) => {
    if (!text.trim()) return; // Do not add empty notes
    const newNote: NoteEntry = {
      id: Date.now().toString(), // Simple unique ID
      date: new Date().toISOString(),
      text: text.trim(),
    };
    setNotes(prevNotes => [newNote, ...prevNotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, [setNotes]);

  const updateNote = useCallback((noteId: string, newText: string) => {
    if (!newText.trim()) { // If updated text is empty, consider it a delete
      deleteNote(noteId);
      return;
    }
    setNotes(prevNotes =>
      prevNotes.map(note =>
        note.id === noteId
          ? { ...note, text: newText.trim(), date: new Date().toISOString() }
          : note
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
  }, [setNotes]);

  const deleteNote = useCallback((noteId: string) => {
    setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
  }, [setNotes]);
  
  const getLatestNote = useCallback((): NoteEntry | null => {
    return notes.length > 0 ? notes[0] : null; // Assumes notes are sorted newest first
  }, [notes]);

  return { notes, addNote, updateNote, deleteNote, getLatestNote };
}
