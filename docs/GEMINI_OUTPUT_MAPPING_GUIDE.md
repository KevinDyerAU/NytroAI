> ✨ **Note:** This guide has been updated to reflect the new, streamlined prompt schema which focuses on performance and core validation.

# Guide: Mapping Gemini JSON to `validation_results` Table

This document provides a clear example of the expected JSON output from the Gemini API and explains how each field is mapped to the `validation_results` table in the Supabase database. It also includes the updated `Parse Gemini Response` code for the n8n workflow.

---

## 1. Sample Gemini API JSON Output

The following is a sample JSON response from the Gemini API for a **Knowledge Evidence** requirement. This structure is the standard for all validation types.

```json
{
  "status": "Partially Met",
  "reasoning": "The Learner Guide covers the core concepts of risk assessment, including hazard identification in Section 2.1 and the hierarchy of controls in Section 2.3. However, it does not provide a detailed explanation of how to use a risk matrix to calculate a risk score, which is a key part of the requirement. The guide would benefit from adding a worked example of risk calculation.",
  "mapped_content": "Section 2.1 (Page 14) covers hazard identification with practical examples and workplace scenarios. Section 2.3 (Page 18-20) explains the hierarchy of controls in detail with case studies. Appendix A (Page 45) includes a sample risk assessment form showing the structure and required fields.",
  "citations": [
    "BSBWHS332X Learner Guide v2.1, Page 14, Section 2.1: Identifying Hazards",
    "BSBWHS332X Learner Guide v2.1, Page 18, Section 2.3: Hierarchy of Controls",
    "BSBWHS332X Learner Guide v2.1, Page 45, Appendix A: Sample Risk Assessment Form"
  ],
  "smart_question": "What are the two factors used to calculate a risk score in a standard risk matrix?",
  "benchmark_answer": "Likelihood (the chance of the hazard occurring) and Consequence (the severity of the outcome if it does occur)."
}
```

---

## 2. Mapping to `validation_results` Table

The n8n workflow takes the JSON output above and maps it to the columns of the `validation_results` table. Several fields are also passed through from upstream nodes (like `Split into Individual Requirements`) to provide complete context for each result.

| `validation_results` Column | Data Type | Source | Example Value (from sample) |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Auto-generated | `c4a7b8e9-9d1f-4a6e-8b3c-1e2f3a4b5c6d` |
| `validation_detail_id` | `uuid` | Upstream Node | `a1b2c3d4-e5f6-7890-1234-567890abcdef` |
| `requirement_id` | `text` | Upstream Node | `KE1.1` |
| `requirement_number` | `text` | Upstream Node | `KE1.1` |
| `requirement_text` | `text` | Upstream Node | `"Describe how to conduct a risk assessment."` |
| `requirement_type` | `text` | Upstream Node | `"knowledge_evidence"` |
| **`status`** | `text` | **Gemini JSON** | `"Partially Met"` |
| **`reasoning`** | `text` | **Gemini JSON** | `"The Learner Guide covers the core concepts... However, it does not provide..."` |
| **`mapped_content`** | `text` | **Gemini JSON** | `"Section 2.1 (Page 14) covers hazard identification..."` |
| **`citations`** | `text[]` | **Gemini JSON** | `{"BSBWHS332X Learner Guide v2.1, Page 14..."}` |
| **`smart_question`** | `text` | **Gemini JSON** | `"What are the two factors used to calculate..."` |
| **`benchmark_answer`** | `text` | **Gemini JSON** | `"Likelihood (the chance of the hazard occurring)..."` |
| `confidence_score` | `numeric` | Hardcoded | `0.85` |
| `created_at` | `timestamp` | Auto-generated | `2025-11-30 14:30:00` |

> **Important Schema Note:**
> The `citations` column should be of type `TEXT[]` (an array of strings) in PostgreSQL to correctly store the array from the JSON output. The `smart_question` and `benchmark_answer` columns are now simple `TEXT` fields.

---

## 3. Updated n8n "Parse Gemini Response" Code

To correctly handle this new, streamlined JSON structure, the code in the **Parse Gemini Response** node in your n8n workflow must be updated. This code removes the old logic for nested objects and correctly maps the new flat structure.

```javascript
// --- Updated Parse Gemini Response Code ---

// Get the raw text content from the Gemini API response
const geminiResponse = $input.item.json;
const content = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

if (!content) {
  throw new Error("No content found in Gemini API response. The response may be empty or malformed.");
}

// Clean the content: remove markdown code fences and trim whitespace
const cleanedContent = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();

// Parse the cleaned JSON string into an object
let validationResult;
try {
  validationResult = JSON.parse(cleanedContent);
} catch (error) {
  // If parsing fails, throw a detailed error to help with debugging
  console.error("Failed to parse Gemini JSON:", cleanedContent);
  throw new Error(`Failed to parse Gemini response after cleaning. Error: ${error.message}`);
}

// Get the upstream data from the loop
const upstreamData = $('Merge').item.json;

// Map the parsed result and upstream data to the database schema
const result = {
  json: {
    // Data from upstream nodes
    validation_id: upstreamData.validation_id,
    requirement_id: upstreamData.requirement_id,
    requirement_number: upstreamData.requirement_number,
    requirement_text: upstreamData.requirement_text,
    requirement_type: upstreamData.requirement_type,

    // Data from Gemini API
    status: validationResult.status,
    reasoning: validationResult.reasoning,
    mapped_content: validationResult.mapped_content,
    citations: validationResult.citations, // This is now an array of strings
    smart_question: validationResult.smart_question, // This is now a string
    benchmark_answer: validationResult.benchmark_answer, // This is now a string

    // Hardcoded or default values
    confidence_score: 0.85 // Default confidence score
  }
};

return result;
```

### Key Changes in the Code:

1.  **Flatter Structure:** The code now directly accesses `validationResult.status`, `validationResult.reasoning`, etc. It no longer needs to traverse nested objects like `smart_question.question_text`.
2.  **Citations as Array:** The `citations` field is passed directly as an array of strings, which will be correctly inserted into a `TEXT[]` column in PostgreSQL.
3.  **Error Handling:** Includes more robust error handling to log the problematic JSON if parsing fails, which is critical for debugging prompt issues.
4.  **Upstream Data:** It correctly pulls context (like `validation_id` and `requirement_id`) from the `Merge` node, which preserves the data throughout the loop.

---

By using this structure, the system ensures that every validation result is stored in a clean, consistent, and easily queryable format, while also improving the performance and reliability of the AI validation workflow.
