import uuid
from datetime import datetime
import hashlib
import json # For PatientCase placeholder

# Assuming models.py and utils.py are in the same directory or accessible in PYTHONPATH
try:
    from models import UserCaseProgress, CaseStatus #, PatientCase, User # PatientCase, User are placeholders
    from utils import generate_filter_context_hash
except ImportError:
    # This block is for environments where the files might not be in the python path directly
    # For example, if running a script directly that imports api.py
    print("Attempting to import from local files for models and utils...")
    # In a real scenario, these would be proper package imports
    # For this simulation, direct import might fail depending on execution context.
    # Fallback to defining minimal versions if not found (not ideal for production)

    class CaseStatus(str, Enum): # Re-define if import fails
        COMPLETED = "completed"
        SKIPPED = "skipped"
        IN_PROGRESS_QUEUE = "in_progress_queue"
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

        def to_dict(self): # Basic version if import fails
            return {"id": self.id, "user_id": self.user_id, "case_id": self.case_id, "status": self.status.value}


    def generate_filter_context_hash(filters: dict) -> str | None:
        if not filters: return None
        canonical_string = json.dumps(sorted(filters.items()), sort_keys=True, separators=(',', ':'))
        return hashlib.md5(canonical_string.encode('utf-8')).hexdigest()


# --- Mock Database & Session Store ---
db_user_progress: list[UserCaseProgress] = []
# Simulating a PatientCase structure, assuming it has an 'id' and filterable attributes
db_patient_cases: list[dict] = [
    {"id": "case1", "program_area": "Internal Medicine", "specialized_area": "Cardiology", "difficulty": "Intermediate", "content": "Content for Case 1"},
    {"id": "case2", "program_area": "Internal Medicine", "specialized_area": "Cardiology", "difficulty": "Advanced", "content": "Content for Case 2"},
    {"id": "case3", "program_area": "Internal Medicine", "specialized_area": "Pulmonology", "difficulty": "Intermediate", "content": "Content for Case 3"},
    {"id": "case4", "program_area": "Surgery", "specialized_area": "Orthopedics", "difficulty": "Intermediate", "content": "Content for Case 4"},
    {"id": "case5", "program_area": "Internal Medicine", "specialized_area": "Cardiology", "difficulty": "Intermediate", "content": "Content for Case 5 (duplicate criteria)"},
    {"id": "case6", "program_area": "Pediatrics", "specialized_area": "General", "difficulty": "Easy", "content": "Content for Case 6"},
    {"id": "case7", "program_area": "Internal Medicine", "specialized_area": "Cardiology", "difficulty": "Intermediate", "content": "Content for Case 7"},
]
# Simulating a User store
db_users: list[dict] = [
    {"id": "user123", "name": "Test User"},
    {"id": "user456", "name": "Another User"},
]

# Session store (e.g., would be Redis)
# Structure: { sessionId: {"user_id": str, "filter_context_hash": str, "case_ids_in_queue": list[str], "current_index": int } }
session_store: dict = {}


# --- Mock Authentication ---
def get_current_user_id_from_request(request_headers: dict) -> str | None:
    """Simulates getting user ID from auth token in request headers."""
    # In a real app, this would involve token validation, etc.
    # For simulation, let's assume a header "X-User-Id" contains the user ID.
    user_id = request_headers.get("X-User-Id")
    if user_id and any(u["id"] == user_id for u in db_users):
        return user_id
    return None

# --- API Endpoint Implementations ---

