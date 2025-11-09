# Student Assignments API Documentation

## Overview
This API allows students to view all assignments that have been assigned to them, including assignment details, class information, submission status, and grades.

---

## 🎯 Features

### 1. **Get All My Assignments**
- View all assignments assigned to the authenticated student
- Includes assignment details, class info, and submission status
- Supports pagination, filtering, and sorting
- Automatically filters out deleted assignments

### 2. **Get Assignment Details**
- View detailed information about a specific assignment
- Includes all questions with attachments
- Shows student's answers and marks obtained
- Displays submission timeline

---

## 📡 API Endpoints

### 1. Get All Assignments for Student

**Endpoint:**
```
GET /api/student/my-assignments
```

**Authentication:** Required (Student level)

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `sortBy` - Field to sort by (e.g., 'createdAt', 'dueDate')
- `sortOrder` - Sort direction ('asc' or 'desc')
- `status` - Filter by status ('not_started', 'in_progress', 'submitted', 'graded')

**Example Request:**
```bash
GET /api/student/my-assignments?page=1&limit=10&status=not_started&sortBy=dueDate&sortOrder=asc

Headers:
Authorization: Bearer <student_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Assignments retrieved successfully",
  "data": [
    {
      "_id": "67345a1b2c3d4e5f6g7h8i9j",
      "assignment": {
        "_id": "64a1b2c3d4e5f6g7h8i9j0k1",
        "name": "Math Quiz 1",
        "description": "Basic algebra and geometry questions",
        "dueDate": "2025-11-15T23:59:59.999Z",
        "totalMarks": 100,
        "duration": 60,
        "curriculum": "Grade 10 Mathematics",
        "topic": "Algebra Basics"
      },
      "class": {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
        "name": "Math Class A",
        "classCode": "MATH-A-2025"
      },
      "status": "not_started",
      "totalMarksObtained": 0,
      "completionRate": 0,
      "startedAt": null,
      "submittedAt": null,
      "gradedAt": null,
      "createdAt": "2025-11-01T10:00:00.000Z"
    },
    {
      "_id": "67345a1b2c3d4e5f6g7h8i9k",
      "assignment": {
        "_id": "64a1b2c3d4e5f6g7h8i9j0k2",
        "name": "Science Lab Report",
        "description": "Write a report on the chemistry experiment",
        "dueDate": "2025-11-20T23:59:59.999Z",
        "totalMarks": 50,
        "duration": 120,
        "curriculum": "Grade 10 Science",
        "topic": "Chemical Reactions"
      },
      "class": {
        "_id": "64f1a2b3c4d5e6f7g8h9i0j2",
        "name": "Science Class B",
        "classCode": "SCI-B-2025"
      },
      "status": "submitted",
      "totalMarksObtained": 45,
      "completionRate": 100,
      "startedAt": "2025-11-10T14:00:00.000Z",
      "submittedAt": "2025-11-12T16:30:00.000Z",
      "gradedAt": "2025-11-13T10:00:00.000Z",
      "createdAt": "2025-11-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

---

### 2. Get Single Assignment Details

**Endpoint:**
```
GET /api/student/assignments/:id
```

**Authentication:** Required (Student level)

**Parameters:**
- `id` - StudentAssignment ID (not the Assignment ID)

**Example Request:**
```bash
GET /api/student/assignments/67345a1b2c3d4e5f6g7h8i9j

Headers:
Authorization: Bearer <student_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Assignment details retrieved successfully",
  "data": {
    "_id": "67345a1b2c3d4e5f6g7h8i9j",
    "assignment": {
      "_id": "64a1b2c3d4e5f6g7h8i9j0k1",
      "assignmentName": "Math Quiz 1",
      "description": "Basic algebra and geometry questions",
      "dueDate": "2025-11-15T23:59:59.999Z",
      "totalMarks": 100,
      "duration": 60,
      "questions": [
        {
          "_id": "q1id",
          "questionText": "Solve for x: 2x + 5 = 15",
          "questionImage": "uploads/questions/question1.jpg",
          "partialMarks": [
            {
              "step": "Correctly subtract 5",
              "marks": 2
            },
            {
              "step": "Correctly divide by 2",
              "marks": 3
            }
          ],
          "fullMarks": {
            "correctAnswer": "x = 5",
            "marks": 5
          },
          "attachments": [
            "uploads/attachments/formula_sheet.pdf"
          ]
        },
        {
          "_id": "q2id",
          "questionText": "Calculate the area of a circle with radius 7cm",
          "questionImage": null,
          "partialMarks": [],
          "fullMarks": {
            "correctAnswer": "153.94 cm²",
            "marks": 10
          },
          "attachments": []
        }
      ],
      "curriculumId": {
        "_id": "curr1",
        "name": "Grade 10 Mathematics"
      },
      "topicId": {
        "_id": "topic1",
        "name": "Algebra Basics"
      }
    },
    "class": {
      "_id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "name": "Math Class A",
      "classCode": "MATH-A-2025"
    },
    "answers": [
      {
        "questionId": "q1id",
        "answer": "x = 5",
        "marksObtained": 5,
        "submittedAt": "2025-11-12T16:30:00.000Z"
      }
    ],
    "totalMarksObtained": 5,
    "completionRate": 50,
    "status": "in_progress",
    "startedAt": "2025-11-10T14:00:00.000Z",
    "submittedAt": null,
    "gradedAt": null
  }
}
```

---

## 📊 Assignment Status Values

| Status | Description |
|--------|-------------|
| `not_started` | Assignment has been assigned but student hasn't started |
| `in_progress` | Student has started but not submitted |
| `submitted` | Student has submitted, waiting for grading |
| `graded` | Teacher has graded the submission |

---

## 🔍 Query Examples

### Get All Pending Assignments
```bash
GET /api/student/my-assignments?status=not_started&sortBy=dueDate&sortOrder=asc
```

### Get Graded Assignments Only
```bash
GET /api/student/my-assignments?status=graded&page=1&limit=5
```

### Get In-Progress Assignments
```bash
GET /api/student/my-assignments?status=in_progress
```

### Get All Assignments with Latest First
```bash
GET /api/student/my-assignments?sortBy=createdAt&sortOrder=desc
```

---

## 🛡️ Security Features

### Authentication
- All endpoints require valid student authentication token
- Student can only view their own assignments
- Deleted assignments are automatically filtered out

### Authorization
- Students can only access assignments assigned to them
- Trying to access another student's assignment returns 404

### Data Integrity
- Null/deleted assignments are filtered out automatically
- Assignment and class references are validated
- Proper error messages for missing data

---

## ⚠️ Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized access"
}
```

