# Online Interview Scheduler

A full-stack MERN application that helps recruiters schedule interviews, manage candidates, and organize interview appointments.

## Features

- User authentication and login
- Recruiter and candidate management
- Schedule and manage interviews
- View interview details and upcoming appointments
- Backend API integration
- MongoDB database integration
- Interview reminder functionality
- Responsive user interface

## Tech Stack

**Frontend**
- React.js
- JavaScript
- HTML and CSS

**Backend**
- Node.js
- Express.js
- REST APIs

**Database**
- MongoDB
- Mongoose

**Tools**
- Git and GitHub
- Postman
- VS Code

## Project Structure

```text
online-interview-scheduler-v2/
├── frontend/
├── backend/
├── .gitignore
└── README.md
```

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Vishal4664-web/Online-interview-scheduler.git
cd Online-interview-scheduler
```

### 2. Set Up the Backend

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory and configure the required environment variables according to your backend code.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
```

Add any other required environment variables used by your application.

Start the backend using the command specified in your backend `package.json`, for example:

```bash
npm run dev
```

### 3. Set Up the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed in your terminal.

## Environment Variables

Keep database credentials, authentication secrets, and API keys in environment variables. Never commit your actual `.env` files to GitHub.

## Future Improvements

- Email interview notifications
- Calendar integration
- Interview rescheduling and cancellation
- Recruiter and candidate dashboards
- Deployment and production configuration

## Author

**Vishal Gangwar**

GitHub: [Vishal4664-web](https://github.com/Vishal4664-web)

---

If you find this project useful, consider giving the repository a star!