def start_queue_session(request_body: dict, headers: dict):
    """
    Endpoint 1: Initialize or Resume Queue Session
    Path: /api/users/queue/session/start (or /api/me/queue/session/start)
    Method: POST
    """
    user_id = get_current_user_id_from_request(headers)
    if not user_id:
        return {"error": "User not authenticated"}, 401

    filters = request_body.get("filters", {})

    # Basic validation for filters (can be more robust)
    if not isinstance(filters, dict):
        return {"error": "Invalid filters format"}, 400

    filter_context_hash = generate_filter_context_hash(filters)

    # 1. Identify all PatientCase IDs that match the filters.
    matched_cases = []
    for case in db_patient_cases:
        match = True
        for key, value in filters.items():
            if value is None or str(value).lower() == "null": # Handle "null" string for specialized_area
                if case.get(key) is not None and case.get(key) != "": # If filter is "null", case field should be null/empty
                    match = False
                    break
            elif case.get(key) != value:
                match = False
                break
        if match:
            matched_cases.append(case)

    # 2. Exclude cases that have a user_case_progress record for the current user_id
    #    and matching filter_context_hash with status completed or skipped.
    progress_to_exclude = set()
    for progress in db_user_progress:
        if progress.user_id == user_id and \
           progress.filter_context_hash == filter_context_hash and \
           (progress.status == CaseStatus.COMPLETED or progress.status == CaseStatus.SKIPPED):
            progress_to_exclude.add(progress.case_id)

    active_queue_cases = [case for case in matched_cases if case["id"] not in progress_to_exclude]

    # 3. Order the remaining cases (default: by case ID for now)
    active_queue_cases.sort(key=lambda c: c["id"]) # Simple sort by ID

    current_case_obj = None
    current_case_index = -1

    # 4. Check if there's a case marked in_progress_queue for this user and filter_context_hash.
    #    If so, this should be the currentCase.
    #    Also, mark any previous in_progress_queue (if any for this context) as viewed_in_queue.
    resumed_case_id = None
    for i, progress_record in enumerate(db_user_progress):
        if progress_record.user_id == user_id and \
           progress_record.filter_context_hash == filter_context_hash and \
           progress_record.status == CaseStatus.IN_PROGRESS_QUEUE:
            # Mark this old one as viewed_in_queue because we are starting a new session
            # or potentially picking a new case if this one is no longer valid.
            # The spec says "Mark the previous in_progress_queue ... as viewed_in_queue"
            # This implies a new session always starts, or if resuming, we ensure the old marker is cleared.
            # For simplicity, if we find one, we'll try to resume with it.
            # The spec: "If so, this should be the currentCase."

            # Find this case in the current active_queue_cases
            for idx, case_in_q in enumerate(active_queue_cases):
                if case_in_q["id"] == progress_record.case_id:
                    resumed_case_id = progress_record.case_id
                    current_case_obj = case_in_q
                    current_case_index = idx
                    # We will update its status to IN_PROGRESS_QUEUE again later for the new session
                    # but first, ensure any OTHER in_progress for this context is cleared/viewed.
                    # This is a bit tricky. The spec: "Mark the previous in_progress_queue ... as viewed_in_queue"
                    # "Mark the new currentCase as in_progress_queue"
                    # This means if we find one, we should use it. But if multiple somehow exist, pick one and update others.
                    # For now, assume only one IN_PROGRESS_QUEUE exists per user/context.
                    break
            if current_case_obj: # Found the case to resume with
                 # Remove it from its current position to place it at the start of the "to-be-processed" part of the queue
                 # for the purpose of this function, then it will be selected as current.
                 # However, the spec says "this should be the currentCase", implying its position is preserved.
                 # Let's keep its position.
                break

    if not current_case_obj and active_queue_cases:
        # 5. If no in_progress_queue case, the first case in the ordered list becomes the currentCase.
        current_case_obj = active_queue_cases[0]
        current_case_index = 0

    # 6. Generate a new unique sessionId
    session_id = str(uuid.uuid4())

    # 7. Store session details
    # The full list of case IDs for this session (ordered)
    session_case_ids = [case["id"] for case in active_queue_cases]
    session_store[session_id] = {
        "user_id": user_id,
        "filter_context_hash": filter_context_hash,
        "case_ids_in_queue": session_case_ids, # Full list for this session
        "original_filter_criteria": filters # Store for reference/debugging
    }

    # 8. Mark the previous in_progress_queue (if any for this context) as viewed_in_queue
    #    This step is nuanced. If we found a case to resume (resumed_case_id), we don't want to mark IT as viewed_in_queue.
    #    We want to mark OTHERS that might have been IN_PROGRESS_QUEUE.
    #    Let's iterate and update any that are NOT the current_case_obj.
    for progress_record in db_user_progress:
        if progress_record.user_id == user_id and \
           progress_record.filter_context_hash == filter_context_hash and \
           progress_record.status == CaseStatus.IN_PROGRESS_QUEUE:
            if current_case_obj and progress_record.case_id != current_case_obj["id"]:
                progress_record.status = CaseStatus.VIEWED_IN_QUEUE # Or some other status like "superseded"
                progress_record.last_updated_at = datetime.utcnow()
            elif not current_case_obj: # No current case, so any in_progress is now old
                progress_record.status = CaseStatus.VIEWED_IN_QUEUE
                progress_record.last_updated_at = datetime.utcnow()


    # 9. Mark the new currentCase as in_progress_queue in user_case_progress
    if current_case_obj:
        # Find if a progress record exists for this case, user, context
        existing_progress = None
        for record in db_user_progress:
            if record.user_id == user_id and \
               record.case_id == current_case_obj["id"] and \
               record.filter_context_hash == filter_context_hash:
                existing_progress = record
                break

        if existing_progress:
            existing_progress.status = CaseStatus.IN_PROGRESS_QUEUE
            existing_progress.session_id = session_id # Link to this new session
            existing_progress.last_updated_at = datetime.utcnow()
        else:
            new_progress = UserCaseProgress(
                user_id=user_id,
                case_id=current_case_obj["id"],
                status=CaseStatus.IN_PROGRESS_QUEUE,
                filter_context_hash=filter_context_hash,
                session_id=session_id
            )
            db_user_progress.append(new_progress)

    # Response
    response_body = {
        "sessionId": session_id,
        "currentCase": current_case_obj, # This is the full case object as per spec
        "queuePosition": current_case_index if current_case_obj else -1, # 0-indexed
        "totalInQueue": len(active_queue_cases)
    }

    if not active_queue_cases: # If queue is empty
        response_body["currentCase"] = None
        # queuePosition remains -1 or could be 0 if totalInQueue is 0. Spec implies 0 for first item.

    return response_body, 200 if current_case_obj else 200 # 201 could also be used


