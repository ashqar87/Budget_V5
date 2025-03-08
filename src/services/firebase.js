// This is a mock Firebase implementation for the prototype
// Replace with actual Firebase configuration when ready to connect to Firebase

const mockFirebase = {
  auth: () => ({
    signInWithEmailAndPassword: (email, password) => {
      return new Promise((resolve) => {
        // Simulate API delay
        setTimeout(() => {
          resolve({
            user: {
              uid: 'mock-user-id',
              email: email,
              displayName: 'Mock User',
            }
          });
        }, 1000);
      });
    },
    createUserWithEmailAndPassword: (email, password) => {
      return new Promise((resolve) => {
        // Simulate API delay
        setTimeout(() => {
          resolve({
            user: {
              uid: 'new-mock-user-id',
              email: email,
              displayName: '',
              updateProfile: (data) => {
                return Promise.resolve();
              }
            }
          });
        }, 1000);
      });
    },
    onAuthStateChanged: (callback) => {
      // No-op for mock
      return () => {};
    },
    signOut: () => Promise.resolve(),
  }),
};

export default mockFirebase;