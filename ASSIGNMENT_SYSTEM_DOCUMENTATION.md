# Assignment System Documentation

## Overview
This document describes the complete assignment management system that allows teachers to manage assignments in classes and assign them to students.

---

## ✅ Features Implemented

### 1. **Assignment Management**
- Create assignments globally
- Add assignments to classes
- Assign assignments to specific students within a class
- Remove assignments from classes
- Delete assignments globally (cascades to all classes and students)

### 2. **Student Assignment Tracking**
- Each student gets a `StudentAssignment` record when assigned
- Tracks: status, answers, marks, completion rate
- Automatically created when assignment is added to class or assigned to specific students
- Automatically deleted when assignment is removed

### 3. **Cascading Deletions**
- When assignment is removed from a class → All student assignments for that class are deleted
- When assignment is deleted globally → Removed from all classes and all student assignments deleted

---

## 🔧 API Endpoints

### 1. **Add Assignment to Class (Assigns to ALL active students)**
```
POST /api/class/:classId/assignments
```

**Request Body:**
```json
{
  "assignmentId": "64f1a2b3c4d5e6f7g8h9i0j1"
}
```

**What it does:**
- Adds assignment to the class
- Creates `StudentAssignment` for ALL active students in the class
- Sends notifications to all students

**Response:**
```json
{
  "success": true,
  "message": "Assignment added to class successfully",
  "data": {
    "_id": "assignment_id",
    "assignmentName": "Math Quiz",
    "classId": ["class_id_1"],
    ...
  }
}
```

---

### 2. **Assign Assignment to Specific Students** ⭐ NEW
```
POST /api/class/:classId/assignments/assign-students
```

**Request Body:**
```json
{
  "assignmentId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "studentEmails": [
    "student1@yopmail.com",
    "student2@yopmail.com",
    "student3@yopmail.com"
  ]
}
```

**What it does:**
- Verifies assignment exists in the class
- Verifies students are active in the class
- Creates `StudentAssignment` only for specified students
- Handles duplicates gracefully (if student already has the assignment)
- Sends notifications to assigned students

**Response:**
```json
{
  "success": true,
  "message": "Assignment assigned to students successfully",
  "data": {
    "success": true,
    "assignedCount": 3,
    "assignedStudents": [
      {
        "_id": "student_id_1",
        "email": "student1@yopmail.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      ...
    ]
  }
}
```

**Error Handling:**
- If some students already have the assignment → Still assigns to others
- If none of the students are in the class → Returns 400 error
- If assignment is not in the class → Returns 400 error

---

### 3. **Remove Assignment from Class**
```
DELETE /api/class/:classId/assignments
```

**Request Body:**
```json
{
  "assignmentId": "64f1a2b3c4d5e6f7g8h9i0j1"
}
```

**What it does:**
- Removes assignment from the class
- Removes class from assignment's classId array
- Deletes ALL `StudentAssignment` records for that assignment in that class

**Response:**
```json
{
  "success": true,
  "message": "Assignment removed from class successfully",
  "data": {
    "success": true,
    "removedStudentAssignments": 25
  }
}
```

---

### 4. **Delete Assignment Globally**
```
DELETE /api/class/assignments/:id
```

**What it does:**
- Removes assignment from ALL classes
- Deletes ALL `StudentAssignment` records across all classes
- Deletes the assignment document itself
- Uses MongoDB transaction for data integrity

**Response:**
```json
{
  "success": true,
  "message": "Assignment deleted successfully from all classes",
  "data": {
    "success": true,
    "assignment": {...},
    "affectedClasses": 3,
    "deletedStudentAssignments": 45
  }
}
```

---

## 📊 Data Models

### Assignment Model
```javascript
{
  assignmentName: String,
  dueDate: Date,
  description: String,
  teacherId: ObjectId (ref: Auth),
  questions: [ObjectId] (ref: Question),
  classId: [ObjectId] (ref: Class),  // Array of classes using this assignment
  curriculumId: ObjectId (ref: Curriculum),
  topicId: ObjectId (ref: Topic),
  totalMarks: Number,
  duration: Number,
  isActive: Boolean
}
```

### StudentAssignment Model
```javascript
{
  studentId: ObjectId (ref: Student),
  assignmentId: ObjectId (ref: Assignment),
  classId: ObjectId (ref: Class),
  answers: [{
    questionId: ObjectId (ref: Question),
    answer: String,
    marksObtained: Number,
    submittedAt: Date
  }],
  totalMarksObtained: Number,
  completionRate: Number,
  status: Enum ["not_started", "in_progress", "submitted", "graded"],
  startedAt: Date,
  submittedAt: Date,
  gradedAt: Date
}
```

**Unique Index:** `{ studentId: 1, assignmentId: 1 }` - Ensures student can't have duplicate assignments

---

## 🔄 Workflows