# Placeholder for PatientCase model if not imported
class PatientCase:
    def __init__(self, id: str, program_area: str = None, specialized_area: str = None, difficulty: str = None, content: str = "Case content"):
        self.id = id
        self.program_area = program_area
        self.specialized_area = specialized_area
        self.difficulty = difficulty
        self.content = content

    def to_dict(self): # Ensure PatientCase objects can be serialized if they are custom objects
        return {
            "id": self.id,
            "program_area": self.program_area,
            "specialized_area": self.specialized_area,
            "difficulty": self.difficulty,
            "content": self.content
        }

# Ensure db_patient_cases contains dicts or objects with a to_dict method
# For this simulation, db_patient_cases already contains dicts.

print("api.py created with initial structure and start_queue_session endpoint.")
# Further endpoints (get_next_case, mark_case_status) will be added to this file.

# --- Helper to get a case by ID (simulates DB query) ---
def _get_case_by_id(case_id: str) -> dict | None:
    for case in db_patient_cases:
        if case["id"] == case_id:
            return case
    return None

# --- Endpoint 2: Get Next Case in Queue Session ---
def get_next_case_in_session(session_id: str, request_body: dict, headers: dict):
    """
    Endpoint 2: Get Next Case in Queue Session
    Path: /api/users/queue/session/{sessionId}/next
    Method: POST
    """
    user_id = get_current_user_id_from_request(headers)
    if not user_id:
        return {"error": "User not authenticated"}, 401

    session_data = session_store.get(session_id)
    if not session_data or session_data["user_id"] != user_id:
        return {"error": "Session ID invalid or access denied"}, 404 # 401 or 403 could also fit for access denied

    # Update status of the previous case, if provided
    previous_case_id = request_body.get("previousCaseId")
    previous_case_status_str = request_body.get("previousCaseStatus")

    if previous_case_id and previous_case_status_str:
        try:
            # Ensure status is one of the allowed ones for this operation
            # The spec says "completed", "skipped", or "viewed"
            # "viewed" could mean it wasn't fully actioned, so it's not IN_PROGRESS_QUEUE anymore for this session pass
            # but not yet globally completed/skipped for the context.
            if previous_case_status_str not in [CaseStatus.COMPLETED.value, CaseStatus.SKIPPED.value, "viewed"]:
                 raise ValueError("Invalid status for previous case")

            previous_case_status = CaseStatus(previous_case_status_str) if previous_case_status_str != "viewed" else CaseStatus.VIEWED_IN_QUEUE # Map "viewed" if needed

            # Update in user_case_progress
            updated = False
            for progress_record in db_user_progress:
                if progress_record.user_id == user_id and \
                   progress_record.case_id == previous_case_id and \
                   progress_record.filter_context_hash == session_data["filter_context_hash"]:
                    progress_record.status = previous_case_status
                    progress_record.last_updated_at = datetime.utcnow()
                    # If completed/skipped, it will be excluded next time this queue is initiated.
                    # If viewed_in_queue, it might depend on specific logic if it reappears or not.
                    # For now, assume VIEWED_IN_QUEUE means it's done for this pass but not for the whole context.
                    updated = True
                    break
            if not updated:
                # Create a new progress record if one didn't exist (e.g., if user just "viewed" a case not previously interacted with)
                new_progress = UserCaseProgress(
                    user_id=user_id,
                    case_id=previous_case_id,
                    status=previous_case_status,
                    filter_context_hash=session_data["filter_context_hash"],
                    session_id=session_id # Link to this session
                )
                db_user_progress.append(new_progress)
        except ValueError:
            return {"error": f"Invalid status value: {previous_case_status_str}"}, 400


    # Determine the current index of previousCaseId in the session's queue
    # This requires knowing which case was "current" before this call.
    # The session_store needs to track current_index or last_served_case_id for the session.
    # The start_queue_session currently sets currentCase and queuePosition in response, but doesn't store index in session_store.
    # Let's modify session_store to include 'current_case_id_in_session' or 'current_idx_in_session_list'

    # Let's assume `session_store[session_id]` now also stores `last_served_case_id`
    # Or, more robustly, let's find the index of `previousCaseId` in `case_ids_in_queue`

    current_known_idx = -1
    if previous_case_id and previous_case_id in session_data["case_ids_in_queue"]:
        current_known_idx = session_data["case_ids_in_queue"].index(previous_case_id)

    # If previousCaseId was not provided, or not found, we need a way to know where we are.
    # This implies the session MUST store its current position.
    # Let's add `current_queue_index` to session_store, initialized by `start_queue_session`.
    # For now, let's simulate it was updated by start_queue_session. If not, we assume we start from current_known_idx + 1.

    # Re-fetch session data as it might be updated by another process (though not in this sync simulation)
    session_data = session_store[session_id]

    # Let's assume 'current_progress_idx' is maintained in session_data by start_queue_session and here.
    # It would be the index of the case that was last served or is currently "in_progress_queue" for this session.

    # Find the *actual* current in_progress_queue item for this session to determine starting point
    # This is more robust if client doesn't send previousCaseId or if state is lost.
    last_in_progress_case_id_for_session = None
    for p in db_user_progress:
        if p.session_id == session_id and p.status == CaseStatus.IN_PROGRESS_QUEUE and p.user_id == user_id :
            last_in_progress_case_id_for_session = p.case_id
            if p.case_id == previous_case_id and previous_case_status_str in [CaseStatus.COMPLETED.value, CaseStatus.SKIPPED.value]:
                 # The case that was just completed/skipped was the one marked IN_PROGRESS_QUEUE
                 # So we need to advance from its position.
                 pass
            break # Assume only one case is IN_PROGRESS_QUEUE per session

    start_search_idx = 0
    if last_in_progress_case_id_for_session and last_in_progress_case_id_for_session in session_data["case_ids_in_queue"]:
        start_search_idx = session_data["case_ids_in_queue"].index(last_in_progress_case_id_for_session) + 1
    elif previous_case_id and previous_case_id in session_data["case_ids_in_queue"]: # Fallback if no IN_PROGRESS_QUEUE found for session
        start_search_idx = session_data["case_ids_in_queue"].index(previous_case_id) + 1


    next_case_obj = None
    next_case_idx_in_session_list = -1

    for i in range(start_search_idx, len(session_data["case_ids_in_queue"])):
        potential_next_case_id = session_data["case_ids_in_queue"][i]

        # Check its status in user_case_progress for this context
        is_completed_or_skipped = False
        for progress_record in db_user_progress:
            if progress_record.user_id == user_id and \
               progress_record.case_id == potential_next_case_id and \
               progress_record.filter_context_hash == session_data["filter_context_hash"] and \
               (progress_record.status == CaseStatus.COMPLETED or progress_record.status == CaseStatus.SKIPPED):
                is_completed_or_skipped = True
                break

        if not is_completed_or_skipped:
            next_case_obj_dict = _get_case_by_id(potential_next_case_id)
            if next_case_obj_dict: # Should always be true if IDs are consistent
                next_case_obj = next_case_obj_dict # Spec says full PatientCase object
                next_case_idx_in_session_list = i
                break

    # Update IN_PROGRESS_QUEUE status
    # Clear old IN_PROGRESS_QUEUE for this session
    for p_record in db_user_progress:
        if p_record.session_id == session_id and p_record.status == CaseStatus.IN_PROGRESS_QUEUE and p_record.user_id == user_id:
            # What status should it become? If it wasn't the previous_case_id that got completed/skipped,
            # then it was implicitly "skipped over" or "viewed".
            if previous_case_id and p_record.case_id == previous_case_id and previous_case_status_str in [CaseStatus.COMPLETED.value, CaseStatus.SKIPPED.value, "viewed"]:
                # This was handled by the previousCaseStatus update logic already.
                pass
            else: # Mark as viewed or some other transient status.
                p_record.status = CaseStatus.VIEWED_IN_QUEUE
                p_record.last_updated_at = datetime.utcnow()

    if next_case_obj:
        # Mark the new currentCase as in_progress_queue in user_case_progress for this session
        updated_progress = False
        for record in db_user_progress:
            if record.user_id == user_id and \
               record.case_id == next_case_obj["id"] and \
               record.filter_context_hash == session_data["filter_context_hash"]:
                record.status = CaseStatus.IN_PROGRESS_QUEUE
                record.session_id = session_id # Ensure it's linked to this session
                record.last_updated_at = datetime.utcnow()
                updated_progress = True
                break
        if not updated_progress:
            new_progress = UserCaseProgress(
                user_id=user_id,
                case_id=next_case_obj["id"],
                status=CaseStatus.IN_PROGRESS_QUEUE,
                filter_context_hash=session_data["filter_context_hash"],
                session_id=session_id
            )
            db_user_progress.append(new_progress)

    if not next_case_obj: # End of queue
        return {
            "currentCase": None,
            "queuePosition": -1, # Or len(session_data["case_ids_in_queue"]) to indicate end
            "totalInQueue": len(session_data["case_ids_in_queue"])
        }, 200 # OK, but queue ended

    return {
        "currentCase": next_case_obj,
        "queuePosition": next_case_idx_in_session_list,
        "totalInQueue": len(session_data["case_ids_in_queue"])
    }, 200


