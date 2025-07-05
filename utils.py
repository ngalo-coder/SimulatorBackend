import hashlib
import json

def generate_filter_context_hash(filters: dict) -> str | None:
    """
    Generates a stable MD5 hash for a dictionary of filter criteria.
    Returns None if filters is None or empty.
    """
    if not filters:
        return None

    # Sort the filter dictionary by keys to ensure consistent hash for the same filters
    # regardless of their initial order.
    # Convert all values to string to handle potential "null" strings or other types consistently.
    sorted_filter_items = sorted(filters.items())

    # Create a canonical string representation
    # Example: 'difficulty:Intermediate;program_area:Internal Medicine;specialized_area:Cardiology'
    # Using json.dumps on sorted items provides a very stable representation,
    # especially for nested structures if filters were to become more complex.
    # We ensure keys are sorted and use a compact separator.
    canonical_string = json.dumps(sorted_filter_items, sort_keys=True, separators=(',', ':'))

    return hashlib.md5(canonical_string.encode('utf-8')).hexdigest()

# Example Usage:
# filters1 = {
#     "program_area": "Internal Medicine",
#     "specialized_area": "Cardiology",
#     "difficulty": "Intermediate"
# }
# filters2 = {
#     "difficulty": "Intermediate",
#     "program_area": "Internal Medicine",
#     "specialized_area": "Cardiology" # Order changed
# }
# filters3 = {
#     "program_area": "Internal Medicine",
#     "specialized_area": "Cardiology" # One filter less
# }
# filters4 = {
#     "program_area": "Internal Medicine",
#     "specialized_area": "null", # "null" string as per spec
#     "difficulty": "Intermediate"
# }

# hash1 = generate_filter_context_hash(filters1)
# hash2 = generate_filter_context_hash(filters2) # Should be same as hash1
# hash3 = generate_filter_context_hash(filters3) # Should be different
# hash4 = generate_filter_context_hash(filters4) # Should be different from others

# print(f"Hash 1: {hash1}")
# print(f"Hash 2: {hash2}")
# print(f"Hash 3: {hash3}")
# print(f"Hash 4: {hash4}")
# print(f"Hash for None: {generate_filter_context_hash(None)}")
# print(f"Hash for empty dict: {generate_filter_context_hash({})}")

print("utils.py created with generate_filter_context_hash function.")