### Workflow 1: Assign to All Students in Class
```
1. Teacher creates assignment globally
2. Teacher adds assignment to Class A
   → All active students in Class A get StudentAssignment
   → All students receive notifications
3. If a new student joins Class A later
   → They DON'T automatically get past assignments
   → Teacher must manually assign to them
```

### Workflow 2: Assign to Specific Students
```
1. Assignment already exists in Class A
2. Teacher assigns to specific students (e.g., 3 out of 10)
   → Only those 3 students get StudentAssignment
   → Only those 3 students receive notifications
3. Teacher can later assign to more students
   → System handles duplicates gracefully
```

### Workflow 3: Remove Assignment from Class
```
1. Assignment exists in Class A with 25 student assignments
2. Teacher removes assignment from Class A
   → Assignment removed from class.assignments
   → Class A removed from assignment.classId
   → All 25 StudentAssignment records deleted
3. If assignment is still in Class B
   → Class B students keep their StudentAssignments
```

### Workflow 4: Delete Assignment Globally
```
1. Assignment exists in Class A, B, and C (75 total students)
2. Teacher deletes assignment globally
   → Assignment removed from all 3 classes
   → All 75 StudentAssignment records deleted
   → Assignment document deleted
   → All done in a MongoDB transaction (all-or-nothing)
```

---

## 🎯 Use Cases

### Use Case 1: Differentiated Instruction
**Scenario:** Teacher wants to give different assignments to different student groups

**Solution:**
1. Create Assignment A (for advanced students)
2. Create Assignment B (for regular students)
3. Add both assignments to the class
4. Assign Assignment A to advanced students only
5. Assign Assignment B to regular students only

### Use Case 2: Makeup Assignments
**Scenario:** Student was absent, needs to complete a past assignment

**Solution:**
1. Assignment already exists in class
2. Use "assign to specific students" to assign to that one student
3. System handles if they already have it

### Use Case 3: Remove Mistaken Assignment
**Scenario:** Teacher accidentally added wrong assignment to class

**Solution:**
1. Use "remove assignment from class" endpoint
2. All student assignments are automatically cleaned up
3. No orphaned data remains

---

## 🔒 Security & Validation

### Validations Implemented:
1. ✅ Only teachers can manage assignments
2. ✅ Assignment must exist in class before assigning to students
3. ✅ Students must be active in the class
4. ✅ Duplicate prevention via unique index
5. ✅ MongoDB ObjectId validation
6. ✅ Required field validation

### Data Integrity:
1. ✅ Cascading deletions prevent orphaned records
2. ✅ Transaction-based global deletion ensures atomicity
3. ✅ Unique index prevents duplicate student assignments
4. ✅ Status tracking for proper workflow management

---

## 📧 Notifications

### Notification Triggers:
1. **Assignment added to class** → All active students notified
2. **Assignment assigned to specific students** → Only those students notified
3. **Message format:**
   ```
   Title: "New Assignment Assigned"
   Message: "The assignment '[NAME]' has been assigned to you in class '[CLASS]'. Due date: [DATE]."
   ```

---

## 🐛 Error Handling

### Common Errors:

**400 - Bad Request**
- Invalid class ID or assignment ID
- Students not in class
- Assignment not in class

**404 - Not Found**
- Class not found
- Assignment not found
- No students found with provided emails

**Duplicate Key Error (11000)**
- Student already has assignment → Handled gracefully
- Assigns to others, reports how many were already assigned

---

## 📝 Testing Examples

### Test 1: Assign to All Students
```bash
POST /api/class/64f1a2b3c4d5e6f7g8h9i0j1/assignments
{
  "assignmentId": "64a1b2c3d4e5f6g7h8i9j0k1"
}
```

### Test 2: Assign to Specific Students
```bash
POST /api/class/64f1a2b3c4d5e6f7g8h9i0j1/assignments/assign-students
{
  "assignmentId": "64a1b2c3d4e5f6g7h8i9j0k1",
  "studentEmails": ["student1@test.com", "student2@test.com"]
}
```

### Test 3: Remove from Class
```bash
DELETE /api/class/64f1a2b3c4d5e6f7g8h9i0j1/assignments
{
  "assignmentId": "64a1b2c3d4e5f6g7h8i9j0k1"
}
```

### Test 4: Delete Globally
```bash
DELETE /api/class/assignments/64a1b2c3d4e5f6g7h8i9j0k1
```

---

## 🚀 Future Enhancements (Suggestions)

1. **Bulk Assignment Management**
   - Assign multiple assignments to multiple students at once
   
2. **Assignment Templates**
   - Save common assignment configurations
   
3. **Auto-Assignment Rules**
   - Automatically assign to new students based on criteria
   
4. **Assignment Scheduling**
   - Schedule assignments to be released at specific times
   
5. **Student Progress Dashboard**
   - View all student assignments and their statuses

---

## 📞 Support

For questions or issues, contact the development team.

**Last Updated:** November 7, 2025
