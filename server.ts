import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { getDb, saveDb } from "./src/db_local";

const JWT_SECRET = "SUPER_SECRET_CRM_JWT_KEY_SIGNING_ALGO_12389";

async function startServer() {
  const app = express();
  
  // Larger payload limit for voice recording base64 uploads
  app.use(express.json({ limit: '15mb' }));

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Simple Request logging middleware to debug issues
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // --- CLIENT/USER AUTH AUTHENTICATION AND HELPERS ---
  const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ detail: "Authentication token is required" });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser: any) => {
      if (err) {
        res.status(401).json({ detail: "Invalid or expired session token" });
        return;
      }
      
      const db = getDb();
      const user = db.users.find(u => u.email === decodedUser.sub);
      if (!user) {
        res.status(401).json({ detail: "Authorized user not found" });
        return;
      }

      (req as any).user = user;
      next();
    });
  };

  const requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = (req as any).user;
      if (!user || !allowedRoles.includes(user.role)) {
        res.status(403).json({ detail: "Forbidden: Access is restricted for your role level" });
        return;
      }
      next();
    };
  };

  // --- AUTH ENDPOINTS ---
  app.post("/api/auth/login", (req: Request, res: Response): void => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ detail: "Email and password are required" });
      return;
    }

    const db = getDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ detail: "Incorrect email or password credentials" });
      return;
    }

    const accessToken = jwt.sign({ sub: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({
      access_token: accessToken,
      token_type: "bearer",
      role: user.role,
      name: user.name,
      userId: user.id
    });
  });

  // Get current user details
  app.get("/api/auth/me", authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      manager_id: user.manager_id
    });
  });

  // --- ADMIN USERS ENDPOINTS ---
  
  // List all users (managers/execs) for dropdown selections
  app.get("/api/admin/users", authenticateToken, (req: Request, res: Response): void => {
    const db = getDb();
    // Return safe user objects (stripped baseline hashes)
    const safeUsers = db.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      manager_id: u.manager_id
    }));
    res.json(safeUsers);
  });

  // Create new user (Admin and Management permitted)
  app.post("/api/admin/users", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const { name, email, password, role, manager_id } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ detail: "Name, email, password, and role are all required fields" });
      return;
    }

    const db = getDb();
    const exists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      res.status(400).json({ detail: "Email is already registered" });
      return;
    }

    // Validation: Manager ID check
    if (manager_id) {
      const mgr = db.users.find(u => u.id === Number(manager_id) && u.role === "manager");
      if (!mgr) {
        res.status(400).json({ detail: "Invalid manager_id. Target reports-to account must be a Manager" });
        return;
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const newUser = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      name,
      email,
      password_hash,
      role,
      manager_id: manager_id ? Number(manager_id) : null
    };

    db.users.push(newUser);
    saveDb(db);

    res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      manager_id: newUser.manager_id
    });
  });

  // --- DYNAMIC FORM BUILDER ENDPOINTS (Admin writes, manager/exec receives active) ---
  app.get("/api/admin/forms", authenticateToken, (req: Request, res: Response): void => {
    const db = getDb();
    const user = (req as any).user;
    if (user && (user.role === "admin" || user.role === "management")) {
      res.json(db.form_questions);
    } else {
      res.json(db.form_questions.filter(q => q.is_active));
    }
  });

  app.post("/api/admin/forms", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const { question_text, input_type, options, is_required, is_active, session_type_id, template_id } = req.body;

    if (!question_text || !input_type) {
      res.status(400).json({ detail: "Question text and input type are required options" });
      return;
    }

    const db = getDb();
    const newQuestion = {
      id: db.form_questions.length > 0 ? Math.max(...db.form_questions.map(q => q.id)) + 1 : 1,
      question_text,
      input_type,
      options: options || null,
      is_required: is_required ?? false,
      is_active: is_active ?? true,
      session_type_id: session_type_id !== undefined && session_type_id !== "" ? Number(session_type_id) : null,
      template_id: template_id !== undefined && template_id !== "" ? (template_id !== null ? Number(template_id) : null) : null
    };

    db.form_questions.push(newQuestion);
    saveDb(db);

    res.status(201).json(newQuestion);
  });

  // Edit / Toggle is_active or update form field details
  app.put("/api/admin/forms/:id", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const qId = Number(req.params.id);
    const { question_text, input_type, options, is_required, is_active, session_type_id, template_id } = req.body;

    const db = getDb();
    const questionIndex = db.form_questions.findIndex(q => q.id === qId);

    if (questionIndex === -1) {
      res.status(404).json({ detail: "Dynamic question form detail not found" });
      return;
    }

    const existing = db.form_questions[questionIndex];
    const updated = {
      ...existing,
      question_text: question_text !== undefined ? question_text : existing.question_text,
      input_type: input_type !== undefined ? input_type : existing.input_type,
      options: options !== undefined ? options : existing.options,
      is_required: is_required !== undefined ? is_required : existing.is_required,
      is_active: is_active !== undefined ? is_active : existing.is_active,
      session_type_id: session_type_id !== undefined ? (session_type_id !== "" && session_type_id !== null ? Number(session_type_id) : null) : existing.session_type_id,
      template_id: template_id !== undefined ? (template_id !== "" && template_id !== null ? Number(template_id) : null) : existing.template_id
    };

    db.form_questions[questionIndex] = updated;
    saveDb(db);

    res.json(updated);
  });

  // Delete form question (Admin/Management permitted)
  app.delete("/api/admin/forms/:id", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const qId = Number(req.params.id);
    const db = getDb();
    const questionIndex = db.form_questions.findIndex(q => q.id === qId);

    if (questionIndex === -1) {
      res.status(404).json({ detail: "Dynamic question form detail not found to delete" });
      return;
    }

    db.form_questions.splice(questionIndex, 1);
    // Optionally remove associated answer submissions, but cascade/keep as preferred
    saveDb(db);

    res.json({ message: "Dynamic question field deleted successfully" });
  });

  // --- SESSION TYPES ENDPOINTS ---
  app.get("/api/session-types", authenticateToken, (req: Request, res: Response): void => {
    const db = getDb();
    res.json(db.session_types || []);
  });

  app.post("/api/session-types", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const { name, label, template_id } = req.body;
    if (!name || !label) {
      res.status(400).json({ detail: "Session type name and label are required" });
      return;
    }

    const db = getDb();
    if (!db.session_types) db.session_types = [];

    const exists = db.session_types.some(st => st.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      res.status(400).json({ detail: "A session type with this name already exists" });
      return;
    }

    const newType = {
      id: db.session_types.length > 0 ? Math.max(...db.session_types.map(st => st.id)) + 1 : 1,
      name: name.toLowerCase().replace(/\s+/g, '_'),
      label,
      template_id: template_id !== undefined && template_id !== "" ? (template_id !== null ? Number(template_id) : null) : null
    };

    db.session_types.push(newType);
    saveDb(db);
    res.status(201).json(newType);
  });

  app.put("/api/session-types/:id", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const { name, label, template_id } = req.body;

    const db = getDb();
    if (!db.session_types) db.session_types = [];

    const item = db.session_types.find(st => st.id === id);
    if (!item) {
      res.status(404).json({ detail: "Session type not found" });
      return;
    }

    if (name !== undefined) item.name = name.toLowerCase().replace(/\s+/g, '_');
    if (label !== undefined) item.label = label;
    if (template_id !== undefined) item.template_id = template_id !== "" ? (template_id !== null ? Number(template_id) : null) : null;

    saveDb(db);
    res.json(item);
  });

  app.delete("/api/session-types/:id", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const db = getDb();
    if (!db.session_types) db.session_types = [];

    const index = db.session_types.findIndex(st => st.id === id);
    if (index === -1) {
      res.status(404).json({ detail: "Session type not found" });
      return;
    }

    db.form_questions.forEach(q => {
      if (q.session_type_id === id) {
        q.session_type_id = null;
      }
    });

    db.session_types.splice(index, 1);
    saveDb(db);
    res.status(204).end();
  });

  // --- QUESTIONNAIRE TEMPLATES ENDPOINTS ---
  app.get("/api/templates", authenticateToken, (req: Request, res: Response): void => {
    const db = getDb();
    res.json(db.questionnaire_templates || []);
  });

  app.post("/api/templates", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ detail: "Template name is required" });
      return;
    }

    const db = getDb();
    if (!db.questionnaire_templates) db.questionnaire_templates = [];

    const newTemplate = {
      id: db.questionnaire_templates.length > 0 ? Math.max(...db.questionnaire_templates.map(t => t.id)) + 1 : 1,
      name,
      description: description || ""
    };

    db.questionnaire_templates.push(newTemplate);
    saveDb(db);
    res.status(201).json(newTemplate);
  });

  app.put("/api/templates/:id", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const { name, description } = req.body;

    const db = getDb();
    if (!db.questionnaire_templates) db.questionnaire_templates = [];

    const item = db.questionnaire_templates.find(t => t.id === id);
    if (!item) {
      res.status(404).json({ detail: "Template not found" });
      return;
    }

    if (name !== undefined) item.name = name;
    if (description !== undefined) item.description = description;

    saveDb(db);
    res.json(item);
  });

  app.delete("/api/templates/:id", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const id = Number(req.params.id);
    const db = getDb();
    if (!db.questionnaire_templates) db.questionnaire_templates = [];

    const index = db.questionnaire_templates.findIndex(t => t.id === id);
    if (index === -1) {
      res.status(404).json({ detail: "Template not found" });
      return;
    }

    // Unassign this template from any session types or questions
    if (db.session_types) {
      db.session_types.forEach(st => {
        if (st.template_id === id) {
          st.template_id = null;
        }
      });
    }

    if (db.form_questions) {
      db.form_questions.forEach(q => {
        if (q.template_id === id) {
          q.template_id = null;
        }
      });
    }

    db.questionnaire_templates.splice(index, 1);
    saveDb(db);
    res.status(204).end();
  });

  // --- POSTGRES SERVER CONNECTION ENDPOINTS ---
  app.get("/api/admin/postgres-config", authenticateToken, requireRole(["admin"]), (req: Request, res: Response): void => {
    const db = getDb();
    res.json(db.postgres_config || {});
  });

  app.post("/api/admin/postgres-config", authenticateToken, requireRole(["admin"]), (req: Request, res: Response): void => {
    const { host, port, database, user, password, ssl } = req.body;
    const db = getDb();

    db.postgres_config = {
      host: host || "",
      port: Number(port) || 5432,
      database: database || "",
      user: user || "",
      password: password || "",
      ssl: !!ssl
    };

    saveDb(db);
    res.json({ message: "PostgreSQL Database Connection configuration saved successfully", config: db.postgres_config });
  });

  app.post("/api/admin/postgres-config/test", authenticateToken, requireRole(["admin"]), (req: Request, res: Response): void => {
    const { host, port, database, user, password, ssl } = req.body;

    if (!host || !database || !user) {
      res.status(400).json({ detail: "Host, Database, and User are required parameters to test a connection." });
      return;
    }

    import("pg")
      .then((pg) => {
        const client = new pg.Client({
          host,
          port: Number(port) || 5432,
          database,
          user,
          password,
          ssl: ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 4000
        });

        client.connect()
          .then(() => {
            return client.query("SELECT version() as ver;");
          })
          .then((queryRes) => {
            return client.end().then(() => {
              res.json({
                success: true,
                message: "Successfully connected to PostgreSQL Database Server!",
                details: queryRes.rows[0]?.ver || "Connected"
              });
            });
          })
          .catch((err: any) => {
            console.error("Postgres connection execution step failed:", err);
            client.end().catch(() => {});
            res.status(500).json({
              success: false,
              detail: err.message || "Failed to establish database queries after establishing connection."
            });
          });
      })
      .catch((err) => {
        console.error("Failed to import pg package:", err);
        res.status(500).json({
          success: false,
          detail: "pg package failed to load dynamically: " + err.message
        });
      });
  });

  // --- CLIENTS ENDPOINTS (CRUD) ---
  app.get("/api/clients", authenticateToken, (req: Request, res: Response): void => {
    const db = getDb();
    res.json(db.clients);
  });

  app.post("/api/clients", authenticateToken, requireRole(["admin", "management", "manager"]), (req: Request, res: Response): void => {
    const { contact_name, company_name, phone, email, address, country, zone, state, city } = req.body;

    if (!contact_name || !company_name) {
      res.status(400).json({ detail: "Contact name and company name are required fields" });
      return;
    }

    const db = getDb();
    const newClient = {
      id: db.clients.length > 0 ? Math.max(...db.clients.map(c => c.id)) + 1 : 1,
      contact_name,
      company_name,
      phone: phone || "",
      email: email || "",
      address: address || "",
      country: country || "",
      zone: zone || "",
      state: state || "",
      city: city || "",
      created_at: new Date().toISOString()
    };

    db.clients.push(newClient);
    saveDb(db);

    res.status(201).json(newClient);
  });

  app.put("/api/clients/:id", authenticateToken, (req: Request, res: Response): void => {
    const cId = Number(req.params.id);
    const { contact_name, company_name, phone, email, address, country, zone, state, city } = req.body;

    const db = getDb();
    const clientIndex = db.clients.findIndex(c => c.id === cId);

    if (clientIndex === -1) {
      res.status(404).json({ detail: "Client not found" });
      return;
    }

    const existing = db.clients[clientIndex];
    const updated = {
      ...existing,
      contact_name: contact_name || existing.contact_name,
      company_name: company_name || existing.company_name,
      phone: phone !== undefined ? phone : existing.phone,
      email: email !== undefined ? email : existing.email,
      address: address !== undefined ? address : existing.address,
      country: country !== undefined ? country : existing.country,
      zone: zone !== undefined ? zone : existing.zone,
      state: state !== undefined ? state : existing.state,
      city: city !== undefined ? city : existing.city
    };

    db.clients[clientIndex] = updated;
    saveDb(db);

    res.json(updated);
  });

  app.delete("/api/clients/:id", authenticateToken, requireRole(["admin", "management"]), (req: Request, res: Response): void => {
    const cId = Number(req.params.id);
    const db = getDb();
    const initialLen = db.clients.length;
    db.clients = db.clients.filter(c => c.id !== cId);

    if (db.clients.length === initialLen) {
      res.status(404).json({ detail: "Client not found" });
      return;
    }

    // Cascade delete tasks corresponding to this client
    db.tasks = db.tasks.filter(t => t.client_id !== cId);

    saveDb(db);
    res.status(204).end();
  });

  // --- TASKS ENDPOINTS ---
  
  // List relevant tasks based on Roles
  app.get("/api/tasks", authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    const db = getDb();
    
    let filteredTasks = [];

    if (user.role === "admin" || user.role === "management") {
      filteredTasks = db.tasks;
    } else if (user.role === "manager") {
      // Find all executives report directly to this manager
      const reports = db.users.filter(u => u.manager_id === user.id).map(u => u.id);
      reports.push(user.id); // Manager sees personal tasks too

      filteredTasks = db.tasks.filter(t => t.assigned_by === user.id || reports.includes(t.assigned_to));
    } else {
      // Executive role: see tasks assigned directly to them only
      filteredTasks = db.tasks.filter(t => t.assigned_to === user.id);
    }

    // Decorate tasks with company and contact names for cleaner React lists
    const customTasks = filteredTasks.map(task => {
      const client = db.clients.find(c => c.id === task.client_id);
      const assignee = db.users.find(u => u.id === task.assigned_to);
      const creator = db.users.find(u => u.id === task.assigned_by);

      return {
        ...task,
        client_name: client ? client.contact_name : "Unknown Contact",
        company_name: client ? client.company_name : "Unknown Company",
        assignee_name: assignee ? assignee.name : "Unassigned Executive",
        creator_name: creator ? creator.name : "System"
      };
    });

    res.json(customTasks);
  });

  // Create & Assign Tasks (Manager / Admin / Management / Executive Role)
  app.post("/api/tasks", authenticateToken, requireRole(["manager", "admin", "management", "executive"]), (req: Request, res: Response): void => {
    const user = (req as any).user;
    const { client_id, assigned_to, task_type, scheduled_at } = req.body;

    if (!client_id || !assigned_to || !task_type || !scheduled_at) {
      res.status(400).json({ detail: "client_id, assigned_to, task_type, and scheduled_at are required fields" });
      return;
    }

    const db = getDb();
    
    // Check assignee exists
    const assignee = db.users.find(u => u.id === Number(assigned_to));
    if (!assignee) {
      res.status(400).json({ detail: "The chosen sales executive assignee does not exist" });
      return;
    }

    // Role safety restrictions: Managers can only assign to executives they direct manage (or to themselves)
    if (user.role === "manager") {
      if (assignee.id !== user.id && assignee.manager_id !== user.id) {
        res.status(403).json({ detail: "Forbidden: You are only allowed to manage operations within your report group" });
        return;
      }
    }

    // Executives can ONLY assign tasks to themselves
    if (user.role === "executive") {
      if (Number(assigned_to) !== user.id) {
        res.status(403).json({ detail: "Forbidden: Sales Executives are only allowed to assign tasks to themselves" });
        return;
      }
    }

    // Set end time same as start time to remove default 15m/45m duration
    const scheduled_end_at = scheduled_at;

    const newTask = {
      id: db.tasks.length > 0 ? Math.max(...db.tasks.map(t => t.id)) + 1 : 1,
      client_id: Number(client_id),
      assigned_by: user.id,
      assigned_to: Number(assigned_to),
      task_type,
      scheduled_at,
      scheduled_end_at,
      status: "pending",
      completed_at: null,
      created_at: new Date().toISOString(),
      comments: req.body.comments ? String(req.body.comments) : null
    };

    db.tasks.push(newTask);
    saveDb(db);

    res.status(201).json(newTask);
  });

  // Edit Task endpoint
  app.put("/api/tasks/:id", authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    const taskId = Number(req.params.id);
    const { client_id, assigned_to, task_type, scheduled_at, comments, status } = req.body;

    const db = getDb();
    const task = db.tasks.find(t => t.id === taskId);
    if (!task) {
      res.status(404).json({ detail: "Task not found" });
      return;
    }

    // Auth verification: user who created, manager, or management officer
    const isCreator = task.assigned_by === user.id;
    const isPrivileged = ["manager", "management", "admin"].includes(user.role);
    if (!isCreator && !isPrivileged) {
      res.status(403).json({ detail: "Forbidden: You are not authorized to edit this task" });
      return;
    }

    if (client_id !== undefined) task.client_id = Number(client_id);
    if (assigned_to !== undefined) task.assigned_to = Number(assigned_to);
    if (task_type !== undefined) task.task_type = task_type;
    if (scheduled_at !== undefined) {
      task.scheduled_at = scheduled_at;
      task.scheduled_end_at = scheduled_at; // end time equal to start time (duration removed)
    }
    if (comments !== undefined) task.comments = comments ? String(comments) : null;
    if (status !== undefined) {
      task.status = status;
      if (status === "completed" && !task.completed_at) {
        task.completed_at = new Date().toISOString();
      } else if (status === "pending") {
        task.completed_at = null;
      }
    }

    saveDb(db);
    res.json(task);
  });

  // Delete Task endpoint
  app.delete("/api/tasks/:id", authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    const taskId = Number(req.params.id);

    const db = getDb();
    const task = db.tasks.find(t => t.id === taskId);
    if (!task) {
      res.status(404).json({ detail: "Task not found" });
      return;
    }

    // Auth verification: user who created, manager, or management officer
    const isCreator = task.assigned_by === user.id;
    const isPrivileged = ["manager", "management", "admin"].includes(user.role);
    if (!isCreator && !isPrivileged) {
      res.status(403).json({ detail: "Forbidden: You are not authorized to delete this task" });
      return;
    }

    db.tasks = db.tasks.filter(t => t.id !== taskId);
    db.task_submissions = db.task_submissions.filter(ts => ts.task_id !== taskId);

    saveDb(db);
    res.status(204).end();
  });

  // Save or update comments on a task (for closure or follow up notes)
  app.post("/api/tasks/:id/comments", authenticateToken, (req: Request, res: Response): void => {
    const taskId = Number(req.params.id);
    const { comments } = req.body;
    
    const db = getDb();
    const task = db.tasks.find(t => t.id === taskId);
    if (!task) {
      res.status(404).json({ detail: "Task not found" });
      return;
    }
    
    task.comments = comments ? String(comments) : null;
    saveDb(db);
    res.json({ message: "Task comments saved successfully", task });
  });

  // Submit Answer / Edit Submission (Executive reports back)
  // The user may edit the form after submitting within 24 hours of submission.
  app.post("/api/tasks/:id/submit", authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    const taskId = Number(req.params.id);
    const { answers, latitude, longitude } = req.body; // array of { question_id, answer_value }

    if (!Array.isArray(answers)) {
      res.status(400).json({ detail: "Answers must be sent as a list array" });
      return;
    }

    const db = getDb();
    const task = db.tasks.find(t => t.id === taskId);

    if (!task) {
      res.status(404).json({ detail: "Task not found" });
      return;
    }

    // Authorization: Must be assigned to this task
    if (task.assigned_to !== user.id) {
      res.status(403).json({ detail: "Forbidden: You cannot submit entries for tasks assigned to other executives" });
      return;
    }

    const isEdit = task.status === "completed";

    if (isEdit) {
      // Check 24 hour edit window
      const baseTime = task.completed_at ? new Date(task.completed_at).getTime() : 0;
      const elapsedMs = Date.now() - baseTime;
      if (elapsedMs > 24 * 60 * 60 * 1000) {
        res.status(400).json({ detail: "Limit Exceeded: Submissions can only be edited within 24 hours of completion" });
        return;
      }
    }

    // Validate Required dynamic forms
    for (const ans of answers) {
      const q = db.form_questions.find(fq => fq.id === Number(ans.question_id));
      if (!q) {
        res.status(400).json({ detail: `Question form reference id ${ans.question_id} was not found` });
        return;
      }
      if (q.is_required && (ans.answer_value === undefined || ans.answer_value === null || String(ans.answer_value).trim() === "")) {
        res.status(400).json({ detail: `Question Detail '${q.question_text}' is a required field` });
        return;
      }
    }

    let subId: number;

    if (isEdit) {
      const existingSubmission = db.task_submissions.find(ts => ts.task_id === taskId);
      if (existingSubmission) {
        subId = existingSubmission.id;
        // Strip previous answers
        db.submission_answers = db.submission_answers.filter(sa => sa.submission_id !== subId);
        // Note edit timestamp
        existingSubmission.submitted_at = new Date().toISOString();
        // Keep existing latitude and longitude! (Previously captured location will be retained)
      } else {
        subId = db.task_submissions.length > 0 ? Math.max(...db.task_submissions.map(ts => ts.id)) + 1 : 1;
        db.task_submissions.push({
          id: subId,
          task_id: taskId,
          submitted_by: user.id,
          submitted_at: new Date().toISOString(),
          latitude: latitude !== undefined ? latitude : null,
          longitude: longitude !== undefined ? longitude : null
        });
      }
    } else {
      subId = db.task_submissions.length > 0 ? Math.max(...db.task_submissions.map(ts => ts.id)) + 1 : 1;
      const submission = {
        id: subId,
        task_id: taskId,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null
      };
      db.task_submissions.push(submission);
    }

    // Save individual answers
    answers.forEach(ans => {
      const ansId = db.submission_answers.length > 0 ? Math.max(...db.submission_answers.map(sa => sa.id)) + 1 : 1;
      db.submission_answers.push({
        id: ansId,
        submission_id: subId,
        question_id: Number(ans.question_id),
        answer_value: String(ans.answer_value)
      });
    });

    // Mark task completed if not already
    if (!isEdit) {
      task.status = "completed";
      task.completed_at = new Date().toISOString();
    }

    saveDb(db);
    res.status(200).json({ message: isEdit ? "Form submission edited successfully" : "Dynamic form metrics filed, task marked complete", submission_id: subId });
  });

  // Save voice message recording in server
  app.post("/api/tasks/:id/voice", authenticateToken, (req: Request, res: Response): void => {
    const user = (req as any).user;
    const taskId = Number(req.params.id);
    const { voice_base64 } = req.body; // e.g. "data:audio/webm;base64,..."

    if (!voice_base64) {
      res.status(400).json({ detail: "Voice audio payload is required" });
      return;
    }

    const db = getDb();
    const task = db.tasks.find(t => t.id === taskId);

    if (!task) {
      res.status(404).json({ detail: "Task not found" });
      return;
    }

    // Authorization: Must be assigned to this task
    if (task.assigned_to !== user.id) {
      res.status(403).json({ detail: "Forbidden: You are not assigned to this task and cannot record a voice report" });
      return;
    }

    try {
      // Decode base64
      const matches = voice_base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      let base64Data = voice_base64;
      let extension = "wav";

      if (matches && matches.length === 3) {
        extension = matches[1].split('/')[1] || "wav";
        if (extension.includes(';')) {
          extension = extension.split(';')[0];
        }
        base64Data = matches[2];
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `voice_task_${taskId}_${Date.now()}.${extension}`;
      const filePath = path.join(path.join(process.cwd(), 'uploads'), fileName);

      fs.writeFileSync(filePath, buffer);

      // Save url link in database
      task.voice_url = `/uploads/${fileName}`;
      saveDb(db);

      res.status(200).json({ message: "Voice recording uploaded successfully", voice_url: task.voice_url });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ detail: "Could not write voice message to system file storage" });
    }
  });

  // Fetch specific task submissions & answers (For Manager/Admin viewing submitted files)
  app.get("/api/tasks/:id/submission", authenticateToken, (req: Request, res: Response): void => {
    const taskId = Number(req.params.id);
    const db = getDb();
    
    const submission = db.task_submissions.find(ts => ts.task_id === taskId);
    if (!submission) {
      res.status(404).json({ detail: "No form submissions found for this task yet" });
      return;
    }

    const answers = db.submission_answers
      .filter(sa => sa.submission_id === submission.id)
      .map(sa => {
        const question = db.form_questions.find(fq => fq.id === sa.question_id);
        return {
          question_id: sa.question_id,
          question_text: question ? question.question_text : "Deleted Question",
          answer_value: sa.answer_value
        };
      });

    res.json({
      submission_id: submission.id,
      submitted_by: submission.submitted_by,
      submitted_at: submission.submitted_at,
      latitude: submission.latitude || null,
      longitude: submission.longitude || null,
      answers
    });
  });

  // --- MANAGER TEAMS REPORT & ANALYTICS ---
  app.get("/api/analytics/manager", authenticateToken, requireRole(["manager", "admin", "management"]), (req: Request, res: Response): void => {
    const user = (req as any).user;
    const db = getDb();

    let ManagedExecs = [];
    if (user.role === "admin" || user.role === "management") {
      ManagedExecs = db.users.filter(u => u.role === "executive");
    } else {
      // Find direct reporting executives
      ManagedExecs = db.users.filter(u => u.manager_id === user.id);
    }

    const execIds = ManagedExecs.map(e => e.id);
    
    // Also include Manager themselves if seeking metrics
    const queryIds = [...execIds];
    if (user.role === "manager") {
      queryIds.push(user.id);
    }

    // Tasks counts
    const pendingTasks = db.tasks.filter(t => queryIds.includes(t.assigned_to) && t.status === "pending");
    const completedTasks = db.tasks.filter(t => queryIds.includes(t.assigned_to) && t.status === "completed");

    const totalPending = pendingTasks.length;
    const visitsCount = completedTasks.filter(t => t.task_type === "visit").length;
    const callsCount = completedTasks.filter(t => t.task_type === "call").length;

    // Per Executive Metrics
    const performance = ManagedExecs.map(exec => {
      const totalExecCompleted = db.tasks.filter(t => t.assigned_to === exec.id && t.status === "completed").length;
      const totalExecPending = db.tasks.filter(t => t.assigned_to === exec.id && t.status === "pending").length;

      return {
        id: exec.id,
        name: exec.name,
        completed_tasks: totalExecCompleted,
        pending_tasks: totalExecPending
      };
    });

    // Also include Manager performance in the return payload list for visibility if they have schedules
    if (user.role === "manager") {
      const managerCompleted = db.tasks.filter(t => t.assigned_to === user.id && t.status === "completed").length;
      const managerPending = db.tasks.filter(t => t.assigned_to === user.id && t.status === "pending").length;
      if (managerCompleted > 0 || managerPending > 0) {
        performance.push({
          id: user.id,
          name: `${user.name} (Manager)`,
          completed_tasks: managerCompleted,
          pending_tasks: managerPending
        });
      }
    }

    res.json({
      total_completed_visits: visitsCount,
      total_completed_calls: callsCount,
      total_pending_tasks: totalPending,
      executive_performance: performance
    });
  });

  // --- INTERPRET/INTEGRATE VITE SERVING MIDDLEWARE ---
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with dynamic Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with static file assets...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Initial PostgreSQL sync on boot if configured
  try {
    const startupDb = getDb();
    if (startupDb.postgres_config) {
      console.log("[POSTGRES STARTUP] Triggering initial database sync with PostgreSQL...");
      import("./src/db_local").then(({ syncToPostgres }) => {
        syncToPostgres(startupDb).catch((err) => {
          console.error("[POSTGRES STARTUP ERROR] Initial boot synchronization failed:", err);
        });
      });
    }
  } catch (err) {
    console.error("[POSTGRES STARTUP ERROR] Failed to load database for startup sync:", err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dynamic Field Activity CRM server running on http://localhost:${PORT}`);
  });
}

startServer();
