import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from .database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    executive = "executive"

class TaskType(str, enum.Enum):
    visit = "visit"
    call = "call"

class TaskStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"

class InputType(str, enum.Enum):
    text = "text"
    number = "number"
    dropdown = "dropdown"
    checkbox = "checkbox"
    radio = "radio"
    datetime = "datetime"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    manager = relationship("User", remote_side=[id], backref="executives")
    tasks_assigned_by = relationship("Task", foreign_keys="[Task.assigned_by]", back_populates="creator")
    tasks_assigned_to = relationship("Task", foreign_keys="[Task.assigned_to]", back_populates="assignee")
    submissions = relationship("TaskSubmission", back_populates="submitter")

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    contact_name = Column(String, nullable=False)
    company_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tasks = relationship("Task", back_populates="client", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=False)
    task_type = Column(Enum(TaskType), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.pending)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    client = relationship("Client", back_populates="tasks")
    creator = relationship("User", foreign_keys=[assigned_by], back_populates="tasks_assigned_by")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="tasks_assigned_to")
    submission = relationship("TaskSubmission", back_populates="task", uselist=False, cascade="all, delete-orphan")

class FormQuestion(Base):
    __tablename__ = "form_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(String, nullable=False)
    input_type = Column(Enum(InputType), nullable=False)
    options = Column(JSON, nullable=True)  # JSON array for choices (e.g. ["A", "B"])
    is_required = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    answers = relationship("SubmissionAnswer", back_populates="question")

class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), unique=True, nullable=False)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    task = relationship("Task", back_populates="submission")
    submitter = relationship("User", back_populates="submissions")
    answers = relationship("SubmissionAnswer", back_populates="submission", cascade="all, delete-orphan")

class SubmissionAnswer(Base):
    __tablename__ = "submission_answers"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("task_submissions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("form_questions.id"), nullable=False)
    answer_value = Column(String, nullable=True)  # Answer is saved as text or stringified JSON

    # Relationships
    submission = relationship("TaskSubmission", back_populates="answers")
    question = relationship("FormQuestion", back_populates="answers")