### 404 Not Found (Student)
```json
{
  "success": false,
  "message": "Student not found"
}
```

### 404 Not Found (Assignment)
```json
{
  "success": false,
  "message": "Assignment not found or not assigned to you"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid assignment ID"
}
```

---

## 📈 Response Data Structure

### Assignment List Item
```typescript
{
  _id: string;                    // StudentAssignment ID
  assignment: {
    _id: string;                  // Assignment ID
    name: string;                 // Assignment name
    description: string;          // Assignment description
    dueDate: Date;                // Due date
    totalMarks: number;           // Total marks
    duration: number;             // Duration in minutes
    curriculum: string;           // Curriculum name
    topic: string;                // Topic name
  };
  class: {
    _id: string;                  // Class ID
    name: string;                 // Class name
    classCode: string;            // Class code
  };
  status: string;                 // Assignment status
  totalMarksObtained: number;    // Marks obtained
  completionRate: number;         // Completion percentage
  startedAt: Date | null;         // When started
  submittedAt: Date | null;       // When submitted
  gradedAt: Date | null;          // When graded
  createdAt: Date;                // When assigned
}
```

### Assignment Details
```typescript
{
  _id: string;                    // StudentAssignment ID
  assignment: {
    _id: string;
    assignmentName: string;
    description: string;
    dueDate: Date;
    totalMarks: number;
    duration: number;
    questions: Question[];        // Array of questions
    curriculumId: {
      _id: string;
      name: string;
    };
    topicId: {
      _id: string;
      name: string;
    };
  };
  class: {
    _id: string;
    name: string;
    classCode: string;
  };
  answers: Answer[];              // Student's answers
  totalMarksObtained: number;
  completionRate: number;
  status: string;
  startedAt: Date | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
}
```

---

## 🔄 Integration Flow

### 1. Student Login
```
POST /api/auth/login
→ Receive authentication token
```

### 2. View All Assignments
```
GET /api/student/my-assignments
→ See list of all assigned assignments
```

### 3. View Assignment Details
```
GET /api/student/assignments/:id
→ See questions, marks, and submission details
```

### 4. Submit Assignment
```
(To be implemented in future)
POST /api/student/assignments/:id/submit
```

---

## 💡 Use Cases

### Use Case 1: Dashboard View
**Scenario:** Student wants to see all pending assignments on their dashboard

**Solution:**
```bash
GET /api/student/my-assignments?status=not_started&sortBy=dueDate&sortOrder=asc&limit=5
```
Shows next 5 assignments due soonest

### Use Case 2: View Past Grades
**Scenario:** Student wants to review graded assignments

**Solution:**
```bash
GET /api/student/my-assignments?status=graded&sortBy=gradedAt&sortOrder=desc
```
Shows recently graded assignments first

### Use Case 3: Continue Assignment
**Scenario:** Student wants to continue an in-progress assignment

**Solution:**
1. Get in-progress assignments:
   ```bash
   GET /api/student/my-assignments?status=in_progress
   ```
2. Get detailed questions:
   ```bash
   GET /api/student/assignments/:id
   ```

---

## 📝 Notes

- All dates are in ISO 8601 format
- Times are in UTC
- Pagination is zero-indexed (page starts from 1)
- Default sorting is by creation date (newest first)
- Deleted assignments/classes are automatically filtered out
- Question attachments are included in assignment details

---

**Last Updated:** November 7, 2025
