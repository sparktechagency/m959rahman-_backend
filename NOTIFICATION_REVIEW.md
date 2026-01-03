# Notification Review - M959Rahman Backend

## Overview
This document provides a comprehensive review of notification usage across the codebase, identifying current notifications and opportunities for improvement by role.

## Current Notification Implementation

### Existing Notifications

| Module | Event | Recipient Role | Status | Location |
|--------|-------|---------------|--------|----------|
| School | Teacher assigned to school | Teacher | ✅ Implemented | `school.service.js:75-82` |
| Class | Student added to class | Student | ✅ Implemented | `class.service.js:304-310` |
| Class | Student joins class by code | Student | ✅ Implemented | `student.service.js:632-638` |
| Class | Assignment posted to class | Student | ✅ Implemented | `class.service.js:564-570` |
| Class | Assignment assigned to specific students | Student | ✅ Implemented | `class.service.js:729-733` |
| Auth | User registration (email pending verification) | User | ✅ Implemented | `auth.service.js:200` |
| Curriculum | Curriculum/Topic/Question actions | Admin | ✅ Implemented | `curriculum.service.js` (multiple) |
| Assignment | Scheduled assignment published | Student | ✅ Implemented | `assignmentScheduler.js:68-76` |

## Recommended Notification Opportunities

### High Priority (Should Implement)

#### School Module
- **Teacher removed from school**
  - **Recipient**: Teacher
  - **Trigger**: `removeTeacherFromSchool` function
  - **Message**: "You have been removed from [School Name]"
  - **Location**: `school.service.js:399`

#### Class Module
- **Student removed from class**
  - **Recipient**: Student
  - **Trigger**: `removeStudentFromClass` function  
  - **Message**: "You have been removed from class [Class Name]"
  - **Location**: `class.service.js` (removeStudentFromClass function)

- **Assignment removed from student**
  - **Recipient**: Student
  - **Trigger**: `removeAssignmentFromStudent` function
  - **Message**: "Assignment [Assignment Name] has been removed from your class [Class Name]"
  - **Location**: `class.service.js:1036`

- **Assignment graded/feedback provided**
  - **Recipient**: Student
  - **Trigger**: When teacher grades assignment or provides feedback
  - **Message**: "Your submission for [Assignment Name] has been graded. Score: [Score]/[Total]"
  - **Location**: To be implemented in grading function

### Medium Priority (Nice to Have)

#### Class Module
- **Class deleted**
  - **Recipient**: All students in class & Teacher
  - **Trigger**: `deleteClass` function
  - **Message**: "Class [Class Name] has been deleted"
  - **Location**: `class.service.js` (deleteClass function)

- **Class updated (name/details changed)**
  - **Recipient**: All active students
  - **Trigger**: `updateClass` function (if significant changes)
  - **Message**: "Class [Class Name] details have been updated"
  - **Location**: `class.service.js` (updateClass function)

#### Assignment Module
- **Assignment due date approaching**
  - **Recipient**: Students with pending assignments
  - **Trigger**: Cron job (24h, 1h before due date)
  - **Message**: "Reminder: Assignment [Assignment Name] is due in [Time]"
  - **Location**: New cron job needed

- **Assignment updated after posting**
  - **Recipient**: All assigned students
  - **Trigger**: `updateAssignment` function
  - **Message**: "Assignment [Assignment Name] has been updated"
  - **Location**: `class.service.js` (updateAssignment function)

### Low Priority (Optional Enhancements)

#### School Module
- **Teacher status changed (blocked/active)**
  - **Recipient**: Teacher
  - **Trigger**: `updateTeacherStatus` function
  - **Message**: "Your status in [School Name] has been changed to [Status]"
  - **Location**: `school.service.js:378`

#### Student Module  
- **Account blocked/unblocked**
  - **Recipient**: Student
  - **Trigger**: `updateBlockUnblockStudent` function
  - **Message**: "Your account access has been [blocked/restored]"
  - **Location**: `student.service.js:124`

#### Class Module
- **New student joined class (for teacher)**
  - **Recipient**: Teacher
  - **Trigger**: `addStudentToClass` or `joinClassByCode`
  - **Message**: "[Student Name] has joined your class [Class Name]"
  - **Location**: `class.service.js:285` or `student.service.js:599`

## Implementation Guidelines

### Standard Notification Pattern
```javascript
try {
  await postNotification(
    "Notification Title",
    "Detailed notification message with context",
    recipientUserId
  );
} catch (notificationError) {
  console.error("Failed to send notification:", notificationError);
}
```

### Best Practices
1. **Always wrap in try-catch**: Notifications should never break the main flow
2. **Place after successful operation**: Send notifications after DB operations succeed
3. **Use descriptive titles**: Clear, action-oriented titles (e.g., "Added to Class", "Assignment Graded")
4. **Include context**: Mention relevant names (class, assignment, school) in the message
5. **Use proper recipient ID**: Ensure you're using the correct user identification (authId vs _id)

## Notification Types by Role

### Student Notifications
- ✅ Added to class
- ✅ Joined class successfully  
- ✅ New assignment posted
- ✅ Assignment assigned to me
- ❌ Removed from class
- ❌ Assignment removed
- ❌ Assignment graded
- ❌ Assignment due soon
- ❌ Class deleted

### Teacher Notifications
- ✅ Assigned to school
- ❌ Removed from school
- ❌ Status changed in school
- ❌ New student joined class
- ❌ Assignment submissions received

### School Notifications
- Currently no school-specific notifications identified

### Admin Notifications
- ✅ Curriculum/topic/question events
- Various administrative actions already covered

## Technical Notes

### postNotification Utility
- **Location**: `src/util/postNotification.js`
- **Parameters**: `(title, message, toId)`
- **Behavior**: 
  - If `toId` is null → creates AdminNotification
  - If `toId` is provided → creates user Notification
- **Error handling**: Wrapped in catchAsync, errors logged but don't throw

### Notification Models
- **Notification**: For regular users (students, teachers, schools)
  - Fields: `toId`, `title`, `message`, `isRead`, `timestamps`
- **AdminNotification**: For admin/super_admin
  - Fields: `title`, `message`, `isRead`, `timestamps`

## Recommendation Summary

**Total Identified Opportunities**: 13  
**Currently Implemented**: 8 ✅  
**High Priority**: 3 ❌  
**Medium Priority**: 4 ❌  
**Low Priority**: 3 ❌

Implementing the high-priority notifications would significantly improve user experience and communication within the platform.
