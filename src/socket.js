import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 20000,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    };
    
    // Connect to the same server that serves the frontend
    const backendUrl = window.location.origin;
    console.log('Connecting to backend at:', backendUrl);
    
    try {
        const socket = io(backendUrl, options);
        
        // Add connection event listeners for debugging
        socket.on('connect', () => {
            console.log('Socket connected successfully to:', backendUrl);
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });
        
        socket.on('reconnect', (attempt) => {
            console.log('Socket reconnected after', attempt, 'attempts');
        });
        
        socket.on('reconnect_error', (error) => {
            console.error('Socket reconnection error:', error);
        });
        
        return socket;
    } catch (error) {
        console.error('Socket initialization error:', error);
        throw error;
    }
};
