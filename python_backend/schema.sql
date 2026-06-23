-- PostgreSQL Relational Database Schema DDL

-- 1. Roles & Enums
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'executive');
CREATE TYPE task_type AS ENUM ('visit', 'call');
CREATE TYPE task_status AS ENUM ('pending', 'completed');
CREATE TYPE input_type AS ENUM ('text', 'number', 'dropdown', 'checkbox', 'radio', 'datetime');

-- 2. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Indexing for email search
CREATE INDEX idx_users_email ON users(email);

-- 3. Clients Table
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    contact_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Tasks Table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_type task_type NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    status task_status DEFAULT 'pending' NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexing for task queries
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);

-- 5. Form_Questions Table (Dynamic Builder)
CREATE TABLE form_questions (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    input_type input_type NOT NULL,
    options JSONB, -- JSON array of options if dropdown/radio, e.g. ["A", "B", "C"]
    is_required BOOLEAN DEFAULT FALSE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- 6. Task_Submissions Table
CREATE TABLE task_submissions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER UNIQUE NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. Submission_Answers Table
CREATE TABLE submission_answers (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES task_submissions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
    answer_value TEXT -- Can store text or serialized json string if checkbox/multiple values
);

-- Indexing answers for fast queries
CREATE INDEX idx_submission_answers_sub ON submission_answers(submission_id);