# --- Endpoint 3: Mark Case Interaction Status ---
def mark_case_interaction_status(case_id: str, request_body: dict, headers: dict):
    """
    Endpoint 3: Mark Case Interaction Status
    Path: /api/users/cases/{caseId}/status
    Method: POST
    """
    user_id = get_current_user_id_from_request(headers)
    if not user_id:
        return {"error": "User not authenticated"}, 401

    target_case = _get_case_by_id(case_id)
    if not target_case:
        return {"error": "Case ID not found"}, 404

    status_str = request_body.get("status")
    filter_context_from_request = request_body.get("filterContext") # Optional
    session_id_from_request = request_body.get("sessionId") # Optional, to link

    if not status_str or status_str not in [CaseStatus.COMPLETED.value, CaseStatus.SKIPPED.value]:
        return {"error": "Invalid status. Must be 'completed' or 'skipped'."}, 400

    status_enum = CaseStatus(status_str)

    # Calculate filter_context_hash if filterContext is provided
    # If not provided, the spec implies this status update is "global" for the user and case,
    # meaning filter_context_hash would be None or a special global value.
    # "If not used, completion/skipping is global for the user and case."
    filter_context_hash_for_status = None
    if filter_context_from_request is not None: # Allow empty dict for "all filters off" context
        if not isinstance(filter_context_from_request, dict):
             return {"error": "Invalid filterContext format"}, 400
        filter_context_hash_for_status = generate_filter_context_hash(filter_context_from_request)

    # Create or update a record in user_case_progress
    existing_record = None
    for record in db_user_progress:
        if record.user_id == user_id and \
           record.case_id == case_id and \
           record.filter_context_hash == filter_context_hash_for_status: # Match context
            existing_record = record
            break

    if existing_record:
        existing_record.status = status_enum
        existing_record.last_updated_at = datetime.utcnow()
        if session_id_from_request: # Optionally update session_id if provided
            existing_record.session_id = session_id_from_request
    else:
        new_record = UserCaseProgress(
            user_id=user_id,
            case_id=case_id,
            status=status_enum,
            filter_context_hash=filter_context_hash_for_status,
            session_id=session_id_from_request # Optional
        )
        db_user_progress.append(new_record)

    # If status is completed or skipped, ensure any in_progress_queue status for this case
    # (and context, if provided, otherwise for any context) is cleared or superseded.
    if status_enum == CaseStatus.COMPLETED or status_enum == CaseStatus.SKIPPED:
        for record in db_user_progress:
            if record.user_id == user_id and \
               record.case_id == case_id and \
               record.status == CaseStatus.IN_PROGRESS_QUEUE:
                # If filter_context_hash_for_status is defined, only clear IN_PROGRESS_QUEUE for that specific context.
                # Otherwise (global update), clear IN_PROGRESS_QUEUE for this case regardless of its original context.
                if filter_context_hash_for_status is None or record.filter_context_hash == filter_context_hash_for_status:
                    # This record itself might be the one we just updated.
                    # If it was IN_PROGRESS_QUEUE and is now COMPLETED/SKIPPED, that's fine.
                    # If another record for the same case/user (but maybe different context or session) was IN_PROGRESS_QUEUE,
                    # it should NOT be cleared unless the update was global (filter_context_hash_for_status is None).
                    if record != existing_record : # only if it's a different record object
                         if filter_context_hash_for_status is None: # Global update, clear any IN_PROGRESS
                            record.status = CaseStatus.VIEWED_IN_QUEUE # Or some other non-active status
                            record.last_updated_at = datetime.utcnow()
                         # If context specific, the main update loop already handled it.

    return {"message": "Case status updated successfully."}, 200


