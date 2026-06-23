from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from .models import UserRole, TaskType, TaskStatus, InputType

# Authentication Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenSchema(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    manager_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

# Client Schemas
class ClientBase(BaseModel):
    contact_name: str
    company_name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    pass

class ClientResponse(ClientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Task Schemas
class TaskCreate(BaseModel):
    client_id: int
    assigned_to: int
    task_type: TaskType
    scheduled_at: datetime

class TaskResponse(BaseModel):
    id: int
    client_id: int
    assigned_by: int
    assigned_to: int
    task_type: TaskType
    scheduled_at: datetime
    status: TaskStatus
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Form Question Schemas
class QuestionCreate(BaseModel):
    question_text: str
    input_type: InputType
    options: Optional[List[str]] = None
    is_required: bool = False
    is_active: bool = True

class QuestionResponse(BaseModel):
    id: int
    question_text: str
    input_type: InputType
    options: Optional[List[str]] = None
    is_required: bool
    is_active: bool

    class Config:
        from_attributes = True

# Submission Schemas
class AnswerSubmit(BaseModel):
    question_id: int
    answer_value: str

class FormSubmit(BaseModel):
    answers: List[AnswerSubmit]

# Executive Performance Metrics
class ExecutiveMetric(BaseModel):
    id: int
    name: str
    completed_tasks: int
    pending_tasks: int

# Analytics Respone
class ManagerAnalyticsResponse(BaseModel):
    total_completed_visits: int
    total_completed_calls: int
    total_pending_tasks: int
    executive_performance: List[ExecutiveMetric]
