import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { PostgresConfig } from './types';

const DB_FILE = path.join(process.cwd(), 'db.json');

export interface DbSchema {
  users: any[];
  clients: any[];
  tasks: any[];
  form_questions: any[];
  task_submissions: any[];
  submission_answers: any[];
  postgres_config?: PostgresConfig;
}

const DEFAULT_QUESTIONS = [
  {
    id: 1,
    question_text: "Did you meet the primary decision maker?",
    input_type: "radio",
    options: ["Yes, met directly", "No, met representative", "Failed to meet any contact"],
    is_required: true,
    is_active: true
  },
  {
    id: 2,
    question_text: "Client interest level (1 to 5 scale)",
    input_type: "dropdown",
    options: ["1 - Very Low Interest", "2 - Mild Curiosity", "3 - Interested but hesitant", "4 - Active Interest", "5 - Ready to sign deal"],
    is_required: true,
    is_active: true
  },
  {
    id: 3,
    question_text: "Key discussion summary and follow-up points",
    input_type: "text",
    is_required: true,
    is_active: true
  },
  {
    id: 4,
    question_text: "Did you share the latest product pricing catalog?",
    input_type: "checkbox",
    options: ["Catalog Shared"],
    is_required: false,
    is_active: true
  },
  {
    id: 5,
    question_text: "Target follow-up date & time",
    input_type: "datetime",
    is_required: false,
    is_active: true
  }
];

const DEFAULT_CLIENTS = [
  {
    id: 1,
    contact_name: "John Carter",
    company_name: "Carter Logistics Corp",
    phone: "+1-555-0192",
    email: "john@carterlogistics.com",
    address: "742 Evergreen Terrace, Springfield, OR",
    country: "United States",
    zone: "Northwest",
    state: "Oregon",
    city: "Springfield",
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    contact_name: "Helena Rostova",
    company_name: "Rostov Petrochemicals",
    phone: "+1-555-8833",
    email: "helena.r@rostovpetro.com",
    address: "Block 11, Port Industrial Sector, Houston, TX",
    country: "United States",
    zone: "South",
    state: "Texas",
    city: "Houston",
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    contact_name: "Dinesh Mehta",
    company_name: "Apex Tech Consulting",
    phone: "+91-98765-43210",
    email: "dinesh@apexconsulting.in",
    address: "Whitefield, Tech Hub Rd, Bangalore, KA, India",
    country: "India",
    zone: "South India",
    state: "Karnataka",
    city: "Bangalore",
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    contact_name: "Sophie Dubois",
    company_name: "Dubois Retail Group",
    phone: "+33-1-4268-5300",
    email: "sophie@duboisretail.fr",
    address: "24 Rue de la Paix, Paris, France",
    country: "France",
    zone: "Europe",
    state: "Île-de-France",
    city: "Paris",
    created_at: new Date().toISOString()
  }
];

export function getDb(): DbSchema {
  const seedAdminEmail = process.env.ADMIN_EMAIL || "admin@crm.com";
  const seedAdminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const salt = bcrypt.genSaltSync(10);

  let db: DbSchema;

  if (!fs.existsSync(DB_FILE)) {
    // Generate initial seeded database
    db = {
      users: [
        {
          id: 1,
          name: "System Admin",
          email: seedAdminEmail.toLowerCase(),
          password_hash: bcrypt.hashSync(seedAdminPassword, salt),
          role: "admin",
          manager_id: null
        }
      ],
      clients: DEFAULT_CLIENTS,
      tasks: [],
      form_questions: DEFAULT_QUESTIONS,
      task_submissions: [],
      submission_answers: []
    };
    saveDb(db);
    return db;
  }

  try {
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(rawData);
  } catch (err) {
    console.error("Error reading database file, using fallback.", err);
    db = {
      users: [],
      clients: [],
      tasks: [],
      form_questions: [],
      task_submissions: [],
      submission_answers: []
    };
  }

  // Active sync/override logic: Secure Single Admin & Purge Demo Logins if present
  let modified = false;

  const demoEmails = ["sarah@crm.com", "david@crm.com", "alex@crm.com", "ben@crm.com", "chloe@crm.com"];
  const initialUserCount = db.users.length;
  db.users = db.users.filter(u => !demoEmails.includes(u.email.toLowerCase()));
  if (db.users.length !== initialUserCount) {
    // Also clear existing preseeded demo tasks/submissions so we don't have broken task assignments
    db.tasks = db.tasks.filter(t => t.assigned_to === 1 || db.users.some(u => u.id === t.assigned_to));
    db.task_submissions = db.task_submissions.filter(s => db.users.some(u => u.id === s.submitted_by));
    modified = true;
  }

  // Find or create admin user
  let adminUser = db.users.find(u => u.role === "admin");
  if (!adminUser) {
    adminUser = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      name: "System Admin",
      email: seedAdminEmail.toLowerCase(),
      role: "admin",
      manager_id: null,
      password_hash: bcrypt.hashSync(seedAdminPassword, salt)
    };
    db.users.push(adminUser);
    modified = true;
  } else {
    // Sync email and password hash if environment variables are present and out of sync
    const targetEmail = seedAdminEmail.toLowerCase();
    let emailChanged = false;
    if (adminUser.email !== targetEmail) {
      adminUser.email = targetEmail;
      modified = true;
      emailChanged = true;
    }
    // Only re-hash password if ADMIN_PASSWORD is set or it is missing or the email changed
    if (process.env.ADMIN_PASSWORD || !adminUser.password_hash || emailChanged) {
      const isCorrectPassword = bcrypt.compareSync(seedAdminPassword, adminUser.password_hash);
      if (!isCorrectPassword) {
        adminUser.password_hash = bcrypt.hashSync(seedAdminPassword, salt);
        modified = true;
      }
    }
  }

  if (modified) {
    saveDb(db);
  }

  return db;
}