print("api.py updated with all three endpoint stubs and initial logic.")

# Example Usage (Conceptual - you would call these via HTTP requests)

# Setup:
# Ensure UserCaseProgress, CaseStatus, generate_filter_context_hash are available.
# Ensure db_patient_cases, db_users are populated.

# Test start_queue_session
# print("\n--- Test start_queue_session ---")
# user1_headers = {"X-User-Id": "user123"}
# filters_im_cardio_int = {
#     "filters": {
#         "program_area": "Internal Medicine",
#         "specialized_area": "Cardiology",
#         "difficulty": "Intermediate"
#     }
# }
# response, status = start_queue_session(filters_im_cardio_int, user1_headers)
# print(f"Start Session Response (Status {status}):")
# # print(json.dumps(response, indent=2))
# # current_session_id = response.get("sessionId") if status == 200 else None

# # Simulate completing one case via mark_case_interaction_status
# # if current_session_id and response.get("currentCase"):
# #     current_case_id_to_mark = response["currentCase"]["id"]
# #     print(f"\n--- Marking case {current_case_id_to_mark} as completed ---")
# #     mark_request_body = {
# #         "status": "completed",
# #         "filterContext": filters_im_cardio_int["filters"]
# #     }
# #     mark_response, mark_status = mark_case_interaction_status(current_case_id_to_mark, mark_request_body, user1_headers)
# #     print(f"Mark Status Response (Status {mark_status}): {mark_response}")

