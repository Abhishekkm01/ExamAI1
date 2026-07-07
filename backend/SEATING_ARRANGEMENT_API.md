# Seating Arrangement API Documentation

## Overview

The seating arrangement system provides automatic and manual seating allocation for exams. It supports multiple arrangement strategies and integrates with the hall ticket generation system.

## Features

- **Room Management**: Create, update, and manage exam rooms with capacity and layout information
- **Automatic Seating**: Multiple strategies (sequential, department-based, alphabetical, random)
- **Manual Seating**: Override automatic assignments with custom seat allocations
- **Visual Layout**: View room layouts with student assignments
- **Hall Ticket Integration**: Seating information automatically included in hall tickets

## Data Models

### SeatingRoom
Represents a physical exam room with seating capacity and layout.

**Fields:**
- `room_code`: Unique identifier (e.g., "R101")
- `room_name`: Display name (e.g., "Main Hall")
- `building`: Building name (optional)
- `floor`: Floor number (default: 1)
- `capacity`: Total seating capacity (default: 60)
- `rows`: Number of rows (default: 10)
- `columns`: Number of columns (default: 6)
- `has_projector`: Whether room has projector
- `has_ac`: Whether room has AC
- `is_active`: Active status

### SeatingArrangement
Tracks seating assignments for exams.

**Fields:**
- `exam`: Related exam
- `room`: Assigned room
- `student`: Assigned student
- `seat_row`: Row number (0-indexed)
- `seat_column`: Column number (0-indexed)
- `seat_number`: Seat identifier (e.g., "A1", "B2")
- `arrangement_type`: 'auto' or 'manual'
- `is_confirmed`: Confirmation status

## API Endpoints

### Room Management

#### List All Rooms
```
GET /api/seating/rooms
```
**Response:** Array of SeatingRoom objects

#### Create Room
```
POST /api/seating/rooms/create
```
**Body:**
```json
{
  "room_code": "R101",
  "room_name": "Main Hall",
  "building": "Academic Block A",
  "floor": 2,
  "capacity": 60,
  "rows": 10,
  "columns": 6,
  "has_projector": true,
  "has_ac": true
}
```

#### Get Room Details
```
GET /api/seating/rooms/{room_id}
```

#### Update Room
```
PUT /api/seating/rooms/{room_id}/update
```
**Body:** Partial update of room fields

#### Delete Room
```
DELETE /api/seating/rooms/{room_id}/delete
```
Note: Soft delete (sets is_active to false)

### Seating Arrangement

#### List Arrangements
```
GET /api/seating/arrangements?exam_id={id}&room_id={id}
```
**Query Parameters:**
- `exam_id` (optional): Filter by exam
- `room_id` (optional): Filter by room

#### Automatic Seating
```
POST /api/seating/arrangements/auto
```
**Body:**
```json
{
  "exam_id": 1,
  "room_ids": [1, 2, 3],
  "arrangement_strategy": "sequential",
  "leave_empty_seats": false,
  "seats_between_students": 0
}
```

**Arrangement Strategies:**
- `sequential`: Fill seats in order across rooms
- `department`: Group students by department
- `alphabetical`: Sort students by name
- `random`: Random assignment

**Options:**
- `leave_empty_seats`: Leave gaps between students
- `seats_between_students`: Number of empty seats between students (0-2)

#### Manual Seating
```
POST /api/seating/arrangements/manual
```
**Body:**
```json
{
  "exam_id": 1,
  "arrangements": [
    {
      "student_id": 1,
      "room_id": 1,
      "seat_row": 0,
      "seat_column": 0,
      "seat_number": "A1"
    },
    {
      "student_id": 2,
      "room_id": 1,
      "seat_row": 0,
      "seat_column": 1,
      "seat_number": "A2"
    }
  ]
}
```

#### Update Arrangement
```
PUT /api/seating/arrangements/{arrangement_id}
```
**Body:** Partial update of arrangement fields

#### Delete Arrangement
```
DELETE /api/seating/arrangements/{arrangement_id}/delete
```

#### Get Room Layout
```
GET /api/seating/rooms/{room_id}/layout?exam_id={id}
```
**Query Parameters:**
- `exam_id` (optional): Include student assignments for specific exam

**Response:**
```json
{
  "room": "R101",
  "room_name": "Main Hall",
  "rows": 10,
  "columns": 6,
  "layout": [
    [
      {
        "row": 0,
        "column": 0,
        "seat_number": "A1",
        "occupied": true,
        "student": {
          "id": 1,
          "name": "John Doe",
          "roll_no": "CS001"
        }
      },
      {
        "row": 0,
        "column": 1,
        "seat_number": "A2",
        "occupied": false,
        "student": null
      }
    ]
  ]
}
```

#### Confirm Arrangements
```
POST /api/seating/arrangements/confirm
```
**Body:**
```json
{
  "exam_id": 1
}
```
Marks all arrangements for an exam as confirmed.

### Student Endpoints

#### Get Student Seating
```
GET /api/seating/student/seating?exam_id={id}
```
Returns seating arrangements for the logged-in student.

## Usage Examples

### Example 1: Create Rooms and Auto-Assign

```bash
# Create rooms
curl -X POST http://localhost:8000/api/seating/rooms/create \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "room_code": "R101",
    "room_name": "Main Hall",
    "capacity": 60,
    "rows": 10,
    "columns": 6
  }'

# Auto-assign seating
curl -X POST http://localhost:8000/api/seating/arrangements/auto \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "room_ids": [1],
    "arrangement_strategy": "department"
  }'
```

### Example 2: Manual Seating Override

```bash
curl -X POST http://localhost:8000/api/seating/arrangements/manual \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": 1,
    "arrangements": [
      {
        "student_id": 5,
        "room_id": 1,
        "seat_row": 2,
        "seat_column": 3,
        "seat_number": "C4"
      }
    ]
  }'
```

### Example 3: View Room Layout

```bash
curl -X GET "http://localhost:8000/api/seating/rooms/1/layout?exam_id=1" \
  -H "Authorization: Bearer {token}"
```

## Integration with Hall Tickets

When hall tickets are generated, the system automatically:
1. Checks if a student has a seating arrangement
2. Uses the seating arrangement information (seat number, room name)
3. Includes seating details in the hall ticket QR code
4. Falls back to default seating if no arrangement exists

**Hall ticket QR code format with seating:**
```
HT:HT2026CS001|Roll:CS001|Exam:CS101|Seat:A1|Room:R101
```

## Best Practices

1. **Room Setup**: Create rooms with appropriate capacity before arranging seating
2. **Strategy Selection**: Use department-based strategy for large exams with multiple departments
3. **Confirmation**: Always confirm arrangements before generating hall tickets
4. **Layout Review**: Use the layout endpoint to verify assignments before confirmation
5. **Manual Overrides**: Use manual arrangement for special accommodations (e.g., wheelchair access)

## Error Handling

- **400 Bad Request**: Invalid input data
- **403 Forbidden**: User lacks admin privileges
- **404 Not Found**: Room, exam, or student not found
- **409 Conflict**: Student already has seating for the exam

## Notes

- Seating arrangements are unique per student per exam
- Deleting a room soft-deletes it (sets is_active to false)
- Hall tickets use confirmed seating arrangements
- The system supports multiple rooms for a single exam
