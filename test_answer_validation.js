/**
 * Test file for Answer Validation System
 * Run this file to test the validation logic
 */

const { calculateStringSimilarity } = require('./src/app/module/curriculum/answerValidation.service');

// Test cases for string similarity
const testCases = [
  { answer1: "Paris", answer2: "Paris", expected: 1.0 },
  { answer1: "Paris", answer2: "paris", expected: 1.0 },
  { answer1: "Paris", answer2: "Paris ", expected: 1.0 },
  { answer1: "Paris", answer2: "Pariss", expected: 0.8 },
  { answer1: "JavaScript", answer2: "Javascript", expected: 1.0 },
  { answer1: "JavaScript", answer2: "Java Script", expected: 0.89 },
  { answer1: "The capital of France is Paris", answer2: "Capital of France: Paris", expected: 0.81 },
  { answer1: "Hello World", answer2: "Hello", expected: 0.6 },
  { answer1: "", answer2: "Paris", expected: 0 },
];

console.log("=== Testing String Similarity Algorithm ===\n");

testCases.forEach((testCase, index) => {
  const similarity = calculateStringSimilarity(testCase.answer1, testCase.answer2);
  const percentage = Math.round(similarity * 100);
  
  console.log(`Test ${index + 1}:`);
  console.log(`  Answer 1: "${testCase.answer1}"`);
  console.log(`  Answer 2: "${testCase.answer2}"`);
  console.log(`  Similarity: ${similarity.toFixed(2)} (${percentage}%)`);
  console.log(`  Expected: ~${testCase.expected.toFixed(2)}`);
  console.log(`  Status: ${Math.abs(similarity - testCase.expected) < 0.1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
});

// Example validation scenarios
console.log("=== Example Validation Scenarios ===\n");

const scenarios = [
  {
    description: "Perfect match - Full marks",
    studentAnswer: "Paris",
    correctAnswer: "Paris",
    fullMark: 10,
    expectedOutcome: "Full marks (10)"
  },
  {
    description: "Case difference - Full marks",
    studentAnswer: "paris",
    correctAnswer: "Paris",
    fullMark: 10,
    expectedOutcome: "Full marks (10)"
  },
  {
    description: "Minor typo - No marks",
    studentAnswer: "Pariss",
    correctAnswer: "Paris",
    fullMark: 10,
    expectedOutcome: "No marks (below 95% threshold)"
  },
  {
    description: "Partial match with partial marks option",
    studentAnswer: "Pariss",
    correctAnswer: "Paris",
    partialOptions: [{ answer: "Pariss", mark: 5 }],
    fullMark: 10,
    expectedOutcome: "Partial marks (5)"
  }
];

scenarios.forEach((scenario, index) => {
  console.log(`Scenario ${index + 1}: ${scenario.description}`);
  console.log(`  Student Answer: "${scenario.studentAnswer}"`);
  console.log(`  Correct Answer: "${scenario.correctAnswer}"`);
  
  const similarity = calculateStringSimilarity(scenario.studentAnswer, scenario.correctAnswer);
  console.log(`  Similarity: ${Math.round(similarity * 100)}%`);
  
  if (similarity >= 0.95) {
    console.log(`  Result: Full marks awarded (${scenario.fullMark})`);
  } else if (scenario.partialOptions && similarity >= 0.8) {
    console.log(`  Result: Partial marks awarded (${scenario.partialOptions[0].mark})`);
  } else {
    console.log(`  Result: No marks awarded`);
  }
  
  console.log(`  Expected: ${scenario.expectedOutcome}`);
  console.log('');
});

console.log("=== Validation Thresholds ===");
console.log("Full Marks: 95% similarity or higher");
console.log("Partial Marks: 80% similarity or higher");
console.log("No Marks: Below 80% similarity");