#     # print("\nUser Progress after marking:")
#     # for p in db_user_progress: print(p.to_dict())


# # Test get_next_case_in_session
# # if current_session_id and response.get("currentCase"):
# #     prev_case_id = response["currentCase"]["id"]
# #     print(f"\n--- Test get_next_case_in_session (Session: {current_session_id}) ---")
# #     next_case_request_body = {
# #         "previousCaseId": prev_case_id,
# #         "previousCaseStatus": "completed" # This case was just marked above, or could be marked here
# #     }
# #     next_response, next_status = get_next_case_in_session(current_session_id, next_case_request_body, user1_headers)
# #     print(f"Next Case Response (Status {next_status}):")
#     # print(json.dumps(next_response, indent=2))

#     # print("\nUser Progress after next_case:")
#     # for p in db_user_progress: print(p.to_dict())
#     # print("\nSession store:")
#     # print(json.dumps(session_store.get(current_session_id), indent=2))

# # Test starting same queue again to see if completed case is excluded
# # print("\n--- Test re-starting the same queue session ---")
# # response2, status2 = start_queue_session(filters_im_cardio_int, user1_headers)
# # print(f"Re-Start Session Response (Status {status2}):")
# # print(json.dumps(response2, indent=2))
# # if response2.get("currentCase"):
# #     assert response2["currentCase"]["id"] != prev_case_id, "Completed case should not be current."
# # else:
# #     print("Queue might be empty or behavior needs check.")


