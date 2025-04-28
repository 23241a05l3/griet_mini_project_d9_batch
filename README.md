# Real-Time Collaborative Code Editor

A real-time collaborative code editor that allows multiple users to write and execute code together in various programming languages.

## Features

- Real-time code collaboration using Socket.IO
- Support for multiple programming languages (JavaScript, Python, Java, C++, C, Go, Ruby)
- In-browser code execution for JavaScript
- External API execution for other languages
- User rooms for collaboration
- Syntax highlighting using CodeMirror

## Demo

🔗 [Live Demo](https://griet-mini-project-d9-batch.onrender.com/)

Try out the live application by clicking the link above! Create a room and share the room ID with others to collaborate.

## Technologies Used

- React.js for the frontend
- Node.js and Express for the backend
- Socket.IO for real-time communication
- CodeMirror for the code editor interface

## Getting Started

### Prerequisites

- Node.js and npm installed

### Installation

1. Clone the repository
   ```
   git clone https://github.com/23241a05l3/griet_mini_project_d9_batch
   cd realtime-code-editor
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the development server
   ```
   npm run start:dev
   ```

4. Or run frontend and backend on a single server
   ```
   npm run start:unified:dev
   ```

## Deployment

This application is deployed on [Render](https://griet-mini-project-d9-batch.onrender.com/).

## License

[MIT](https://choosealicense.com/licenses/mit/)
