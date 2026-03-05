import { create } from "zustand";

interface FeedbackState {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  isOpen: false,
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}));
