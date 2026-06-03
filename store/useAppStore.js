import { createStore } from 'https://esm.sh/zustand@4.4.1/vanilla';

// [Zustand Implementation] Centralized vanilla store
const useAppStore = createStore((set) => ({
    currentUser: null,
    assignments: [],
    groups: [],
    schools: [],
    loading: false,

    // Actions
    setCurrentUser: (user) => set({ currentUser: user }),
    
    setAssignments: (assignments) => set({ assignments }),
    addAssignment: (assignment) => set((state) => ({ assignments: [assignment, ...state.assignments] })),
    removeAssignment: (id) => set((state) => ({ assignments: state.assignments.filter(a => a._id !== id) })),
    
    setGroups: (groups) => set({ groups }),
    addGroup: (group) => set((state) => ({ groups: [group, ...state.groups] })),
    removeGroup: (id) => set((state) => ({ groups: state.groups.filter(g => g._id !== id) })),
    
    setSchools: (schools) => set({ schools }),
    addSchool: (school) => set((state) => ({ schools: [...state.schools, school] })),
    
    setLoading: (loading) => set({ loading })
}));

// Attach to window so non-module scripts (like app.js) can access it
window.useAppStore = useAppStore;