# # Test global skip
# # print("\n--- Test global skip for case1 ---")
# # global_skip_body = {"status": "skipped"} # No filterContext
# # skip_resp, skip_stat = mark_case_interaction_status("case1", global_skip_body, user1_headers)
# # print(f"Global Skip Response (Status {skip_stat}): {skip_resp}")

# # print("\nUser Progress after global skip:")
# # for p in db_user_progress:
# #     if p.case_id == "case1": print(p.to_dict())

# # print("\n--- Test starting queue where case1 would appear, after global skip ---")
# # filters_for_case1 = {
# #     "filters": {
# #         "program_area": "Internal Medicine", # case1 is IM, Cardio, Int
# #         "specialized_area": "Cardiology",
# #         "difficulty": "Intermediate"
# #     }
# # }
# # resp_after_global_skip, stat_ags = start_queue_session(filters_for_case1, user1_headers)
# # print(f"Queue after global skip of case1 (Status {stat_ags}):")
# # print(json.dumps(resp_after_global_skip, indent=2))
# # if resp_after_global_skip.get("currentCase"):
# #    assert resp_after_global_skip["currentCase"]["id"] != "case1", "Globally skipped case1 should not appear."
# #    print("Assertion: case1 correctly excluded after global skip.")
# # elif any(c["id"] == "case1" for c in resp_after_global_skip.get("totalInQueue", [])): # totalInQueue is just a number
# #    # Need to check the actual queue list if possible, or the logic for exclusion
# #    pass


# # Clean up for next potential run if needed (manual for now)
# # db_user_progress.clear()
# # session_store.clear()
