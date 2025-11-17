# Answer Validation System Documentation

## Overview

This system provides automatic answer validation for student submissions based on the questions created by admins. It supports both exact matching and partial matching with configurable marks.

## Features

- **Full Marks Validation**: Checks if student answer matches the correct answer with 95%+ similarity
- **Partial Marks Validation**: Awards partial marks for answers that are 80%+ similar to predefined partial answers
- **Levenshtein Distance Algorithm**: Used for calculating string similarity
- **Assignment Submission**: Validates multiple answers and updates student assignment records
- **Detailed Feedback**: Provides students with feedback on their answers

## API Endpoints

### 1. Validate Single Answer
**POST** `/curriculum/answers/validate-single`

Validates a single answer against a question.

**Request Body:**
```json
{
  "questionId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "answer": "The student's answer text"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Answer validated successfully",
  "data": {
    "questionId": "64f1a2b3c4d5e6f7g8h9i0j1",
    "studentAnswer": "The student's answer text",
    "correctAnswer": "The correct answer from question",
    "marksObtained": 10,
    "validationType": "full_marks",
    "similarity": 0.98,
    "feedback": "Excellent! Your answer matches 98% with the correct answer."
  }
}
```

### 2. Submit Assignment Answers
**POST** `/curriculum/answers/submit-assignment`

Submits and validates multiple answers for an assignment.

**Request Body:**
```json
{
  "assignmentId": "64f1a2b3c4d5e6f7g8h9i0j2",
  "answers": [
    {
      "questionId": "64f1a2b3c4d5e6f7g8h9i0j1",
      "answer": "Student's answer to question 1"
    },
    {
      "questionId": "64f1a2b3c4d5e6f7g8h9i0j3",
      "answer": "Student's answer to question 2"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Answers submitted and validated successfully",
  "data": {
    "assignmentId": "64f1a2b3c4d5e6f7g8h9i0j2",
    "studentId": "64f1a2b3c4d5e6f7g8h9i0j4",
    "validationResults": [
      {
        "questionId": "64f1a2b3c4d5e6f7g8h9i0j1",
        "studentAnswer": "Student's answer",
        "marksObtained": 10,
        "validationType": "full_marks",
        "feedback": "Excellent! Your answer matches 98% with the correct answer."
      }
    ],
    "totalMarksObtained": 25,
    "completionRate": 100,
    "submittedAt": "2025-01-15T10:30:00.000Z",
    "gradedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### 3. Get Answer Validation Details
**GET** `/curriculum/answers/validation-details`

Gets detailed validation information including question context.

**Query Parameters:**
- `questionId`: ID of the question
- `answer`: The answer to validate

**Response:**
```json
{
  "success": true,
  "message": "Answer validation details retrieved successfully",
  "data": {
    "question": {
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "text": "What is the capital of France?",
      "topic": "Geography",
      "fullMarks": {
        "answer": "Paris",
        "mark": 10
      },
      "partialMarks": [
        {
          "answer": "paris",
          "mark": 5
        }
      ]
    },
    "validation": {
      "questionId": "64f1a2b3c4d5e6f7g8h9i0j1",
      "studentAnswer": "Paris",
      "marksObtained": 10,
      "validationType": "full_marks",
      "similarity": 1.0,
      "feedback": "Excellent! Your answer matches 100% with the correct answer."
    }
  }
}
```

### 4. Test Answer Similarity (Admin Only)
**POST** `/curriculum/answers/test-similarity`

Tests similarity between two answers (useful for admins to understand matching).

**Request Body:**
```json
{
  "answer1": "Paris",
  "answer2": "paris"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Similarity calculated successfully",
  "data": {
    "answer1": "Paris",
    "answer2": "paris",
    "similarity": 1.0,
    "similarityPercentage": 100
  }
}
```

## Validation Logic

### Full Marks Validation
- **Threshold**: 95% similarity or higher
- **Algorithm**: Levenshtein distance
- **Result**: Awards full marks as defined in the question

### Partial Marks Validation
- **Threshold**: 80% similarity or higher
- **Algorithm**: Levenshtein distance
- **Result**: Awards partial marks for the best matching partial answer
- **Priority**: If multiple partial answers match, the one with highest marks is selected

### String Processing
Before comparison, both strings are:
1. Converted to lowercase
2. Trimmed of whitespace
3. Compared using Levenshtein distance algorithm

## Question Structure

For the validation system to work, questions should have this structure:

```javascript
{
  questionText: "What is the capital of France?",
  fullMarks: {
    answer: "Paris",
    mark: 10
  },
  partialMarks: [
    {
      answer: "paris",
      mark: 5
    },
    {
      answer: "Paris France",
      mark: 7
    }
  ]
}
```

## Integration with Student Assignments

When students submit answers via the assignment endpoint:
1. Each answer is validated individually
2. Total marks are calculated
3. StudentAssignment record is updated
4. Status is set to "graded"
5. Completion rate is calculated

## Error Handling

The system handles various error scenarios:
- Invalid question IDs
- Inactive questions
- Missing required fields
- Empty answers array
- Invalid assignment IDs

## Usage Examples

### Frontend Integration (JavaScript)

```javascript
// Submit assignment answers
const submitAssignment = async (assignmentId, answers) => {
  try {
    const response = await fetch('/curriculum/answers/submit-assignment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        assignmentId,
        answers
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Total marks obtained:', result.data.totalMarksObtained);
      console.log('Validation results:', result.data.validationResults);
    }
  } catch (error) {
    console.error('Submission failed:', error);
  }
};

// Validate single answer (for practice)
const validateAnswer = async (questionId, answer) => {
  try {
    const response = await fetch('/curriculum/answers/validate-single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        questionId,
        answer
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Marks obtained:', result.data.marksObtained);
      console.log('Feedback:', result.data.feedback);
    }
  } catch (error) {
    console.error('Validation failed:', error);
  }
};
```

## Configuration

The similarity thresholds can be adjusted in the `answerValidation.service.js` file:

```javascript
// For full marks - currently 95%
if (similarity >= 0.95) {
  // Award full marks
}

// For partial marks - currently 80%
if (similarity >= 0.8) {
  // Award partial marks
}
```

## Security Considerations

- All endpoints require authentication
- Admin-only endpoints are protected by role-based access
- Input validation is performed on all requests
- Question IDs are validated to prevent unauthorized access

## Performance Notes

- Levenshtein distance calculation is O(n*m) where n and m are string lengths
- For large-scale deployments, consider caching question data
- Batch validation is optimized for assignment submissions
