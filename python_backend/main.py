from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import datetime

from .database import get_db, engine, Base
from .models import User, Client, Task, FormQuestion, TaskSubmission, SubmissionAnswer, UserRole, TaskType, TaskStatus
from .schemas import (
    LoginRequest, TokenSchema, UserCreate, UserResponse,
    ClientCreate, ClientUpdate, ClientResponse,
    TaskCreate, TaskResponse, QuestionCreate, QuestionResponse,
    FormSubmit, ManagerAnalyticsResponse, ExecutiveMetric
)
from .auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, require_admin, require_manager, require_executive
)

app = FastAPI(title="Custom CRM & Dynamic Field Activity API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# On Startup create tables if not exists
@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)

# --- AUTH ENDPOINTS ---

@app.post("/auth/login", response_model=TokenSchema)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    token = create_access_token(data={"sub": user.email, "role": user.role.value})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role.value,
        "name": user.name
    }

# --- ADMIN USER CRUD ---

@app.post("/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")
    
    # Validation: manager_id must refer to a valid manager
    if user_in.manager_id:
        mgr = db.query(User).filter(User.id == user_in.manager_id, User.role == UserRole.manager).first()
        if not mgr:
            raise HTTPException(status_code=400, detail="Invalid manager_id. Must reference a Sales Manager")
            
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pwd,
        role=user_in.role,
        manager_id=user_in.manager_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.get("/admin/users", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(User).all()

# --- ADMIN DYNAMIC FORM BUILDER CRUD ---

@app.post("/admin/forms", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(q_in: QuestionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    new_q = FormQuestion(
        question_text=q_in.question_text,
        input_type=q_in.input_type,
        options=q_in.options,
        is_required=q_in.is_required,
        is_active=q_in.is_active
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return new_q

@app.get("/admin/forms", response_model=List[QuestionResponse])
def get_questions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Admin builds, everyone can fetch them (e.g. for dynamic renderer)
    return db.query(FormQuestion).filter(FormQuestion.is_active == True).all()

# --- CLIENT DIRECTORY CRUD ---

@app.post("/clients", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client_in: ClientCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Anyone logged in can create clients
    new_client = Client(**client_in.dict())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client

@app.get("/clients", response_model=List[ClientResponse])
def list_clients(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Client).all()

@app.put("/clients/{id}", response_model=ClientResponse)
def update_client(id: int, client_in: ClientUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for key, value in client_in.dict().items():
        setattr(client, key, value)
    db.commit()
    db.refresh(client)
    return client

@app.delete("/clients/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # Restrict deletions to admin
    client = db.query(Client).filter(Client.id == id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
    return None

# --- TASKS SCHEDULING ---

@app.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(require_manager)):
    # Verification: Validate assigned_to user exists
    assignee = db.query(User).filter(User.id == task_in.assigned_to).first()
    if not assignee:
        raise HTTPException(status_code=400, detail="Assigned sales executive does not exist")
        
    # Sales Manager can only assign to executives assigned to them, or to themselves
    if current_user.role == UserRole.manager:
        if assignee.id != current_user.id and assignee.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only assign tasks to executives in your team")
            
    new_task = Task(
        client_id=task_in.client_id,
        assigned_by=current_user.id,
        assigned_to=task_in.assigned_to,
        task_type=task_in.task_type,
        scheduled_at=task_in.scheduled_at,
        status=TaskStatus.pending
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.get("/tasks", response_model=List[TaskResponse])
def list_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Role based filtering
    if current_user.role == UserRole.admin:
        # Admins see everything
        return db.query(Task).all()
        
    elif current_user.role == UserRole.manager:
        # Managers see tasks assigned by them, or tasks assigned to executives they manage
        team_executive_ids = [u.id for u in db.query(User).filter(User.manager_id == current_user.id).all()]
        # Include the manager themselves in search
        team_executive_ids.append(current_user.id)
        return db.query(Task).filter(
            (Task.assigned_by == current_user.id) | 
            (Task.assigned_to.in_(team_executive_ids))
        ).all()
        
    else:
        # Executives only see tasks assigned to them
        return db.query(Task).filter(Task.assigned_to == current_user.id).all()

# --- TASK SUBMISSION ---

@app.post("/tasks/{id}/submit", status_code=status.HTTP_201_CREATED)
def submit_task(id: int, payload: FormSubmit, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Check authorization (Must be the assignee)
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="You can only submit entries for tasks assigned to you")
        
    if task.status == TaskStatus.completed:
        raise HTTPException(status_code=400, detail="Task has already been marked completed")
        
    # Create main submission record
    submission = TaskSubmission(
        task_id=task.id,
        submitted_by=current_user.id,
        submitted_at=datetime.datetime.utcnow()
    )
    db.add(submission)
    db.flush() # populate ID
    
    # Process answers
    for ans in payload.answers:
        # Validate that question exists and is active
        question = db.query(FormQuestion).filter(FormQuestion.id == ans.question_id, FormQuestion.is_active == True).first()
        if not question:
            raise HTTPException(status_code=400, detail=f"Question ID {ans.question_id} not found or inactive")
            
        # Is Required validation
        if question.is_required and (ans.answer_value is None or str(ans.answer_value).strip() == ""):
            raise HTTPException(status_code=400, detail=f"Question '{question.question_text}' is required.")
            
        new_ans = SubmissionAnswer(
            submission_id=submission.id,
            question_id=ans.question_id,
            answer_value=ans.answer_value
        )
        db.add(new_ans)
        
    # Mark task as completed
    task.status = TaskStatus.completed
    task.completed_at = datetime.datetime.utcnow()
    
    db.commit()
    return {"message": "Dynamic activity form submitted successfully, task completed", "submission_id": submission.id}

# --- MANAGER ANALYTICS ---

@app.get("/analytics/manager", response_model=ManagerAnalyticsResponse)
def get_manager_analytics(db: Session = Depends(get_db), current_user: User = Depends(require_manager)):
    # Authenticated manager can only query analytics of executives that report directly to them
    executives = db.query(User).filter(User.manager_id == current_user.id).all()
    exec_ids = [e.id for e in executives]
    
    # Add manager if they assigned tasks to themselves
    exec_ids.append(current_user.id)
    
    # Total pending tasks for the team
    pending_tasks_count = db.query(Task).filter(
        Task.assigned_to.in_(exec_ids),
        Task.status == TaskStatus.pending
    ).count()
    
    # Count of Visits & Calls completed
    visits_completed = db.query(Task).filter(
        Task.assigned_to.in_(exec_ids),
        Task.task_type == TaskType.visit,
        Task.status == TaskStatus.completed
    ).count()
    
    calls_completed = db.query(Task).filter(
        Task.assigned_to.in_(exec_ids),
        Task.task_type == TaskType.call,
        Task.status == TaskStatus.completed
    ).count()
    
    # Per-Executive Performance metrics
    executive_performance = []
    
    # Include the managed executives
    for exec_user in executives:
        completed_count = db.query(Task).filter(Task.assigned_to == exec_user.id, Task.status == TaskStatus.completed).count()
        pending_count = db.query(Task).filter(Task.assigned_to == exec_user.id, Task.status == TaskStatus.pending).count()
        executive_performance.append(
            ExecutiveMetric(
                id=exec_user.id,
                name=exec_user.name,
                completed_tasks=completed_count,
                pending_tasks=pending_count
            )
        )
        
    # Also include Sales Manager themselves if they have any tasks
    manager_completed = db.query(Task).filter(Task.assigned_to == current_user.id, Task.status == TaskStatus.completed).count()
    manager_pending = db.query(Task).filter(Task.assigned_to == current_user.id, Task.status == TaskStatus.pending).count()
    if manager_completed > 0 or manager_pending > 0:
        executive_performance.append(
            ExecutiveMetric(
                id=current_user.id,
                name=f"{current_user.name} (Manager)",
                completed_tasks=manager_completed,
                pending_tasks=manager_pending
            )
        )
        
    return {
        "total_completed_visits": visits_completed,
        "total_completed_calls": calls_completed,
        "total_pending_tasks": pending_tasks_count,
        "executive_performance": executive_performance
    }
