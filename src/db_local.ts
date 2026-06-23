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
    if (adminUser.email !== targetEmail) {
      adminUser.email = targetEmail;
      modified = true;
    }
    // Only re-hash password if ADMIN_PASSWORD is set or it is missing
    if (process.env.ADMIN_PASSWORD || !adminUser.password_hash) {
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
  } catch (err) {
    console.error("Error writing database, transaction state failed.", err);
  }
}
