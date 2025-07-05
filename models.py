import uuid
from datetime import datetime
from enum import Enum

class CaseStatus(Enum):
    COMPLETED = "completed"
    SKIPPED = "skipped"
    IN_PROGRESS_QUEUE = "in_progress_queue"
    # A possible status for cases that were in_progress_queue but the user started a new session
    # or advanced in the queue without explicitly completing/skipping the previous one.
    VIEWED_IN_QUEUE = "viewed_in_queue"

class UserCaseProgress:
    def __init__(self, user_id: str, case_id: str, status: CaseStatus,
                 filter_context_hash: str = None, session_id: str = None, id: str = None,
                 last_updated_at: datetime = None):
        self.id = id if id else str(uuid.uuid4())
        self.user_id = user_id
        self.case_id = case_id
        self.status = status
        self.filter_context_hash = filter_context_hash
        self.session_id = session_id
        self.last_updated_at = last_updated_at if last_updated_at else datetime.utcnow()

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "case_id": self.case_id,
            "status": self.status.value,
            "filter_context_hash": self.filter_context_hash,
            "session_id": self.session_id,
            "last_updated_at": self.last_updated_at.isoformat() if self.last_updated_at else None
        }

    @classmethod
    def from_dict(cls, data: dict):
        return cls(
            user_id=data.get("user_id"),
            case_id=data.get("case_id"),
            status=CaseStatus(data.get("status")) if data.get("status") else None,
            filter_context_hash=data.get("filter_context_hash"),
            session_id=data.get("session_id"),
            id=data.get("id"),
            last_updated_at=datetime.fromisoformat(data.get("last_updated_at")) if data.get("last_updated_at") else None
        )

# Placeholder for existing models (assuming they exist elsewhere)
# class User:
#     def __init__(self, id: str, name: str):
#         self.id = id
#         self.name = name

# class PatientCase:
#     def __init__(self, id: str, program_area: str = None, specialized_area: str = None, difficulty: str = None, content: str = "Case content"):
#         self.id = id
#         self.program_area = program_area
#         self.specialized_area = specialized_area
#         self.difficulty = difficulty
#         self.content = content # Example field

#     def to_dict(self):
#         return {
#             "id": self.id,
#             "program_area": self.program_area,
#             "specialized_area": self.specialized_area,
#             "difficulty": self.difficulty,
#             "content": self.content
#         }

# Example of how it might be used if we had a DB access layer
# db_user_progress = [] # In-memory list to simulate DB for now
# db_cases = [
#     PatientCase(id="case1", program_area="IM", specialized_area="Cardio", difficulty="Easy"),
#     PatientCase(id="case2", program_area="IM", specialized_area="Cardio", difficulty="Medium"),
#     PatientCase(id="case3", program_area="IM", specialized_area="Pulmo", difficulty="Easy"),
#     PatientCase(id="case4", program_area="Surgery", specialized_area="Ortho", difficulty="Hard"),
# ]
# db_users = [User(id="user1", name="Alice")]

print("models.py created with UserCaseProgress and CaseStatus.")