export function saveDb(data: DbSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    if (data.postgres_config) {
      syncToPostgres(data).catch((err) => {
        console.error("PostgreSQL active sync background task failed:", err);
      });
    }
  } catch (err) {
    console.error("Error writing database, transaction state failed.", err);
  }
}

export async function syncToPostgres(data: DbSchema): Promise<void> {
  if (!data.postgres_config) return;
  const { host, port, database, user, password, ssl } = data.postgres_config;
  if (!host || !database || !user) return;

  try {
    const { Client } = await import("pg");
    const client = new Client({
      host,
      port: Number(port) || 5432,
      database,
      user,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });

    await client.connect();

    // 1. Create tables with matching structure from db_local database models
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        manager_id INT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT PRIMARY KEY,
        contact_name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        email VARCHAR(255),
        address TEXT,
        country VARCHAR(255),
        zone VARCHAR(255),
        state VARCHAR(255),
        city VARCHAR(255),
        created_at VARCHAR(255)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT PRIMARY KEY,
        client_id INT,
        assigned_by INT,
        assigned_to INT,
        task_type VARCHAR(100),
        scheduled_at VARCHAR(255),
        scheduled_end_at VARCHAR(255),
        status VARCHAR(100),
        completed_at VARCHAR(255),
        created_at VARCHAR(255),
        voice_url TEXT,
        comments TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS form_questions (
        id INT PRIMARY KEY,
        question_text TEXT NOT NULL,
        input_type VARCHAR(100) NOT NULL,
        options TEXT,
        is_required BOOLEAN,
        is_active BOOLEAN
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_submissions (
        id INT PRIMARY KEY,
        task_id INT,
        submitted_by INT,
        submitted_at VARCHAR(255),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS submission_answers (
        id INT PRIMARY KEY,
        submission_id INT,
        question_id INT,
        answer_value TEXT
      );
    `);

    // 2. Clear old staging rows and insert in bulk inside an isolated transaction
    await client.query("BEGIN;");

    // Sync users
    await client.query("DELETE FROM users;");
    for (const u of data.users) {
      await client.query(
        "INSERT INTO users (id, name, email, password_hash, role, manager_id) VALUES ($1, $2, $3, $4, $5, $6);",
        [u.id, u.name, u.email, u.password_hash, u.role, u.manager_id || null]
      );
    }

    // Sync clients
    await client.query("DELETE FROM clients;");
    for (const c of data.clients) {
      await client.query(
        "INSERT INTO clients (id, contact_name, company_name, phone, email, address, country, zone, state, city, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);",
        [c.id, c.contact_name, c.company_name, c.phone || null, c.email || null, c.address || null, c.country || null, c.zone || null, c.state || null, c.city || null, c.created_at || null]
      );
    }

    // Sync tasks
    await client.query("DELETE FROM tasks;");
    for (const t of data.tasks || []) {
      await client.query(
        "INSERT INTO tasks (id, client_id, assigned_by, assigned_to, task_type, scheduled_at, scheduled_end_at, status, completed_at, created_at, voice_url, comments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);",
        [t.id, t.client_id, t.assigned_by, t.assigned_to, t.task_type, t.scheduled_at, t.scheduled_end_at || null, t.status, t.completed_at || null, t.created_at, t.voice_url || null, t.comments || null]
      );
    }

    // Sync form_questions
    await client.query("DELETE FROM form_questions;");
    for (const q of data.form_questions || []) {
      await client.query(
        "INSERT INTO form_questions (id, question_text, input_type, options, is_required, is_active) VALUES ($1, $2, $3, $4, $5, $6);",
        [q.id, q.question_text, q.input_type, q.options ? JSON.stringify(q.options) : null, !!q.is_required, !!q.is_active]
      );
    }

    // Sync task_submissions
    await client.query("DELETE FROM task_submissions;");
    for (const ts of data.task_submissions || []) {
      await client.query(
        "INSERT INTO task_submissions (id, task_id, submitted_by, submitted_at, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6);",
        [ts.id, ts.task_id, ts.submitted_by, ts.submitted_at, ts.latitude ?? null, ts.longitude ?? null]
      );
    }

    // Sync submission_answers
    await client.query("DELETE FROM submission_answers;");
    for (const sa of data.submission_answers || []) {
      await client.query(
        "INSERT INTO submission_answers (id, submission_id, question_id, answer_value) VALUES ($1, $2, $3, $4);",
        [sa.id, sa.submission_id, sa.question_id, sa.answer_value || ""]
      );
    }

    await client.query("COMMIT;");
    await client.end();
    console.log("[POSTGRES SYNC] Successfully synchronized all local records to the remote PostgreSQL database!");
  } catch (err: any) {
    console.error("[POSTGRES SYNC ERROR] PostgreSQL active sync failed:", err);
  }
}
