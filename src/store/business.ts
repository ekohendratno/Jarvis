import { create } from 'zustand'

type BusinessState = {
  businessId: string | null
  setBusinessId: (id: string | null) => void
}

export const useBusinessStore = create<BusinessState>((set) => ({
  businessId: null,
  setBusinessId: (id) => set({ businessId: id }),
}))
