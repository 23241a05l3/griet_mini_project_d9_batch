import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../socket';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);
    const [language, setLanguage] = useState('javascript');
    const [executing, setExecuting] = useState(false);
    const [output, setOutput] = useState(null);
    const [executionError, setExecutionError] = useState(null);
    const [stdin, setStdin] = useState('');
    const [showStdin, setShowStdin] = useState(false);
    const [executionStats, setExecutionStats] = useState(null);
    const [apiResponse, setApiResponse] = useState(null);
    const [terminalExpanded, setTerminalExpanded] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('connecting');

    const languages = [
        { id: 'javascript', name: 'JavaScript' },
        { id: 'python', name: 'Python' },
        { id: 'java', name: 'Java' },
        { id: 'cpp', name: 'C++' },
        { id: 'c', name: 'C' },
        { id: 'go', name: 'Go' },
        { id: 'ruby', name: 'Ruby' }
    ];

    const codeTemplates = {
        'javascript': 'console.log("Hello, World!");',
        'python': 'print("Hello, World!")',
        'java': 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}',
        'cpp': '#include <iostream>\n\nint main() {\n  std::cout << "Hello, World!" << std::endl;\n  return 0;\n}',
        'c': '#include <stdio.h>\n\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}',
        'go': 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, World!")\n}',
        'ruby': 'puts "Hello, World!"'
    };

    useEffect(() => {
        const init = async () => {
            try {
                console.log('Initializing socket connection...');
                socketRef.current = await initSocket();
                
                // Handle successful connection
                socketRef.current.on('connect', () => {
                    setConnectionStatus('connected');
                    toast.success('Connected to server!');
                    console.log('Socket connected successfully');
                });
                
                // Handle connection errors
                socketRef.current.on('connect_error', (err) => handleErrors(err));
                socketRef.current.on('connect_failed', (err) => handleErrors(err));
                socketRef.current.on('disconnect', () => {
                    setConnectionStatus('disconnected');
                    toast.error('Disconnected from server');
                    console.log('Socket disconnected');
                });

                function handleErrors(e) {
                    console.log('Socket connection error:', e);
                    setConnectionStatus('error');
                    toast.error(`Connection failed: ${e.message || 'Unknown error'}`);
                    
                    // Don't navigate away immediately, give time to see the error
                    setTimeout(() => {
                        if (socketRef.current?.connected !== true) {
                            reactNavigator('/');
                        }
                    }, 5000);
                }

                // Only emit JOIN if we're successfully connected
                if (socketRef.current.connected) {
                    socketRef.current.emit(ACTIONS.JOIN, {
                        roomId,
                        username: location.state?.username,
                    });
                } else {
                    console.log('Waiting for connection before joining room...');
                    socketRef.current.once('connect', () => {
                        console.log('Now connected, joining room...');
                        socketRef.current.emit(ACTIONS.JOIN, {
                            roomId,
                            username: location.state?.username,
                        });
                    });
                }

                // Listening for joined event
                socketRef.current.on(
                    ACTIONS.JOINED,
                    ({ clients, username, socketId }) => {
                        if (username !== location.state?.username) {
                            toast.success(`${username} joined the room.`);
                            console.log(`${username} joined`);
                        }
                        setClients(clients);
                        socketRef.current.emit(ACTIONS.SYNC_CODE, {
                            code: codeRef.current || codeTemplates[language],
                            socketId,
                        });
                        socketRef.current.emit(ACTIONS.SYNC_LANGUAGE, {
                            socketId,
                            language,
                        });
                    }
                );

                // Listening for language change
                socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({ language: newLanguage }) => {
                    setLanguage(newLanguage);
                    if (!codeRef.current || codeRef.current.trim() === '') {
                        codeRef.current = codeTemplates[newLanguage];
                        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                            roomId,
                            code: codeTemplates[newLanguage]
                        });
                    }
                });

                // Listening for disconnected
                socketRef.current.on(
                    ACTIONS.DISCONNECTED,
                    ({ socketId, username }) => {
                        toast.success(`${username} left the room.`);
                        setClients((prev) => {
                            return prev.filter(
                                (client) => client.socketId !== socketId
                            );
                        });
                    }
                );
            } catch (err) {
                console.error('Failed to initialize socket:', err);
                toast.error('Failed to connect to server');
                setConnectionStatus('error');
            }
        };
        
        init();
        
        return () => {
            if (socketRef.current) {
                console.log('Cleaning up socket connection...');
                socketRef.current.disconnect();
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
                socketRef.current.off('connect');
                socketRef.current.off('connect_error');
                socketRef.current.off('connect_failed');
                socketRef.current.off('disconnect');
            }
        };
    }, []);

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        reactNavigator('/');
    }

    function handleLanguageChange(e) {
        const newLanguage = e.target.value;
        setLanguage(newLanguage);
        if (!codeRef.current || codeRef.current.trim() === '') {
            codeRef.current = codeTemplates[newLanguage];
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                roomId,
                code: codeTemplates[newLanguage]
            });
        }
        socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
            roomId,
            language: newLanguage,
        });
    }

    async function runCode() {
        if (!codeRef.current) {
            toast.error('No code to execute');
            return;
        }

        setExecuting(true);
        setOutput('Executing...');
        setExecutionError(null);
        setExecutionStats(null);
        setApiResponse(null);
        setTerminalExpanded(true);

        // For JavaScript, try executing in browser first
        if (language === 'javascript') {
            try {
                // Create a sandbox for executing JS code
                const executeBrowserJS = (code, consoleInput = '') => {
                    return new Promise((resolve) => {
                        let output = '';
                        let error = null;
                        let exitCode = 0;
                        
                        // Store original console methods
                        const originalLog = console.log;
                        const originalError = console.error;
                        const originalWarn = console.warn;
                        const originalInfo = console.info;
                        
                        // Override console methods to capture output
                        console.log = (...args) => {
                            output += args.map(arg => 
                                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                            ).join(' ') + '\n';
                        };
                        
                        console.error = (...args) => {
                            output += '[ERROR] ' + args.map(arg => 
                                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                            ).join(' ') + '\n';
                        };
                        
                        console.warn = (...args) => {
                            output += '[WARNING] ' + args.map(arg => 
                                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                            ).join(' ') + '\n';
                        };
                        
                        console.info = (...args) => {
                            output += '[INFO] ' + args.map(arg => 
                                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                            ).join(' ') + '\n';
                        };
                        
                        // Setup handling for input if needed
                        if (consoleInput && consoleInput.trim() !== '') {
                            // Simple mock implementation for input
                            // This will replace any prompt() calls with values from consoleInput
                            const inputLines = consoleInput.split('\n');
                            let inputIndex = 0;
                            
                            window.prompt = (message) => {
                                if (inputIndex < inputLines.length) {
                                    const input = inputLines[inputIndex++];
                                    output += `[INPUT] ${message} ${input}\n`;
                                    return input;
                                }
                                return '';
                            };
                        }
                        
                        // Execute the code
                        const startTime = performance.now();
                        try {
                            // For basic code execution, use Function constructor to prevent global scope pollution
                            new Function(code)();
                        } catch (e) {
                            error = e.stack || e.toString();
                            exitCode = 1;
                        }
                        const endTime = performance.now();
                        
                        // Restore original console methods
                        console.log = originalLog;
                        console.error = originalError;
                        console.warn = originalWarn;
                        console.info = originalInfo;
                        
                        // Remove any prompt overrides
                        if (window.prompt && consoleInput) {
                            delete window.prompt;
                        }
                        
                        // Calculate runtime (in ms)
                        const runtime = endTime - startTime;
                        
                        resolve({
                            output,
                            error,
                            runtime,
                            exitCode
                        });
                    });
                };

                const result = await executeBrowserJS(codeRef.current, stdin);
                
                if (result.error) {
                    setExecutionError(result.error);
                    toast.error('JavaScript execution error');
                } else {
                    setOutput(result.output || 'No output');
                    toast.success('JavaScript executed successfully in browser');
                }
                
                setExecutionStats({
                    language: 'javascript',
                    version: `Browser (${navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'unknown'})`,
                    runtime: result.runtime.toFixed(2),
                    exitCode: result.error ? 1 : 0
                });
                
                setApiResponse({
                    executionMode: 'browser',
                    userAgent: navigator.userAgent
                });
                
                setExecuting(false);
                return; // Skip external API calls
            } catch (browserError) {
                console.error('Browser execution failed, falling back to API:', browserError);
                // If browser execution fails, continue to external APIs
            }
        }

        // Detect environment
        const isDevelopment = process.env.NODE_ENV === 'development';
        console.log(`Running in ${isDevelopment ? 'development' : 'production'} mode`);

        // Store API endpoints in order of preference
        // Using multiple reliable public Piston API endpoints
        const apiEndpoints = [
            'https://emkc.org/api/v2/piston/execute',
            'https://piston.juggler.dev/api/v2/execute',
            'https://piston-api.далее.рф/api/v2/execute',
            'https://api.codex.jaagrav.in/execute' // Different API format but compatible
        ];
        
        let lastError = null;
        let apiSuccess = false;

        for (const apiUrl of apiEndpoints) {
            if (apiSuccess) break;
            
            try {
                console.log(`Attempting to execute code using API: ${apiUrl}`);
                
                // Different payload format based on the API endpoint
                let payload;
                
                if (apiUrl.includes('codex.jaagrav')) {
                    // Special format for Jaagrav's CodeX API
                    payload = {
                        language: getPistonLanguage(language).replace('nodejs', 'node'),
                        code: codeRef.current,
                        input: stdin
                    };
                } else {
                    // Standard Piston API format
                    payload = {
                        language: getPistonLanguage(language),
                        version: getPistonVersion(language),
                        files: [
                            {
                                name: getFileName(language),
                                content: codeRef.current
                            }
                        ],
                        stdin: stdin,
                        args: [],
                        compile_timeout: 10000,
                        run_timeout: 5000,
                        compile_memory_limit: -1,
                        run_memory_limit: -1
                    };
                }

                console.log('Executing code with:', payload);

                // Set a timeout for the fetch operation
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                
                // Clear the timeout since we got a response
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                console.log('Execution response:', data);
                
                setApiResponse(data);

                // Handle standard Piston API response format
                if (data.run) {
                    const runOutput = data.run.output || '';
                    const compileOutput = data.compile?.output || '';
                    
                    if (data.run.stderr) {
                        setExecutionError(data.run.stderr);
                    }
                    
                    if (data.compile?.stderr) {
                        setExecutionError((prev) => 
                            prev ? `${prev}\n\nCompile Error:\n${data.compile.stderr}` : `Compile Error:\n${data.compile.stderr}`
                        );
                    }
                    
                    let finalOutput = '';
                    if (compileOutput) finalOutput += `Compilation Output:\n${compileOutput}\n\n`;
                    finalOutput += runOutput || 'No output';
                    
                    setOutput(finalOutput);
                    
                    setExecutionStats({
                        language: data.language,
                        version: data.version,
                        runtime: data.run.time,
                        compileTime: data.compile?.time,
                        exitCode: data.run.code
                    });

                    if (data.run.code !== 0) {
                        toast.error(`Execution failed with exit code: ${data.run.code}`);
                    } else {
                        toast.success('Code executed successfully');
                    }
                    
                    // Mark success to avoid trying other endpoints
                    apiSuccess = true;
                } 
                // Handle CodeX API format
                else if (data.output !== undefined) {
                    let finalOutput = data.output || 'No output';
                    
                    if (data.error) {
                        setExecutionError(data.error);
                    }
                    
                    setOutput(finalOutput);
                    
                    setExecutionStats({
                        language: getPistonLanguage(language),
                        version: 'latest',
                        runtime: data.timeStamp || 0,
                        exitCode: data.error ? 1 : 0
                    });

                    toast.success('Code executed successfully');
                    apiSuccess = true;
                }
                // Handle message format
                else if (data.message && data.message.includes("execution")) {
                    setOutput(data.message || 'Execution completed');
                    apiSuccess = true;
                    toast.success('Code executed');
                } else {
                    // This API failed, let's try the next one
                    lastError = new Error('The execution service returned an invalid response format');
                    console.warn(`API ${apiUrl} returned invalid format:`, data);
                }
            } catch (error) {
                console.error(`Error executing code with API ${apiUrl}:`, error);
                
                // Special handling for timeout/abort errors
                if (error.name === 'AbortError') {
                    lastError = new Error('Request timed out. The server might be busy or unreachable.');
                    console.warn(`API ${apiUrl} request timed out`);
                } else {
                    lastError = error;
                }
                
                // Continue to the next API endpoint
            }
        }

        // If all APIs failed, show the last error
        if (!apiSuccess && lastError) {
            setOutput(null);
            setExecutionError(`Error: ${lastError.message || 'Unknown error occurred'}`);
            toast.error('Failed to execute code. Please try again later.');
            
            // In development, provide more detailed error info
            if (isDevelopment) {
                console.error('All API endpoints failed. Details:', lastError);
                setExecutionError(prev => 
                    `${prev}\n\nDebug info (development mode):\n` +
                    `- Check your network connection\n` + 
                    `- Ensure no CORS issues\n` +
                    `- Check if your firewall is blocking API requests\n` +
                    `- Try running the code locally with Node.js/Python`
                );
            }
        }
        
        setExecuting(false);
    }

    function getPistonLanguage(editorLanguage) {
        const languageMap = {
            'javascript': 'nodejs', // Changed from 'javascript' to 'nodejs'
            'python': 'python3',    // Changed from 'python' to 'python3' 
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'go': 'go',
            'ruby': 'ruby'
        };

        return languageMap[editorLanguage] || 'nodejs';
    }
    
    function getPistonVersion(editorLanguage) {
        const versionMap = {
            'javascript': '18.15.0',
            'python': '3.10.0',
            'java': '15.0.2',
            'cpp': '10.2.0',
            'c': '10.2.0',
            'go': '1.16.2',
            'ruby': '3.0.1'
        };

        return versionMap[editorLanguage];
    }
    
    function getFileName(editorLanguage) {
        const fileNameMap = {
            'javascript': 'script.js',
            'python': 'script.py',
            'java': 'Main.java',
            'cpp': 'main.cpp',
            'c': 'main.c',
            'go': 'main.go',
            'ruby': 'script.rb'
        };

        return fileNameMap[editorLanguage];
    }

    function toggleStdinInput() {
        setShowStdin(!showStdin);
    }
    
    function toggleTerminalExpansion() {
        setTerminalExpanded(!terminalExpanded);
    }

    if (!location.state) {
        return <Navigate to="/" />;
    }

    return (
        <div className="mainWrap">
            <div className="aside">
                <div className="asideInner">
                    <div className="logo">
                        <img
                            className="logoImage"
                            src="/codeX1.png"
                            alt="logo"
                        />
                    </div>
                    <h3>Connected</h3>
                    <div className="clientsList">
                        {clients.map((client) => (
                            <Client
                                key={client.socketId}
                                username={client.username}
                            />
                        ))}
                    </div>
                </div>
                <div className="language-selector">
                    <label htmlFor="language">Language:</label>
                    <select
                        id="language"
                        value={language}
                        onChange={handleLanguageChange}
                        className="language-dropdown"
                    >
                        {languages.map((lang) => (
                            <option key={lang.id} value={lang.id}>
                                {lang.name}
                            </option>
                        ))}
                    </select>
                </div>
                <button className="btn stdinBtn" onClick={toggleStdinInput}>
                    {showStdin ? 'Hide Input' : 'Add Input (stdin)'}
                </button>
                <button className="btn runBtn" onClick={runCode} disabled={executing}>
                    {executing ? 'Running...' : 'Run Code'}
                </button>
                <button className="btn copyBtn" onClick={copyRoomId}>
                    Copy ROOM ID
                </button>
                <button className="btn leaveBtn" onClick={leaveRoom}>
                    Leave
                </button>
            </div>
            <div className="editorWrap">
                <Editor
                    socketRef={socketRef}
                    roomId={roomId}
                    language={language}
                    onCodeChange={(code) => {
                        codeRef.current = code;
                    }}
                />
                {showStdin && (
                    <div className="stdin-container">
                        <h4>Standard Input:</h4>
                        <textarea 
                            className="stdin-textarea"
                            value={stdin}
                            onChange={(e) => setStdin(e.target.value)}
                            placeholder="Enter input for your program..."
                        />
                    </div>
                )}
                {(output !== null || executionError !== null || executionStats !== null || apiResponse !== null) && (
                    <div className={`output-terminal ${terminalExpanded ? 'expanded' : ''}`}>
                        <div className="terminal-header">
                            <h4>Output Terminal</h4>
                            <button 
                                className="terminal-toggle-btn" 
                                onClick={toggleTerminalExpansion}
                            >
                                {terminalExpanded ? 'Minimize' : 'Expand'}
                            </button>
                        </div>
                        <div className="terminal-content">
                            {executionStats && (
                                <div className="execution-stats">
                                    <p>Language: {executionStats.language} {executionStats.version}</p>
                                    <p>
                                        {executionStats.compileTime !== undefined ? 
                                            `Compile time: ${executionStats.compileTime} ms | ` : ''}
                                        Runtime: {executionStats.runtime} ms | Exit code: {executionStats.exitCode}
                                    </p>
                                </div>
                            )}
                            {executionError && (
                                <div className="error-output">
                                    <h5>Error:</h5>
                                    <pre>{executionError}</pre>
                                </div>
                            )}
                            {output && (
                                <div className="standard-output">
                                    <h5>Standard Output:</h5>
                                    <pre>{output}</pre>
                                </div>
                            )}
                            {apiResponse && terminalExpanded && (
                                <div className="api-response">
                                    <h5>API Response (Debug):</h5>
                                    <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorPage;
